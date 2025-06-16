export type Initiative = {
  /** The name or summary of the initiative. */
  name: string;
  /** The current status of the initiative.
   * Common values include: "In Progress", "To Do", "Done", "Awaiting Requirements".
   */
  status: string;

  /** The target completion date of the initiative, typically in an ISO 8601 string format
   * (e.g., "YYYY-MM-DD") that can be parsed by `new Date()`.
   */
  targetDate: Date;

  /** The projected finish date of the initiative, in an ISO 8601 string format. */
  projectedFinishDate: Date;

  /** The amount of work that has been completed (e.g., story points, hours). */
  doneWork: number;

  /** The number of work days relevant to the initiative (e.g., elapsed, estimated). */
  workDays: number;

  /** The total amount of work estimated for the initiative (e.g., total story points, hours). */
  totalWork: number;

  /** The current percentage of work completed for the initiative (0-100). */
  percentComplete: number;

  /** The expected percentage of completion at the current point in time (0-100). */
  expectedCompletion: number;

  /**
   * A numerical indicator of whether the initiative is on track.
   * Positive values typically mean ahead of schedule, negative values mean behind,
   * and zero means on schedule.
   */
  onTrackStatus: number;

  /** The name of the customer or client associated with this initiative. */
  customer: string;
};

export type InitiativesForMonth = {
  name: string;
  work: number;
  capacity: number;
  initiatives: Initiative[];
};
