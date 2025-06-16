import { parseCsvRowToInitiative, parseCsvToInitiatives } from "../csv";

// Mock date-fns imports
jest.mock("date-fns", () => ({
  differenceInDays: jest.fn((date1, date2) => {
    return Math.floor(
      (date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)
    );
  }),
}));

// Mock the dates helper functions
jest.mock("../dates", () => ({
  addWorkingDays: jest.fn((date, days) => {
    // Simple mock that adds days (not accounting for weekends)
    const result = new Date(date);
    result.setDate(result.getDate() + Math.floor(days));
    return result;
  }),
  calculateWorkingDays: jest.fn((start, end) => {
    // Simple mock that calculates days (not accounting for weekends)
    if (
      !start ||
      !end ||
      isNaN(start.getTime()) ||
      isNaN(end.getTime()) ||
      end < start
    ) {
      return 0;
    }
    return Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
  }),
}));

// Mock Papa Parse
jest.mock("papaparse", () => ({
  parse: jest.fn((csvString, options) => {
    // Mock implementation of Papa.parse
    if (csvString.includes("ERROR")) {
      return {
        data: [],
        errors: [{ message: "Mock error" }],
        meta: { fields: [] },
      };
    }

    if (csvString.includes("MISSING_COLUMNS")) {
      return {
        data: [{ summary: "Test" }],
        errors: [],
        meta: { fields: ["summary"] },
      };
    }

    if (csvString.includes("VALID_CSV")) {
      return {
        data: [
          {
            summary: "Test Initiative",
            "project start": "2025-05-16",
            "project target": "2025-07-16",
            "delivery status":
              "To Do: 5, In Progress: 3, Done: 7 of 15 story points",
            "estimation status": "estimated",
            estimate: "15",
            status: "In Progress",
            "pm customer": "Test Customer",
          },
          {
            summary: "Test Initiative 2",
            "project start": "2025-05-20",
            "project target": "2025-07-20",
            "delivery status":
              "To Do: 10, In Progress: 5, Done: 5 of 20 story points",
            "estimation status": "estimated",
            estimate: "20",
            status: "In Progress",
            "pm customer": "Another Customer",
          },
        ],
        errors: [],
        meta: {
          fields: [
            "summary",
            "project start",
            "project target",
            "delivery status",
            "estimation status",
            "estimate",
            "status",
            "pm customer",
          ],
        },
      };
    }

    // Default case
    return {
      data: [],
      errors: [],
      meta: { fields: [] },
    };
  }),
}));

