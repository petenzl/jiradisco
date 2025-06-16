import { Initiative, InitiativesForMonth } from "./types";
import { format, parseISO } from "date-fns";

type MonthWork = {
  work: number;
  initiatives: Initiative[];
};

export function groupInitiativesByMonth(
  today: Date,
  initiatives: Initiative[],
  teamCapacityPerMonth: number = 20
): InitiativesForMonth[] {
  // Ensure today is at the start of the day
  today.setHours(0, 0, 0, 0);

  // Filter out initiatives that have no target date or are not valid
  initiatives = initiatives.filter(
    (initiative) =>
      initiative.targetDate && !isNaN(initiative.targetDate.getTime())
  );

  // Sort initiatives by target date
  initiatives.sort(
    (a, b) =>
      a.targetDate.getUTCMilliseconds() - b.targetDate.getUTCMilliseconds()
  );

  // Group initiatives by month
  const monthlyWork: { [key: string]: MonthWork } = {};

  const currentMonthKey = format(today, "yyyy-MM");

  initiatives.forEach((initiative) => {
    const targetDate = new Date(initiative.targetDate.getTime());
    if (isNaN(targetDate.getTime())) return;
    targetDate.setHours(0, 0, 0, 0);

    const monthKey =
      targetDate < today ? currentMonthKey : format(targetDate, "yyyy-MM");

    if (!monthlyWork[monthKey]) {
      monthlyWork[monthKey] = {
        work: 0,
        initiatives: [],
      };
    }
    monthlyWork[monthKey].work += initiative.workDays;
    monthlyWork[monthKey].initiatives.push(initiative);
  });

  const chartData = Object.keys(monthlyWork)
    .sort() // Sorting the 'yyyy-MM' keys guarantees chronological order
    .map((monthKey) => {
      return {
        name: format(parseISO(monthKey), "MMM yy"),
        work: Math.round(monthlyWork[monthKey].work),
        capacity: teamCapacityPerMonth,
        initiatives: monthlyWork[monthKey].initiatives,
      };
    });

  return chartData;
}
