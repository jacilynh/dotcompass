import { useState } from "react";

import type { SectionHistory } from "../types";
import { churnPhrase, eventDescription } from "../lib/format";
import { ConfidenceNote, EventBadge } from "./badges";
import { DiffView } from "./DiffView";

/**
 * The centerpiece: a section's whole life as a vertical timeline, newest at the top.
 * Revisions expand to show exactly what changed that year; vacations show what the
 * section used to say. This is the thing the printed book cannot tell you.
 */
export function Timeline({ history }: { history: SectionHistory }) {
  const events = [...history.timeline].reverse(); // newest first

  return (
    <ol className="relative space-y-1">
      {/* the spine of the timeline */}
      <span className="absolute left-[6px] top-2 bottom-2 w-px bg-border" aria-hidden />
      {events.map((event, i) => (
        <TimelineRow key={`${event.year}-${event.event}-${i}`} event={event} />
      ))}
    </ol>
  );
}

function TimelineRow({ event }: { event: SectionHistory["timeline"][number] }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(event.diff?.length || event.was);

  return (
    <li className="relative pl-7">
      <span
        className="absolute left-0 top-[7px] h-[13px] w-[13px] rounded-full border-2 border-bg bg-accent"
        aria-hidden
      />
      <div className="rounded-lg border border-transparent px-2 py-2 hover:border-border">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-sm font-semibold text-ink">{event.year}</span>
          <EventBadge event={event.event} />
          {event.event === "revised" && event.churn !== undefined && (
            <span className="text-xs text-muted">— {churnPhrase(event.churn)}</span>
          )}
          <ConfidenceNote year={event.year} />
          {hasDetail && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="ml-auto text-xs text-accent hover:underline"
            >
              {open ? "Hide" : event.was ? "Show struck text" : "Show change"}
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-faint">{eventDescription(event.event)}</p>

        {open && event.diff && (
          <div className="mt-3 rounded-md bg-raised p-3">
            <DiffView ops={event.diff} />
          </div>
        )}
        {open && event.was && (
          <blockquote className="mt-3 border-l-2 border-vacated/50 bg-raised p-3 font-serif text-sm italic leading-6 text-muted">
            “{event.was}
            {event.was.length >= 400 ? "…" : ""}”
          </blockquote>
        )}
      </div>
    </li>
  );
}
