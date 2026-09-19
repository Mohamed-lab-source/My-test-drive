// Core domain model for the Atomic Habits coaching app.
// All dates are stored as ISO date strings "YYYY-MM-DD" (local calendar day, no time).

export type ISODate = string;

export interface Identity {
  id: string;
  /** e.g. "a healthy person", "a writer" — stored without the leading "I am". */
  statement: string;
  /** Optional deeper motivation — why this identity matters. */
  why: string;
  createdAt: string;
  archived: boolean;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type Frequency =
  | { type: "daily" }
  | { type: "weekdays"; days: Weekday[] };

export type TimeOfDay = "anytime" | "morning" | "afternoon" | "evening";

/** "After [ANCHOR], I will [this habit]." */
export type StackAnchor =
  | { type: "none" }
  | { type: "habit"; habitId: string }
  | { type: "custom"; text: string };

export interface Habit {
  id: string;
  name: string;
  /** A single emoji representing the habit, shown throughout the UI. */
  icon: string;
  identityId: string | null;
  frequency: Frequency;
  timeOfDay: TimeOfDay;

  /** The Four Laws, captured at creation time. */
  cue: string;
  craving: string;
  response: string;
  reward: string;

  /** Law 3 — Make It Easy: a trivial scaled-down starter version. */
  twoMinuteVersion: string;

  stackAnchor: StackAnchor;

  /** Manual sort position among root-level (non-stacked) habits — lower sorts first. */
  sortOrder: number;

  /** Free-form labels for filtering, e.g. "health", "morning". */
  tags: string[];

  createdAt: string;
  archived: boolean;
}

export interface CheckIn {
  id: string;
  habitId: string;
  date: ISODate;
  /** true if the full habit was done; if false but usedTwoMinuteVersion, the starter version counts as a vote. */
  completedFull: boolean;
  usedTwoMinuteVersion: boolean;
  /** Excused — doesn't count as a vote, but doesn't break a streak either. */
  skipped: boolean;
  /** Optional free-text journal entry for that day. */
  note: string;
  createdAt: string;
}

export type ScorecardRating = "+" | "-" | "=";

export interface ScorecardEntry {
  id: string;
  activity: string;
  rating: ScorecardRating;
  note: string;
  createdAt: string;
}
