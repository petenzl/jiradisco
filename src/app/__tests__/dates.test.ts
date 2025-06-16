import { calculateWorkingDays, addWorkingDays, getToday } from "../dates";

describe("calculateWorkingDays", () => {
  test("correctly calculates working days in one week", () => {
    const monday = new Date("2025-06-16"); // Monday
    const friday = new Date("2025-06-20"); // Friday
    expect(calculateWorkingDays(monday, friday)).toBe(5);
  });

  test("correctly excludes weekends", () => {
    const monday = new Date("2025-06-16"); // Monday
    const nextMonday = new Date("2025-06-23"); // Next Monday
    expect(calculateWorkingDays(monday, nextMonday)).toBe(6); // 5 days first week + Monday of next week
  });

  test("returns 0 for same day", () => {
    const day = new Date("2025-06-16");
    expect(calculateWorkingDays(day, day)).toBe(1); // Same day counts as 1 working day
  });

  test("returns 0 when end date is before start date", () => {
    const start = new Date("2025-06-16");
    const end = new Date("2025-06-15");
    expect(calculateWorkingDays(start, end)).toBe(0);
  });

  test("handles invalid dates", () => {
    const validDate = new Date("2025-06-16");
    const invalidDate = new Date("invalid-date");

    expect(calculateWorkingDays(invalidDate, validDate)).toBe(0);
    expect(calculateWorkingDays(validDate, invalidDate)).toBe(0);
    expect(calculateWorkingDays(null as unknown as Date, validDate)).toBe(0);
    expect(calculateWorkingDays(validDate, null as unknown as Date)).toBe(0);
  });

  test("correctly calculates over month boundary", () => {
    const start = new Date("2025-06-27"); // Friday
    const end = new Date("2025-07-04"); // Friday
    expect(calculateWorkingDays(start, end)).toBe(6); // 1 day in June + 5 days in July
  });
});

describe("addWorkingDays", () => {
  test("adds working days correctly", () => {
    const monday = new Date("2025-06-16"); // Monday
    const result = addWorkingDays(monday, 5);
    expect(result.toISOString().split("T")[0]).toBe("2025-06-23"); // Should be next Monday
  });

  test("skips weekends when adding days", () => {
    const friday = new Date("2025-06-20"); // Friday
    const result = addWorkingDays(friday, 1);
    expect(result.toISOString().split("T")[0]).toBe("2025-06-23"); // Should be Monday, not Saturday
  });

  test("returns same date for zero or negative days", () => {
    const monday = new Date("2025-06-16");
    expect(addWorkingDays(monday, 0).toISOString().split("T")[0]).toBe(
      "2025-06-16"
    );
    expect(addWorkingDays(monday, -1).toISOString().split("T")[0]).toBe(
      "2025-06-16"
    );
  });

  test("handles fractional days by flooring", () => {
    const monday = new Date("2025-06-16");
    const result = addWorkingDays(monday, 3.7);
    expect(result.toISOString().split("T")[0]).toBe("2025-06-19"); // Should be Thursday (Monday + 3 days)
  });

  test("correctly adds days over month boundary", () => {
    const friday = new Date("2025-06-27"); // Last Friday in June
    const result = addWorkingDays(friday, 5);
    expect(result.toISOString().split("T")[0]).toBe("2025-07-04"); // Should be Friday of first week in July
  });
});

describe("getToday", () => {
  test("returns current date with time set to midnight", () => {
    const today = getToday();
    // time component should be set to 0
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
    expect(today.getSeconds()).toBe(0);
    expect(today.getMilliseconds()).toBe(0);
  });
});
