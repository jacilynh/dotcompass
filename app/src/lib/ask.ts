/**
 * Client side of Ask-the-Specs: call the Worker, and turn its answer's inline citations
 * into linkable segments. The Worker is optional — when it isn't configured or is over its
 * spend cap, the Ask page falls back to keyword search, so the feature degrades instead of
 * breaking.
 */

/** The deployed Worker URL, or undefined when the AI feature isn't configured. */
export const ASK_URL = import.meta.env.VITE_ASK_URL as string | undefined;

export type Confidence = "low" | "medium" | "high";

/** One cited excerpt, tagged with the manual it came from so the UI can name and link it. */
export interface Citation {
  id: number; // the bracketed number the model cited, [id]
  cite: string; // the label shown, e.g. "1-09.7" or "CM p.363"
  source: string; // manual title, e.g. "Construction Manual"
  sourceId: string; // M-number, e.g. "M 41-01"
  ref: string; // section/heading within the manual
  page: number; // page in the source PDF
  url: string; // source PDF (we append #page=N); unused when inApp
  inApp: boolean; // true -> links to /section/<ref> in the app (Standard Specs)
}

export interface AskAnswer {
  kind: "answer";
  answer: string;
  citations: Citation[];
  /** Distinct manuals cited, e.g. ["Standard Specifications (M 41-10)"]. */
  sources: string[];
  /** How well the retrieved excerpts support the answer (from the Worker). */
  confidence?: Confidence;
  /** What the excerpts don't establish, or where to verify (from the Worker). */
  caveats: string[];
}

/** The href for a citation: an in-app section page, or the source PDF at the right page. */
export function citationHref(c: Citation): string {
  return c.inApp ? `#/section/${c.ref}` : `${c.url}#page=${c.page}`;
}
export type AskResult =
  | AskAnswer
  | { kind: "capped" } // monthly spend cap reached; fall back to search
  | { kind: "unavailable"; reason: string }; // not configured, network/error

export async function askWorker(question: string): Promise<AskResult> {
  if (!ASK_URL) return { kind: "unavailable", reason: "not configured" };
  try {
    const res = await fetch(ASK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return { kind: "unavailable", reason: `service error (${res.status})` };
    const data = await res.json();
    if (data.capped) return { kind: "capped" };
    if (typeof data.answer === "string") {
      const confidence: Confidence | undefined =
        data.confidence === "low" || data.confidence === "medium" || data.confidence === "high"
          ? data.confidence
          : undefined;
      return {
        kind: "answer",
        answer: data.answer,
        citations: Array.isArray(data.citations) ? (data.citations as Citation[]) : [],
        sources: Array.isArray(data.sources) ? data.sources : [],
        ...(confidence ? { confidence } : {}),
        caveats: Array.isArray(data.caveats) ? data.caveats : [],
      };
    }
    return { kind: "unavailable", reason: "unexpected response" };
  } catch {
    return { kind: "unavailable", reason: "network error" };
  }
}

export type AnswerSegment = { text: string } | { cite: Citation };

/**
 * Split an answer into plain-text and citation segments so the UI can render each inline
 * `[label]` as a link to its source. A bracketed token becomes a citation only if it matches
 * one of the answer's citation labels (which can be section numbers like `1-09.7` or manual
 * cites like `CM p.363`); anything else stays literal text.
 */
export function splitCitations(answer: string, citations: Citation[]): AnswerSegment[] {
  const byId = new Map(citations.map((c) => [c.id, c]));
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const cite = byId.get(Number(m[1]));
    if (!cite) continue; // not one of our citation numbers — leave the brackets as text
    if (m.index > last) segments.push({ text: answer.slice(last, m.index) });
    segments.push({ cite });
    last = m.index + m[0].length;
  }
  if (last < answer.length) segments.push({ text: answer.slice(last) });
  return segments;
}
