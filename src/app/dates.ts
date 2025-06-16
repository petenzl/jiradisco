// --- Helper Functions ---
/**
 * Calculates the number of working days (Mon-Fri) between two dates.
 * @param {Date} startDate - The start date.
 * @param {Date} endDate - The end date.
 * @returns {number} The number of working days.
 */
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  if (
    !startDate ||
    !endDate ||
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime()) ||
    endDate < startDate
  ) {
    return 0;
  }

  let count = 0;
  const curDate = new Date(startDate.getTime());

  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // 0=Sunday, 6=Saturday
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

/**
 * Adds a specified number of working days to a given start date.
 * @param {Date} startDate - The date to start from.
 * @param {number} days - The number of working days to add.
 * @returns {Date} The new date.
 */
export function addWorkingDays(startDate: Date, days: number): Date {
  if (isNaN(days) || days <= 0) {
    return new Date(startDate);
  }
  let count = 0;
  const curDate = new Date(startDate);
  while (count < Math.floor(days)) {
    curDate.setDate(curDate.getDate() + 1);
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not Sunday or Saturday
      count++;
    }
  }
  return curDate;
}

export function getToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
