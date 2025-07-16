import { groupInitiativesByMonth } from "../summary";
import { Initiative } from "../types";

describe("groupInitiativesByMonth", () => {
  // Create a base initiative that we can modify for different test cases
  const createInitiative = (overrides = {}): Initiative => ({
    name: "Test Initiative",
    status: "In Progress",
    targetDate: new Date("2025-07-15"),
    projectedFinishDate: new Date("2025-07-20"),
    doneWork: 5,
    workDays: 10,
    totalWork: 15,
    percentComplete: 33.33,
    expectedCompletion: 50,
    onTrackStatus: -1,
    customer: "Test Customer",
    ...overrides,
  });

  test("correctly groups initiatives by month", () => {
    const today = new Date("2025-06-16");
    const initiatives: Initiative[] = [
      createInitiative({
        name: "Initiative 1",
        targetDate: new Date("2025-06-30"),
        workDays: 5,
      }),
      createInitiative({
        name: "Initiative 2",
        targetDate: new Date("2025-07-15"),
        workDays: 10,
      }),
      createInitiative({
        name: "Initiative 3",
        targetDate: new Date("2025-07-25"),
        workDays: 8,
      }),
      createInitiative({
        name: "Initiative 4",
        targetDate: new Date("2025-08-10"),
        workDays: 15,
      }),
    ];

    const result = groupInitiativesByMonth(today, initiatives, 30);

    expect(result.length).toBe(3); // June, July, August

    // Check June data
    expect(result[0].name).toBe("Jun 25");
    expect(result[0].work).toBe(5);
    expect(result[0].capacity).toBe(30);
    expect(result[0].initiatives.length).toBe(1);
    expect(result[0].initiatives[0].name).toBe("Initiative 1");

    // Check July data
    expect(result[1].name).toBe("Jul 25");
    expect(result[1].work).toBe(18); // 10 + 8
    expect(result[1].initiatives.length).toBe(2);

    // Check August data
    expect(result[2].name).toBe("Aug 25");
    expect(result[2].work).toBe(15);
    expect(result[2].initiatives.length).toBe(1);
    expect(result[2].initiatives[0].name).toBe("Initiative 4");
  });

  test("handles initiatives with past target dates", () => {
    const today = new Date("2025-06-16");
    const initiatives: Initiative[] = [
      createInitiative({
        name: "Past Initiative",
        targetDate: new Date("2025-05-15"),
        workDays: 7,
      }),
      createInitiative({
        name: "Current Initiative",
        targetDate: new Date("2025-06-25"),
        workDays: 10,
      }),
    ];

    const result = groupInitiativesByMonth(today, initiatives);

    // Past initiative should be grouped into current month
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Jun 25");
    expect(result[0].work).toBe(17); // 7 + 10
    expect(result[0].initiatives.length).toBe(2);
  });

  test("filters out initiatives with invalid target dates", () => {
    const today = new Date("2025-06-16");
    const initiatives: Initiative[] = [
      createInitiative({
        name: "Valid Initiative",
        targetDate: new Date("2025-07-15"),
        workDays: 10,
      }),
      createInitiative({
        name: "Invalid Initiative",
        targetDate: new Date("invalid-date"),
        workDays: 8,
      }),
    ];

    const result = groupInitiativesByMonth(today, initiatives);

    expect(result.length).toBe(1);
    expect(result[0].initiatives.length).toBe(1);
    expect(result[0].initiatives[0].name).toBe("Valid Initiative");
  });

  test("sorts initiatives chronologically by month", () => {
    const today = new Date("2025-06-16");
    const initiatives: Initiative[] = [
      createInitiative({
        name: "Future Initiative",
        targetDate: new Date("2025-09-15"),
        workDays: 12,
      }),
      createInitiative({
        name: "Current Initiative",
        targetDate: new Date("2025-06-25"),
        workDays: 8,
      }),
      createInitiative({
        name: "Upcoming Initiative",
        targetDate: new Date("2025-07-10"),
        workDays: 10,
      }),
    ];

    const result = groupInitiativesByMonth(today, initiatives);

    expect(result.length).toBe(3);
    expect(result[0].name).toBe("Jun 25");
    expect(result[1].name).toBe("Jul 25");
    expect(result[2].name).toBe("Sep 25");
  });

  test("uses provided team capacity", () => {
    const today = new Date("2025-06-16");
    const initiatives: Initiative[] = [
      createInitiative({ targetDate: new Date("2025-07-15") }),
    ];

    const customCapacity = 40;
    const result = groupInitiativesByMonth(today, initiatives, customCapacity);

    expect(result[0].capacity).toBe(customCapacity);
  });

  test("uses default team capacity when not provided", () => {
    const today = new Date("2025-06-16");
    const initiatives: Initiative[] = [
      createInitiative({ targetDate: new Date("2025-07-15") }),
    ];

    const result = groupInitiativesByMonth(today, initiatives);

    expect(result[0].capacity).toBe(20); // Default value from function
  });

  test("handles empty initiatives array", () => {
    const today = new Date("2025-06-16");
    const result = groupInitiativesByMonth(today, []);

    expect(result).toEqual([]);
  });
});

describe("Cumulative Data Calculation", () => {
  const calculateCumulativeData = (data: InitiativesForMonth[], teamCapacityPerMonth: number) => {
    return data.map((month, index) => {
      const cumulativeWork = data
        .slice(0, index + 1)
        .reduce((sum, monthData) => sum + monthData.work, 0);
      
      const cumulativeCapacity = (index + 1) * teamCapacityPerMonth;
      
      return {
        name: month.name,
        cumulativeWork,
        cumulativeCapacity,
      };
    });
  };

  it("should calculate cumulative data correctly", () => {
    const mockData: InitiativesForMonth[] = [
      { name: "Jan 24", work: 100, capacity: 120, initiatives: [] },
      { name: "Feb 24", work: 150, capacity: 120, initiatives: [] },
      { name: "Mar 24", work: 80, capacity: 120, initiatives: [] },
    ];

    const result = calculateCumulativeData(mockData, 120);

    expect(result).toEqual([
      { name: "Jan 24", cumulativeWork: 100, cumulativeCapacity: 120 },
      { name: "Feb 24", cumulativeWork: 250, cumulativeCapacity: 240 },
      { name: "Mar 24", cumulativeWork: 330, cumulativeCapacity: 360 },
    ]);
  });

  it("should handle empty data", () => {
    const result = calculateCumulativeData([], 120);
    expect(result).toEqual([]);
  });

  it("should handle single month data", () => {
    const mockData: InitiativesForMonth[] = [
      { name: "Jan 24", work: 100, capacity: 120, initiatives: [] },
    ];

    const result = calculateCumulativeData(mockData, 120);

    expect(result).toEqual([
      { name: "Jan 24", cumulativeWork: 100, cumulativeCapacity: 120 },
    ]);
  });
});
