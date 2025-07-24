import { parseCsvToInitiatives } from "../csv";
import { getToday } from "../dates";

// Mock the CSV parsing function
jest.mock("../csv", () => ({
  parseCsvToInitiatives: jest.fn(),
}));

// Mock the dates function
jest.mock("../dates", () => ({
  getToday: jest.fn(),
}));

describe("Scope Tracking Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getToday as jest.Mock).mockReturnValue(new Date("2025-01-15"));
  });

  describe("Date Extraction from Filename", () => {
    const extractDateFromFileName = async (fileName: string): Promise<Date | null> => {
      // Pattern: "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv"
      const datePattern = /(\w{3}\s+\d{1,2},\s+\d{4})/;
      const match = fileName.match(datePattern);
      
      if (match) {
        try {
          // Parse the date string (e.g., "Jul 10, 2025")
          const { parse } = await import("date-fns");
          const date = parse(match[1], "MMM d, yyyy", new Date());
          return date;
        } catch {
          return null;
        }
      }
      
      return null;
    };

    it("should extract date from valid filename", async () => {
      const fileName = "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv";
      const result = await extractDateFromFileName(fileName);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(6); // July is month 6 (0-indexed)
      expect(result?.getDate()).toBe(10);
    });

    it("should extract date from filename with single digit day", async () => {
      const fileName = "Envest Delivery Schedule - Product Planning Jan 5, 2025 10_06 AM.csv";
      const result = await extractDateFromFileName(fileName);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0); // January is month 0
      expect(result?.getDate()).toBe(5);
    });

    it("should return null for filename without date", async () => {
      const fileName = "random-file.csv";
      const result = await extractDateFromFileName(fileName);
      
      expect(result).toBeNull();
    });

    it("should return null for filename with invalid date format", async () => {
      const fileName = "Envest Delivery Schedule - Product Planning Invalid 32, 2025.csv";
      const result = await extractDateFromFileName(fileName);
      
      // The date parsing will fail and return a Date with NaN
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result!.getTime())).toBe(true);
    });

    it("should handle different month abbreviations", async () => {
      const testCases = [
        { fileName: "file Dec 25, 2024.csv", expectedMonth: 11 },
        { fileName: "file Feb 14, 2025.csv", expectedMonth: 1 },
        { fileName: "file Mar 1, 2025.csv", expectedMonth: 2 },
      ];

      for (const { fileName, expectedMonth } of testCases) {
        const result = await extractDateFromFileName(fileName);
        expect(result).toBeInstanceOf(Date);
        expect(result?.getMonth()).toBe(expectedMonth);
      }
    });
  });

  describe("File Processing", () => {
    const processFile = async (file: File): Promise<{
      date: Date;
      totalScope: number;
      workDone: number;
      fileName: string;
      initiativeCount: number;
    } | null> => {
      const extractDateFromFileName = async (fileName: string): Promise<Date | null> => {
        const datePattern = /(\w{3}\s+\d{1,2},\s+\d{4})/;
        const match = fileName.match(datePattern);
        
        if (match) {
          try {
            const { parse } = await import("date-fns");
            const date = parse(match[1], "MMM d, yyyy", new Date());
            return date;
          } catch {
            return null;
          }
        }
        return null;
      };

      const date = await extractDateFromFileName(file.name);
      if (!date) {
        throw new Error(`Could not extract date from filename: ${file.name}`);
      }

      const text = await file.text();
      const result = parseCsvToInitiatives(getToday(), text);
      
      if (result.outcome === "error") {
        throw new Error(result.error);
      }

      const totalScope = result.initiatives.reduce(
        (sum, initiative) => sum + initiative.totalWork,
        0
      );

      const workDone = result.initiatives.reduce(
        (sum, initiative) => sum + initiative.doneWork,
        0
      );

      return {
        date,
        totalScope,
        workDone,
        fileName: file.name,
        initiativeCount: result.initiatives.length,
      };
    };

    beforeEach(() => {
      (parseCsvToInitiatives as jest.Mock).mockReturnValue({
        outcome: "success",
        initiatives: [
          { totalWork: 10, doneWork: 5 },
          { totalWork: 15, doneWork: 8 },
          { totalWork: 5, doneWork: 2 },
        ],
      });
    });

    it("should process file successfully", async () => {
      const file = new File(["csv content"], "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv");
      // Mock the text() method
      file.text = jest.fn().mockResolvedValue("csv content");
      
      const result = await processFile(file);
      
      expect(result).toEqual({
        date: expect.any(Date),
        totalScope: 30, // 10 + 15 + 5
        workDone: 15,   // 5 + 8 + 2
        fileName: "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv",
        initiativeCount: 3,
      });
    });

    it("should throw error for invalid filename", async () => {
      const file = new File(["csv content"], "invalid-filename.csv");
      // Mock the text() method
      file.text = jest.fn().mockResolvedValue("csv content");
      
      await expect(processFile(file)).rejects.toThrow("Could not extract date from filename: invalid-filename.csv");
    });

    it("should throw error when CSV parsing fails", async () => {
      (parseCsvToInitiatives as jest.Mock).mockReturnValue({
        outcome: "error",
        error: "Invalid CSV format",
      });

      const file = new File(["csv content"], "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv");
      // Mock the text() method
      file.text = jest.fn().mockResolvedValue("csv content");
      
      await expect(processFile(file)).rejects.toThrow("Invalid CSV format");
    });

    it("should handle empty initiatives list", async () => {
      (parseCsvToInitiatives as jest.Mock).mockReturnValue({
        outcome: "success",
        initiatives: [],
      });

      const file = new File(["csv content"], "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv");
      // Mock the text() method
      file.text = jest.fn().mockResolvedValue("csv content");
      
      const result = await processFile(file);
      
      expect(result).toEqual({
        date: expect.any(Date),
        totalScope: 0,
        workDone: 0,
        fileName: "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv",
        initiativeCount: 0,
      });
    });
  });

  describe("Projection Calculation", () => {
    const calculateProjectedFinishDate = (scopeData: Array<{
      date: Date;
      totalScope: number;
      workDone: number;
    }>) => {
      if (scopeData.length < 2) {
        return null;
      }

      // Sort by date to ensure we have earliest and latest
      const sortedData = [...scopeData].sort((a, b) => a.date.getTime() - b.date.getTime());
      const earliest = sortedData[0];
      const latest = sortedData[sortedData.length - 1];

      // Calculate days between earliest and latest timestamps
      const daysBetween = Math.max(1, (latest.date.getTime() - earliest.date.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate work done per day
      const workDoneDifference = latest.workDone - earliest.workDone;
      const workRatePerDay = workDoneDifference / daysBetween;

      // If no work is being done, return null
      if (workRatePerDay <= 0) {
        return null;
      }

      // Calculate remaining work
      const remainingWork = latest.totalScope - latest.workDone;

      // Calculate days remaining
      const daysRemaining = remainingWork / workRatePerDay;

      // Calculate projected finish date
      const projectedFinishDate = new Date(latest.date.getTime() + (daysRemaining * 24 * 60 * 60 * 1000));

      return {
        projectedFinishDate,
        workRatePerDay,
        remainingWork,
        daysRemaining,
        earliestDate: earliest.date,
        latestDate: latest.date,
      };
    };

    it("should return null for insufficient data", () => {
      const result = calculateProjectedFinishDate([]);
      expect(result).toBeNull();

      const result2 = calculateProjectedFinishDate([{
        date: new Date("2025-01-01"),
        totalScope: 100,
        workDone: 50,
      }]);
      expect(result2).toBeNull();
    });

    it("should calculate projection correctly", () => {
      const scopeData = [
        {
          date: new Date("2025-01-01"),
          totalScope: 100,
          workDone: 20,
        },
        {
          date: new Date("2025-01-15"), // 14 days later
          totalScope: 100,
          workDone: 50, // 30 more work done in 14 days = 2.14 days/day
        },
      ];

      const result = calculateProjectedFinishDate(scopeData);

      expect(result).not.toBeNull();
      expect(result?.workRatePerDay).toBeCloseTo(2.14, 2);
      expect(result?.remainingWork).toBe(50); // 100 - 50
      expect(result?.daysRemaining).toBeCloseTo(23.33, 2); // 50 / 2.14
      expect(result?.earliestDate).toEqual(new Date("2025-01-01"));
      expect(result?.latestDate).toEqual(new Date("2025-01-15"));
    });

    it("should return null when no work is being done", () => {
      const scopeData = [
        {
          date: new Date("2025-01-01"),
          totalScope: 100,
          workDone: 50,
        },
        {
          date: new Date("2025-01-15"),
          totalScope: 100,
          workDone: 50, // No additional work done
        },
      ];

      const result = calculateProjectedFinishDate(scopeData);
      expect(result).toBeNull();
    });

    it("should handle data not in chronological order", () => {
      const scopeData = [
        {
          date: new Date("2025-01-15"),
          totalScope: 100,
          workDone: 50,
        },
        {
          date: new Date("2025-01-01"),
          totalScope: 100,
          workDone: 20,
        },
      ];

      const result = calculateProjectedFinishDate(scopeData);

      expect(result).not.toBeNull();
      expect(result?.earliestDate).toEqual(new Date("2025-01-01"));
      expect(result?.latestDate).toEqual(new Date("2025-01-15"));
    });

    it("should handle same-day data", () => {
      const scopeData = [
        {
          date: new Date("2025-01-01"),
          totalScope: 100,
          workDone: 20,
        },
        {
          date: new Date("2025-01-01"), // Same day
          totalScope: 100,
          workDone: 50,
        },
      ];

      const result = calculateProjectedFinishDate(scopeData);

      expect(result).not.toBeNull();
      // With 1 day between (minimum), work rate would be 30 days/day
      expect(result?.workRatePerDay).toBe(30);
    });
  });

  describe("Scope Creep Calculation", () => {
    const calculateScopeCreep = (scopeData: Array<{
      date: Date;
      totalScope: number;
      workDone: number;
    }>) => {
      if (scopeData.length < 2) {
        return null;
      }

      // Sort by date to ensure we have earliest and latest
      const sortedData = [...scopeData].sort((a, b) => a.date.getTime() - b.date.getTime());
      const latest = sortedData[sortedData.length - 1];
      
      // Calculate 14 days ago from the latest date
      const fourteenDaysAgo = new Date(latest.date.getTime() - (14 * 24 * 60 * 60 * 1000));
      
      // Find the data point closest to 14 days ago (or the earliest available if less than 14 days)
      let comparisonPoint = sortedData[0]; // Default to earliest point
      
      for (let i = sortedData.length - 2; i >= 0; i--) {
        const point = sortedData[i];
        if (point.date <= fourteenDaysAgo) {
          comparisonPoint = point;
          break;
        }
      }
      
      // Calculate scope change
      const scopeChange = latest.totalScope - comparisonPoint.totalScope;
      const daysBetween = Math.max(1, (latest.date.getTime() - comparisonPoint.date.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        scopeChange,
        scopeChangePerDay: scopeChange / daysBetween,
        comparisonDate: comparisonPoint.date,
        latestDate: latest.date,
        daysBetween: Math.round(daysBetween),
      };
    };

    it("should calculate scope creep correctly", () => {
      const baseDate = new Date("2024-01-01");
      const scopeData = [
        { date: new Date(baseDate.getTime() - 25 * 24 * 60 * 60 * 1000), totalScope: 100, workDone: 20 },
        { date: new Date(baseDate.getTime() - 14 * 24 * 60 * 60 * 1000), totalScope: 120, workDone: 30 },
        { date: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000), totalScope: 140, workDone: 45 },
        { date: baseDate, totalScope: 160, workDone: 60 },
      ];

      const result = calculateScopeCreep(scopeData);

      expect(result).toEqual({
        scopeChange: 40, // 160 - 120 (using 14 days ago point)
        scopeChangePerDay: 40 / 14, // 40 days change over 14 days
        comparisonDate: new Date(baseDate.getTime() - 14 * 24 * 60 * 60 * 1000),
        latestDate: baseDate,
        daysBetween: 14,
      });
    });

    it("should handle scope reduction (negative creep)", () => {
      const baseDate = new Date("2024-01-01");
      const scopeData = [
        { date: new Date(baseDate.getTime() - 20 * 24 * 60 * 60 * 1000), totalScope: 200, workDone: 20 },
        { date: new Date(baseDate.getTime() - 14 * 24 * 60 * 60 * 1000), totalScope: 180, workDone: 40 },
        { date: baseDate, totalScope: 150, workDone: 60 },
      ];

      const result = calculateScopeCreep(scopeData);

      expect(result).toEqual({
        scopeChange: -30, // 150 - 180 (using 14 days ago point)
        scopeChangePerDay: -30 / 14, // -30 days change over 14 days
        comparisonDate: new Date(baseDate.getTime() - 14 * 24 * 60 * 60 * 1000),
        latestDate: baseDate,
        daysBetween: 14,
      });
    });

    it("should use earliest point when no data point is 14+ days old", () => {
      const baseDate = new Date("2024-01-01");
      const scopeData = [
        { date: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000), totalScope: 100, workDone: 20 },
        { date: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000), totalScope: 120, workDone: 30 },
        { date: baseDate, totalScope: 140, workDone: 45 },
      ];

      const result = calculateScopeCreep(scopeData);

      expect(result).toEqual({
        scopeChange: 40, // 140 - 100
        scopeChangePerDay: 40 / 10, // 40 days change over 10 days
        comparisonDate: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000),
        latestDate: baseDate,
        daysBetween: 10,
      });
    });

    it("should return null for insufficient data", () => {
      const scopeData = [
        { date: new Date("2024-01-01"), totalScope: 100, workDone: 20 },
      ];

      const result = calculateScopeCreep(scopeData);
      expect(result).toBeNull();
    });

    it("should handle empty data", () => {
      const result = calculateScopeCreep([]);
      expect(result).toBeNull();
    });
  });

  describe("Projected Finish Date with Scope Creep", () => {
    const calculateProjectedFinishDateWithScopeCreep = (
      projection: {
        workRatePerDay: number;
        remainingWork: number;
        daysRemaining: number;
        projectedFinishDate: Date;
        earliestDate: Date;
        latestDate: Date;
      },
      scopeCreep: {
        scopeChange: number;
        scopeChangePerDay: number;
        comparisonDate: Date;
        latestDate: Date;
        daysBetween: number;
      }
    ) => {
      // Calculate effective work rate with scope creep
      const effectiveWorkRate = projection.workRatePerDay - scopeCreep.scopeChangePerDay;
      
      // Calculate days to completion with scope creep
      const daysToCompletionWithCreep = projection.remainingWork / effectiveWorkRate;
      
      // Calculate projected finish date with scope creep (from today's date)
      const today = new Date("2025-01-15"); // Mock today's date
      const projectedDateWithCreep = new Date(today.getTime() + (daysToCompletionWithCreep * 24 * 60 * 60 * 1000));
      
      return {
        effectiveWorkRate,
        daysToCompletionWithCreep,
        projectedDateWithCreep,
      };
    };

    it("should calculate projected finish date with positive scope creep", () => {
      const projection = {
        workRatePerDay: 2.0,
        remainingWork: 40,
        daysRemaining: 20,
        projectedFinishDate: new Date("2025-02-04"),
        earliestDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
      };

      const scopeCreep = {
        scopeChange: 10,
        scopeChangePerDay: 0.5, // Positive scope creep
        comparisonDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
        daysBetween: 14,
      };

      const result = calculateProjectedFinishDateWithScopeCreep(projection, scopeCreep);

      expect(result.effectiveWorkRate).toBe(1.5); // 2.0 - 0.5
      expect(result.daysToCompletionWithCreep).toBeCloseTo(26.67, 2); // 40 / 1.5
      // 26.67 days from 2025-01-15 = 2025-02-10 (26.67 * 24 hours = 640.08 hours, so 26 full days + 16 hours)
      expect(result.projectedDateWithCreep.toDateString()).toBe(new Date("2025-02-11").toDateString());
    });

    it("should calculate projected finish date with negative scope creep (scope reduction)", () => {
      const projection = {
        workRatePerDay: 2.0,
        remainingWork: 40,
        daysRemaining: 20,
        projectedFinishDate: new Date("2025-02-04"),
        earliestDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
      };

      const scopeCreep = {
        scopeChange: -5,
        scopeChangePerDay: -0.25, // Negative scope creep (scope reduction)
        comparisonDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
        daysBetween: 14,
      };

      const result = calculateProjectedFinishDateWithScopeCreep(projection, scopeCreep);

      expect(result.effectiveWorkRate).toBe(2.25); // 2.0 - (-0.25)
      expect(result.daysToCompletionWithCreep).toBeCloseTo(17.78, 2); // 40 / 2.25
      // 17.78 days from 2025-01-15 = 2025-02-02 (17.78 * 24 hours = 426.72 hours, so 17 full days + 18.72 hours)
      expect(result.projectedDateWithCreep.toDateString()).toBe(new Date("2025-02-02").toDateString());
    });

    it("should handle zero scope creep", () => {
      const projection = {
        workRatePerDay: 2.0,
        remainingWork: 40,
        daysRemaining: 20,
        projectedFinishDate: new Date("2025-02-04"),
        earliestDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
      };

      const scopeCreep = {
        scopeChange: 0,
        scopeChangePerDay: 0, // No scope creep
        comparisonDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
        daysBetween: 14,
      };

      const result = calculateProjectedFinishDateWithScopeCreep(projection, scopeCreep);

      expect(result.effectiveWorkRate).toBe(2.0); // 2.0 - 0
      expect(result.daysToCompletionWithCreep).toBe(20); // 40 / 2.0
      expect(result.projectedDateWithCreep.toDateString()).toBe(new Date("2025-02-04").toDateString()); // 2025-01-15 + 20 days
    });

    it("should handle scope creep greater than work rate", () => {
      const projection = {
        workRatePerDay: 1.0,
        remainingWork: 20,
        daysRemaining: 20,
        projectedFinishDate: new Date("2025-02-04"),
        earliestDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
      };

      const scopeCreep = {
        scopeChange: 15,
        scopeChangePerDay: 1.5, // Scope creep greater than work rate
        comparisonDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
        daysBetween: 14,
      };

      const result = calculateProjectedFinishDateWithScopeCreep(projection, scopeCreep);

      expect(result.effectiveWorkRate).toBe(-0.5); // 1.0 - 1.5
      expect(result.daysToCompletionWithCreep).toBe(-40); // 20 / -0.5 (negative means project will never complete)
      expect(result.projectedDateWithCreep.toDateString()).toBe(new Date("2024-12-06").toDateString()); // 2025-01-15 + (-40) days
    });

    it("should handle very small scope creep", () => {
      const projection = {
        workRatePerDay: 2.0,
        remainingWork: 100,
        daysRemaining: 50,
        projectedFinishDate: new Date("2025-03-06"),
        earliestDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
      };

      const scopeCreep = {
        scopeChange: 0.5,
        scopeChangePerDay: 0.0357, // Very small scope creep (0.5 over 14 days)
        comparisonDate: new Date("2025-01-01"),
        latestDate: new Date("2025-01-15"),
        daysBetween: 14,
      };

      const result = calculateProjectedFinishDateWithScopeCreep(projection, scopeCreep);

      expect(result.effectiveWorkRate).toBeCloseTo(1.9643, 4); // 2.0 - 0.0357
      expect(result.daysToCompletionWithCreep).toBeCloseTo(50.91, 2); // 100 / 1.9643
      expect(result.projectedDateWithCreep.toDateString()).toBe(new Date("2025-03-07").toDateString()); // 2025-01-15 + 50.91 days
    });
  });

  describe("Data Sorting and Merging", () => {
    it("should sort data by date correctly", () => {
      const unsortedData = [
        { date: new Date("2025-01-15"), totalScope: 100, workDone: 50 },
        { date: new Date("2025-01-01"), totalScope: 100, workDone: 20 },
        { date: new Date("2025-01-10"), totalScope: 100, workDone: 35 },
      ];

      const sortedData = [...unsortedData].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      expect(sortedData[0].date).toEqual(new Date("2025-01-01"));
      expect(sortedData[1].date).toEqual(new Date("2025-01-10"));
      expect(sortedData[2].date).toEqual(new Date("2025-01-15"));
    });

    it("should merge new data with existing data", () => {
      const existingData = [
        { date: new Date("2025-01-01"), totalScope: 100, workDone: 20 },
        { date: new Date("2025-01-15"), totalScope: 100, workDone: 50 },
      ];

      const newData = [
        { date: new Date("2025-01-10"), totalScope: 100, workDone: 35 },
        { date: new Date("2025-01-20"), totalScope: 100, workDone: 65 },
      ];

      const allData = [...existingData, ...newData].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      expect(allData).toHaveLength(4);
      expect(allData[0].date).toEqual(new Date("2025-01-01"));
      expect(allData[1].date).toEqual(new Date("2025-01-10"));
      expect(allData[2].date).toEqual(new Date("2025-01-15"));
      expect(allData[3].date).toEqual(new Date("2025-01-20"));
    });
  });

  describe("Date Filtering", () => {
    // Define types for test data
    type TestInitiative = {
      name: string;
      targetDate: Date;
      totalWork: number;
      doneWork: number;
    };

    type TestScopeDataPoint = {
      date: Date;
      totalScope: number;
      workDone: number;
      fileName: string;
      initiativeCount: number;
      initiatives: TestInitiative[];
    };

    const createMockScopeData = (): TestScopeDataPoint[] => [
      {
        date: new Date("2024-01-01"),
        totalScope: 100,
        workDone: 20,
        fileName: "file1.csv",
        initiativeCount: 2,
        initiatives: [
          {
            name: "Initiative 1",
            targetDate: new Date("2024-02-15"),
            totalWork: 60,
            doneWork: 10,
          },
          {
            name: "Initiative 2",
            targetDate: new Date("2024-03-30"),
            totalWork: 40,
            doneWork: 10,
          },
        ],
      },
      {
        date: new Date("2024-01-15"),
        totalScope: 120,
        workDone: 30,
        fileName: "file2.csv",
        initiativeCount: 3,
        initiatives: [
          {
            name: "Initiative 3",
            targetDate: new Date("2024-02-01"),
            totalWork: 50,
            doneWork: 15,
          },
          {
            name: "Initiative 4",
            targetDate: new Date("2024-04-15"),
            totalWork: 40,
            doneWork: 10,
          },
          {
            name: "Initiative 5",
            targetDate: new Date("2024-01-20"),
            totalWork: 30,
            doneWork: 5,
          },
        ],
      },
    ];

    const getFilteredData = (scopeData: TestScopeDataPoint[], filterDate: string): TestScopeDataPoint[] => {
      if (!filterDate) {
        return scopeData;
      }

      const filterDateObj = new Date(filterDate);
      filterDateObj.setHours(23, 59, 59, 999); // End of day

      return scopeData.map(dataPoint => {
        const filteredInitiatives = dataPoint.initiatives.filter((initiative: TestInitiative) => {
          const targetDate = new Date(initiative.targetDate);
          return targetDate <= filterDateObj;
        });

        const filteredTotalScope = filteredInitiatives.reduce(
          (sum: number, initiative: TestInitiative) => sum + initiative.totalWork,
          0
        );

        const filteredWorkDone = filteredInitiatives.reduce(
          (sum: number, initiative: TestInitiative) => sum + initiative.doneWork,
          0
        );

        return {
          ...dataPoint,
          totalScope: filteredTotalScope,
          workDone: filteredWorkDone,
          initiativeCount: filteredInitiatives.length,
        };
      });
    };

    it("should return all data when no filter is applied", () => {
      const scopeData = createMockScopeData();
      const result = getFilteredData(scopeData, "");

      expect(result).toEqual(scopeData);
      expect(result[0].totalScope).toBe(100);
      expect(result[0].initiativeCount).toBe(2);
      expect(result[1].totalScope).toBe(120);
      expect(result[1].initiativeCount).toBe(3);
    });

    it("should filter initiatives by target completion date", () => {
      const scopeData = createMockScopeData();
      const result = getFilteredData(scopeData, "2024-02-15");

      // First data point: should include Initiative 1 (due 2024-02-15), exclude Initiative 2 (due 2024-03-30)
      expect(result[0].totalScope).toBe(60); // Only Initiative 1
      expect(result[0].workDone).toBe(10); // Only Initiative 1
      expect(result[0].initiativeCount).toBe(1);

      // Second data point: should include Initiative 3 (due 2024-02-01) and Initiative 5 (due 2024-01-20), exclude Initiative 4 (due 2024-04-15)
      expect(result[1].totalScope).toBe(80); // 50 + 30
      expect(result[1].workDone).toBe(20); // 15 + 5
      expect(result[1].initiativeCount).toBe(2);
    });

    it("should exclude initiatives due after the filter date", () => {
      const scopeData = createMockScopeData();
      const result = getFilteredData(scopeData, "2024-02-01");

      // First data point: should exclude both Initiative 1 (due 2024-02-15) and Initiative 2 (due 2024-03-30)
      expect(result[0].totalScope).toBe(0); // No initiatives included
      expect(result[0].workDone).toBe(0); // No initiatives included
      expect(result[0].initiativeCount).toBe(0);

      // Second data point: should include Initiative 3 (due 2024-02-01) and Initiative 5 (due 2024-01-20), exclude Initiative 4 (due 2024-04-15)
      expect(result[1].totalScope).toBe(80); // 50 + 30
      expect(result[1].workDone).toBe(20); // 15 + 5
      expect(result[1].initiativeCount).toBe(2);
    });

    it("should handle edge case where no initiatives match the filter", () => {
      const scopeData = createMockScopeData();
      const result = getFilteredData(scopeData, "2023-12-31");

      // All initiatives are due after 2023-12-31, so all should be filtered out
      expect(result[0].totalScope).toBe(0);
      expect(result[0].workDone).toBe(0);
      expect(result[0].initiativeCount).toBe(0);

      expect(result[1].totalScope).toBe(0);
      expect(result[1].workDone).toBe(0);
      expect(result[1].initiativeCount).toBe(0);
    });

    it("should handle exact date matches (initiatives due on the filter date)", () => {
      const scopeData = createMockScopeData();
      const result = getFilteredData(scopeData, "2024-02-15");

      // Should include Initiative 1 which is due exactly on 2024-02-15, exclude Initiative 2 (due 2024-03-30)
      expect(result[0].totalScope).toBe(60); // Only Initiative 1
      expect(result[0].initiativeCount).toBe(1);
    });

    it("should handle empty scope data", () => {
      const result = getFilteredData([], "2024-02-15");
      expect(result).toEqual([]);
    });

    it("should handle scope data with empty initiatives", () => {
      const scopeData: TestScopeDataPoint[] = [
        {
          date: new Date("2024-01-01"),
          totalScope: 0,
          workDone: 0,
          fileName: "empty.csv",
          initiativeCount: 0,
          initiatives: [],
        },
      ];

      const result = getFilteredData(scopeData, "2024-02-15");
      expect(result[0].totalScope).toBe(0);
      expect(result[0].workDone).toBe(0);
      expect(result[0].initiativeCount).toBe(0);
    });

    it("should preserve original data structure when filtering", () => {
      const scopeData = createMockScopeData();
      const result = getFilteredData(scopeData, "2024-02-01");

      // Check that the structure is preserved
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("fileName");
      expect(result[0]).toHaveProperty("initiatives");
      expect(Array.isArray(result[0].initiatives)).toBe(true);
    });
  });
}); 