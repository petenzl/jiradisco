import { Initiative } from "./types";
import Papa from "papaparse";
import { differenceInDays } from "date-fns";
import { addWorkingDays, calculateWorkingDays } from "./dates";

export type ParseCsvToInitiativesResult =
  | {
      outcome: "success";
      initiatives: Initiative[];
    }
  | {
      outcome: "error";
      error: string;
    };

interface CsvRow {
  [key: string]: string;
}

export function parseCsvRowToInitiative(today: Date, row: CsvRow): Initiative {
  // Create a new date to avoid mutating the input
  const todayForProcessing = new Date(today);
  const deliveryStatusText = row["delivery status"] || "";
  const estimationStatus = row["estimation status"]
    ? row["estimation status"].toLowerCase()
    : "";
  const status = row["status"] ? row["status"].toLowerCase() : ""; //project status - e.g Awaiting Requirements
  const estimate = parseInt(row["estimate"], 10) || 0;

  let todo = 0,
    inProgress = 0,
    doneWork = 0,
    totalWork = 0;

  if (deliveryStatusText) {
    const todoMatch = deliveryStatusText.match(/To Do: (\d+(\.\d+)?|\d+) of/);
    const inProgressMatch = deliveryStatusText.match(
      /In Progress: (\d+(\.\d+)?|\d+) of/
    );
    const doneMatch = deliveryStatusText.match(/Done: (\d+(\.\d+)?|\d+) of/);
    const totalMatch = deliveryStatusText.match(
      /of (\d+(\.\d+)?|\d+) story points/
    );

    if (todoMatch) todo = parseFloat(todoMatch[1]);
    if (inProgressMatch) inProgress = parseFloat(inProgressMatch[1]);
    if (doneMatch) doneWork = parseFloat(doneMatch[1]);
    if (totalMatch) totalWork = parseFloat(totalMatch[1]);
  }

  let workDays: number;

  if (
    estimationStatus === "not estimated" ||
    estimationStatus === "high level estimate"
  ) {
    workDays = estimate; //work due = original estimate if work still being estimated
    totalWork = estimate; //totalWork = original estimate if work still being estimated
  } else if (todo > 200) {
    const startDate = new Date(row["project start"]);
    const targetDate = new Date(row["project target"]);
    workDays = calculateWorkingDays(startDate, targetDate);
  } else {
    workDays = todo + 0.5 * inProgress;
  }

  let percentComplete: number;

  if (totalWork > 0) {
    percentComplete = ((totalWork - workDays) / totalWork) * 100;
  } else if (workDays === 0) {
    percentComplete = 100;
  } else {
    percentComplete = 0;
  }

  percentComplete = Math.max(0, Math.min(100, percentComplete));

  const targetDate = new Date(row["project target"]);
  const startDate = new Date(row["project start"]);

  let expectedCompletion: number;

  if (!isNaN(startDate.getTime()) && !isNaN(targetDate.getTime())) {
    const projectLengthInDays = differenceInDays(targetDate, startDate);
    if (projectLengthInDays > 0) {
      const elapsedDays = differenceInDays(todayForProcessing, startDate);
      expectedCompletion = Math.max(
        0,
        Math.min(100, (elapsedDays / projectLengthInDays) * 100)
      );
    } else if (percentComplete === 100) {
      expectedCompletion = 100;
    } else if (projectLengthInDays < 0) {
      //this can happen if the targetDate is in the past
      expectedCompletion = 100;
    } else {
      expectedCompletion = 0;
    }
  } else {
    expectedCompletion = 0;
  }

  let projectedFinishDate: Date;

  if (doneWork > 0) {
    projectedFinishDate = addWorkingDays(todayForProcessing, workDays);
  } else {
    const dateFromWorkDue = addWorkingDays(todayForProcessing, workDays);
    projectedFinishDate = new Date(
      Math.max(dateFromWorkDue.getTime(), targetDate.getTime() || 0)
    );
  }

  let onTrackStatus = differenceInDays(targetDate, projectedFinishDate); //how many days ahead/behind

  if (onTrackStatus > totalWork) {
    onTrackStatus = totalWork; //an initiative can't be more early than the total length of the work
  }

  if (doneWork.toFixed(2) === totalWork.toFixed(2) && totalWork > 0) {
    onTrackStatus = 0; //if all the work's done, then we are neither early nor late
  }

  if (status.toLowerCase() === "awaiting requirements") {
    onTrackStatus = 0;
  }

  return {
    name: row.summary,
    targetDate: targetDate,
    workDays: workDays,
    totalWork: totalWork,
    doneWork: doneWork,
    projectedFinishDate: projectedFinishDate,
    onTrackStatus: onTrackStatus,
    status: row.status,
    customer: row["pm customer"],
    percentComplete: percentComplete,
    expectedCompletion: expectedCompletion,
  };
}

export function parseCsvToInitiatives(
  today: Date,
  csvString: string
): ParseCsvToInitiativesResult {
  // Create a new date to avoid mutating the input
  const todayForProcessing = new Date(today);
  const results = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (results.errors.length) {
    return {
      outcome: "error",
      error: `Error parsing CSV: ${results.errors
        .map((e) => e.message)
        .join(", ")}`,
    };
  }

  const requiredColumns = [
    "summary",
    "project start",
    "project target",
    "delivery status",
    "estimation status",
    "estimate",
    "status",
    "pm customer",
  ];

  const parsedHeaders = results.meta.fields;

  if (results.errors.length) {
    return {
      outcome: "error",
      error: `Error parsing CSV: ${results.errors
        .map((e) => e.message)
        .join(", ")}`,
    };
  }

  if (!parsedHeaders) {
    return {
      outcome: "error",
      error: "Failed to parse headers in CSV",
    };
  }

  const missingColumns = requiredColumns.filter(
    (col) => !parsedHeaders.includes(col)
  );

  if (!results.data.length || missingColumns.length > 0) {
    return {
      outcome: "error",
      error: `Invalid CSV format. Missing: [${missingColumns.join(
        ", "
      )}]. Found: [${parsedHeaders.join(", ")}]`,
    };
  }

  try {
    const initiatives: Initiative[] = (results.data as CsvRow[])
      .map((row: CsvRow) => parseCsvRowToInitiative(todayForProcessing, row))
      .filter(
        (i: Initiative) =>
          i.name && !isNaN(i.targetDate.getTime()) && !isNaN(i.workDays)
      );

    initiatives.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

    return {
      outcome: "success",
      initiatives: initiatives,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      outcome: "error",
      error: `Error processing CSV data: ${errorMessage}`,
    };
  }
}
