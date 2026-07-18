/**
 * Client side of Ask-the-Specs: call the Worker, and turn its answer's inline citations
 * into linkable segments. The Worker is optional — when it isn't configured or is over its
 * spend cap, the Ask page falls back to keyword search, so the feature degrades instead of
 * breaking.
 */

/** The deployed Worker URL, or undefined when the AI feature isn't configured. */
export const ASK_URL = import.meta.env.VITE_ASK_URL as string | undefined;

export type Confidence = "low" | "medium" | "high";

export interface AskAnswer {
  kind: "answer";
  answer: string;
  citations: string[];
  sections: string[];
  /** How well the retrieved sections support the answer (from the Worker). */
  confidence?: Confidence;
  /** What the sections don't establish, or where to verify (from the Worker). */
  caveats: string[];
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
        citations: data.citations ?? [],
        sections: data.sections ?? [],
        ...(confidence ? { confidence } : {}),
        caveats: Array.isArray(data.caveats) ? data.caveats : [],
      };
    }
    return { kind: "unavailable", reason: "unexpected response" };
  } catch {
    return { kind: "unavailable", reason: "network error" };
  }
}

export type AnswerSegment = { text: string } | { cite: string };

/**
 * Split an answer into plain-text and citation segments so the UI can render `[1-09.7]`
 * as a link to that section. Only bracketed section numbers become citations.
 */
export function splitCitations(answer: string): AnswerSegment[] {
  const pattern = /\[(\d-\d{2}(?:\.\d+)?(?:\([0-9A-Za-z]+\))*[A-Z]?)\]/g;
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const m of answer.matchAll(pattern)) {
    if (m.index > last) segments.push({ text: answer.slice(last, m.index) });
    segments.push({ cite: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < answer.length) segments.push({ text: answer.slice(last) });
  return segments;
}
