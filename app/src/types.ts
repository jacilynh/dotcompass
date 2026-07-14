/** Shapes of the JSON emitted by pipeline/build_app_data.py. Keep in sync with it. */

export interface Stats {
  everPublished: number;
  live: number;
  vacant: number;
  sinceStart: number;
  newInLatest: number;
  revisions: number;
  editions: number[];
  latest: number;
  earliest: number;
}

export interface Division {
  n: number;
  title: string;
}

/** One row in the lightweight index — enough to draw the tree and search titles. */
export interface IndexEntry {
  num: string;
  division: number;
  title: string;
  vacant: boolean;
}

export interface Index {
  stats: Stats;
  divisions: Division[];
  sections: IndexEntry[];
  /** Section numbers gone from the latest edition, mapped to the last year they appeared. */
  removed: Record<string, number>;
}

/** The current (latest-edition) full text of a section, from sections/<d>.json. */
export interface SectionText {
  title: string;
  text: string;
  vacant: boolean;
  page: number;
}

/** One word-level change within a revision. */
export interface DiffOp {
  op: "replace" | "insert" | "delete";
  old: string;
  new: string;
}

export type EventKind =
  | "introduced"
  | "revised"
  | "vacated"
  | "restored"
  | "removed"
  | "reinstated";

/** One event in a section's life, from history/<d>.json. */
export interface TimelineEvent {
  year: number;
  event: EventKind;
  churn?: number; // revisions only: fraction of words changed
  diff?: DiffOp[]; // revisions only: what changed
  was?: string; // vacations only: what the section used to say
}

export interface SectionHistory {
  title: string;
  firstSeen: number;
  lastSeen: number;
  current: boolean;
  vacantNow: boolean;
  timeline: TimelineEvent[];
}
