import type { EventKind } from "../types";
import { EVENT_LABEL, isLowerConfidence } from "../lib/format";

/** Colored dot + label for a timeline event. */
export function EventBadge({ event }: { event: EventKind }) {
  const styles: Record<EventKind, string> = {
    introduced: "bg-accent/15 text-accent",
    revised: "bg-vacated/15 text-vacated",
    vacated: "bg-removed/15 text-removed",
    restored: "bg-added/15 text-added",
    removed: "bg-removed/15 text-removed",
    reinstated: "bg-added/15 text-added",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[event]}`}
    >
      {EVENT_LABEL[event]}
    </span>
  );
}

/** "Vacant" pill for struck sections. */
export function VacantBadge() {
  return (
    <span className="inline-flex items-center rounded bg-vacated/15 px-2 py-0.5 text-xs font-medium text-vacated">
      Vacant
    </span>
  );
}

/**
 * Marker for data drawn from a pre-2010 edition, which parses least reliably. Being
 * explicit about lower-confidence data is a first-class requirement here — the tool's
 * credibility rests on not overstating what it knows.
 */
export function ConfidenceNote({ year }: { year: number }) {
  if (!isLowerConfidence(year)) return null;
  return (
    <span
      className="ml-1 cursor-help text-xs text-faint"
      title="Editions before 2010 parse less reliably; treat this as lower-confidence."
    >
      (lower confidence)
    </span>
  );
}
