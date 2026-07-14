import type { EventKind } from "../types";

/** Split a section's stored text into paragraphs for readable rendering. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\n(?=\d-\d)/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Human phrasing for each timeline event. */
export const EVENT_LABEL: Record<EventKind, string> = {
  introduced: "Introduced",
  revised: "Revised",
  vacated: "Vacated",
  restored: "Restored",
  removed: "Removed",
  reinstated: "Reinstated",
};

/** A one-line gloss shown under each event. */
export function eventDescription(event: EventKind): string {
  switch (event) {
    case "introduced":
      return "First appeared in the specifications.";
    case "revised":
      return "The section text was changed.";
    case "vacated":
      return "Struck from the book — the number was kept but its text removed.";
    case "restored":
      return "Text returned after the section had been vacant.";
    case "removed":
      return "The section number left the book entirely.";
    case "reinstated":
      return "The number reappeared after having been removed.";
  }
}

/** "a quarter of the words changed" style phrasing from a churn fraction. */
export function churnPhrase(churn: number): string {
  const pct = Math.round(churn * 100);
  if (pct <= 0) return "a formatting-only change";
  if (pct < 5) return "a small wording change";
  if (pct < 25) return `about ${pct}% of the words changed`;
  if (pct < 75) return `roughly ${pct}% rewritten`;
  return "almost entirely rewritten";
}

/** Pre-2010 editions parse least reliably; the UI flags their data as lower-confidence. */
export const CONFIDENCE_CUTOFF = 2010;
export const isLowerConfidence = (year: number) => year < CONFIDENCE_CUTOFF;
