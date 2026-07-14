import type { IndexEntry } from "../types";

/**
 * The document scanner's engine: find every WSDOT section number cited in a pasted
 * draft and classify each against the current specifications. It is deterministic and
 * runs entirely in the browser — nothing is sent anywhere, which for pre-bid draft
 * provisions is the whole point.
 *
 * The checks are rule-based rather than AI-driven on purpose: a false "this section was
 * struck" would be worse than useless to an engineer, so the tool only says what it can
 * prove from the data.
 */

// A WSDOT section number: division-dash-two-digits, then optional .decimal, then any
// number of (n) sub-parts, then an optional trailing letter — e.g. 1-09.7, 8-21.3(9)F.
// The two-digit requirement after the dash is what keeps this from matching dates,
// dimensions, or phone numbers in the surrounding prose.
const CITATION = /\b(\d-\d{2}(?:\.\d+)?(?:\([0-9A-Za-z]+\))*[A-Z]?)\b/g;

export type CitationStatus = "valid" | "vacant" | "removed" | "unknown";

export interface Finding {
  num: string;
  status: CitationStatus;
  title?: string;
  lastSeen?: number; // removed sections: the last edition they appeared in
  count: number; // how many times it appears in the draft
}

/** Every distinct section number mentioned in the text, with how often it occurs. */
export function extractCitations(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(CITATION)) {
    const num = match[1]!;
    counts.set(num, (counts.get(num) ?? 0) + 1);
  }
  return counts;
}

/**
 * Classify each cited section against the current edition.
 *   valid    present in the latest edition with text
 *   vacant   present but struck (number reserved, no text) — citing it is stale
 *   removed  was a real section but is gone from the latest edition — citing it is stale
 *   unknown  never appeared in any parsed edition — most likely a typo
 */
export function scanDraft(
  text: string,
  sections: IndexEntry[],
  removed: Record<string, number> = {},
): Finding[] {
  const byNum = new Map(sections.map((s) => [s.num, s]));
  const findings: Finding[] = [];

  for (const [num, count] of extractCitations(text)) {
    const entry = byNum.get(num);
    if (entry) {
      findings.push({ num, status: entry.vacant ? "vacant" : "valid", title: entry.title, count });
    } else if (num in removed) {
      findings.push({ num, status: "removed", lastSeen: removed[num], count });
    } else {
      findings.push({ num, status: "unknown", count });
    }
  }

  // Problems first, then valid; within a group, book order. The UI leads with what
  // needs attention.
  const severity: Record<CitationStatus, number> = { vacant: 0, removed: 1, unknown: 2, valid: 3 };
  findings.sort((a, b) => severity[a.status] - severity[b.status] || (a.num < b.num ? -1 : 1));
  return findings;
}

/** Counts by status, for the summary line. */
export function summarize(findings: Finding[]): Record<CitationStatus, number> {
  const totals: Record<CitationStatus, number> = { valid: 0, vacant: 0, removed: 0, unknown: 0 };
  for (const f of findings) totals[f.status] += 1;
  return totals;
}