describe("parseCsvRowToInitiative", () => {
  // Fixed test date to avoid test flakiness
  const today = new Date("2025-06-16");

  test("correctly parses a row with all fields properly populated", () => {
    const row = {
      summary: "Test Initiative",
      "delivery status": "To Do: 5, In Progress: 3, Done: 7 of 15 story points",
      "estimation status": "estimated",
      status: "In Progress",
      estimate: "15",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "pm customer": "Test Customer",
    };

    const result = parseCsvRowToInitiative(today, row);

    expect(result).toEqual(
      expect.objectContaining({
        name: "Test Initiative",
        status: "In Progress",
        workDays: 6.5, // 5 + 0.5*3
        doneWork: 7,
        totalWork: 15,
        customer: "Test Customer",
      })
    );

    expect(result.percentComplete).toBeCloseTo(56.67, 1); // (15-6.5)/15 * 100
    expect(result.targetDate).toEqual(new Date("2025-07-16"));
    expect(result.projectedFinishDate).not.toBeNull();
  });

  test('handles row with "not estimated" status', () => {
    const row = {
      summary: "Test Initiative",
      "delivery status": "",
      "estimation status": "not estimated",
      status: "To Do",
      estimate: "20",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "pm customer": "Test Customer",
    };

    const result = parseCsvRowToInitiative(today, row);

    expect(result.workDays).toBe(20); // workDays = estimate if not estimated
    expect(result.totalWork).toBe(20); // totalWork = estimate if not estimated
  });

  test('handles row with "high level estimate" status', () => {
    const row = {
      summary: "Test Initiative",
      "delivery status": "",
      "estimation status": "high level estimate",
      status: "To Do",
      estimate: "25",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "pm customer": "Test Customer",
    };

    const result = parseCsvRowToInitiative(today, row);

    expect(result.workDays).toBe(25); // same as previous test
    expect(result.totalWork).toBe(25);
  });

  test("handles row with todo > 200", () => {
    const row = {
      summary: "Big Initiative",
      "delivery status":
        "To Do: 250, In Progress: 10, Done: 5 of 265 story points",
      "estimation status": "estimated",
      status: "In Progress",
      estimate: "265",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "pm customer": "Test Customer",
    };

    const result = parseCsvRowToInitiative(today, row);

    // Should use calculateWorkingDays instead
    expect(result.workDays).toBe(61); // 61 days from 2025-05-16 to 2025-07-16
  });

  test('handles row with "Awaiting Requirements" status', () => {
    const row = {
      summary: "New Initiative",
      "delivery status":
        "To Do: 10, In Progress: 0, Done: 0 of 10 story points",
      "estimation status": "estimated",
      status: "Awaiting Requirements",
      estimate: "10",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "pm customer": "Test Customer",
    };

    const result = parseCsvRowToInitiative(today, row);

    // onTrackStatus should be 0 for awaiting requirements
    expect(result.onTrackStatus).toBe(0);
  });

  test("handles row with all work done", () => {
    const row = {
      summary: "Completed Initiative",
      "delivery status":
        "To Do: 0, In Progress: 0, Done: 15 of 15 story points",
      "estimation status": "estimated",
      status: "Done",
      estimate: "15",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "pm customer": "Test Customer",
    };

    const result = parseCsvRowToInitiative(today, row);

    expect(result.percentComplete).toBe(100);
    expect(result.onTrackStatus).toBe(0); // Neither early nor late when complete
  });

  test("handles empty or missing fields with default values", () => {
    const row = {
      summary: "Minimal Initiative",
      "project start": "2025-05-16",
      "project target": "2025-07-16",
      "delivery status": "",
      "estimation status": "",
      estimate: "",
      status: "",
      "pm customer": "",
    };

    const result = parseCsvRowToInitiative(today, row);

    expect(result.workDays).toBe(0);
    expect(result.totalWork).toBe(0);
    expect(result.doneWork).toBe(0);
    expect(result.percentComplete).toBe(100); // Since workDays is 0
  });
});

describe("parseCsvToInitiatives", () => {
  // Fixed test date to avoid test flakiness
  const today = new Date("2025-06-16");

  test("returns error when CSV parsing fails", () => {
    const result = parseCsvToInitiatives(today, "ERROR_CSV");

    expect(result.outcome).toBe("error");
    if (result.outcome === "error") {
      expect(result.error).toContain("Error parsing CSV");
    }
  });

  test("returns error when required columns are missing", () => {
    const result = parseCsvToInitiatives(today, "MISSING_COLUMNS");

    expect(result.outcome).toBe("error");
    if (result.outcome === "error") {
      expect(result.error).toContain("Invalid CSV format");
      expect(result.error).toContain("Missing:");
    }
  });

  test("successfully parses valid CSV data", () => {
    const result = parseCsvToInitiatives(today, "VALID_CSV");

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.initiatives).toHaveLength(2);
      expect(result.initiatives[0].name).toBe("Test Initiative");
      expect(result.initiatives[1].name).toBe("Test Initiative 2");
      expect(result.initiatives[0].customer).toBe("Test Customer");
      expect(result.initiatives[1].customer).toBe("Another Customer");
    }
  });

  test("handles empty CSV data", () => {
    const result = parseCsvToInitiatives(today, "");

    expect(result.outcome).toBe("error");
  });
});
