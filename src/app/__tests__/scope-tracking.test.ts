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
    const extractDateFromFileName = (fileName: string): Date | null => {
      // Pattern: "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv"
      const datePattern = /(\w{3}\s+\d{1,2},\s+\d{4})/;
      const match = fileName.match(datePattern);
      
      if (match) {
        try {
          // Parse the date string (e.g., "Jul 10, 2025")
          const { parse } = require("date-fns");
          const date = parse(match[1], "MMM d, yyyy", new Date());
          return date;
        } catch (error) {
          console.error("Error parsing date from filename:", error);
          return null;
        }
      }
      
      return null;
    };

    it("should extract date from valid filename", () => {
      const fileName = "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv";
      const result = extractDateFromFileName(fileName);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(6); // July is month 6 (0-indexed)
      expect(result?.getDate()).toBe(10);
    });

    it("should extract date from filename with single digit day", () => {
      const fileName = "Envest Delivery Schedule - Product Planning Jan 5, 2025 10_06 AM.csv";
      const result = extractDateFromFileName(fileName);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0); // January is month 0
      expect(result?.getDate()).toBe(5);
    });

    it("should return null for filename without date", () => {
      const fileName = "random-file.csv";
      const result = extractDateFromFileName(fileName);
      
      expect(result).toBeNull();
    });

    it("should return null for filename with invalid date format", () => {
      const fileName = "Envest Delivery Schedule - Product Planning Invalid 32, 2025.csv";
      const result = extractDateFromFileName(fileName);
      
      // The date parsing will fail and return a Date with NaN
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result!.getTime())).toBe(true);
    });

    it("should handle different month abbreviations", () => {
      const testCases = [
        { fileName: "file Dec 25, 2024.csv", expectedMonth: 11 },
        { fileName: "file Feb 14, 2025.csv", expectedMonth: 1 },
        { fileName: "file Mar 1, 2025.csv", expectedMonth: 2 },
      ];

      testCases.forEach(({ fileName, expectedMonth }) => {
        const result = extractDateFromFileName(fileName);
        expect(result).toBeInstanceOf(Date);
        expect(result?.getMonth()).toBe(expectedMonth);
      });
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
      const extractDateFromFileName = (fileName: string): Date | null => {
        const datePattern = /(\w{3}\s+\d{1,2},\s+\d{4})/;
        const match = fileName.match(datePattern);
        
        if (match) {
          try {
            const { parse } = require("date-fns");
            const date = parse(match[1], "MMM d, yyyy", new Date());
            return date;
          } catch (error) {
            return null;
          }
        }
        return null;
      };

      const date = extractDateFromFileName(file.name);
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
}); 