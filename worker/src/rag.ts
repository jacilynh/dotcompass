/**
 * The prompt, guardrails, and cost accounting for grounded question answering — kept as
 * pure functions so they can be tested without an API key or network.
 */

import type Anthropic from "@anthropic-ai/sdk";

import type { ScoredChunk } from "./retrieval";

export const MODEL = "claude-haiku-4-5";
export const MAX_TOKENS = 1024;

// Haiku 4.5 pricing (USD per million tokens). Used for the hard monthly spend cap.
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

export const SYSTEM_PROMPT = [
  "You answer questions about the WSDOT manuals (the Standard Specifications and the core",
  "construction/engineering manuals) using ONLY the excerpts provided in the user message,",
  "each labelled with its source manual and page. Rules:",
  "- Base every statement solely on the provided excerpts. Never use outside knowledge.",
  "- Cite the excerpt you rely on inline, in square brackets, by its NUMBER, e.g. [1] or [3].",
  "  Cite often — every factual claim must carry at least one citation. When it aids clarity,",
  '  also name the manual in prose (e.g. "the Construction Manual requires...").',
  "- Different manuals can conflict or address the same topic differently; attribute claims",
  "  to the manual they come from rather than blending them.",
  "- If the excerpts do not contain the answer, say so plainly in `answer` and set",
  '  confidence to "low". Put what the excerpts do NOT establish, or where the reader must',
  "  verify against the full manual, in `caveats` — never bluff to fill a gap.",
  "- Set `confidence`: high when the excerpts answer the question directly and completely;",
  "  medium when partially or by inference; low when support is thin.",
  "- Be concise and precise. This is a reference, not a chat. Respond by calling the",
  "  submit_answer tool. You are unofficial and advisory.",
].join("\n");

/** One structured, grounded answer, emitted via the submit_answer tool. */
export interface StructuredAnswer {
  answer: string; // prose with inline [section] citations
  citations: string[]; // section numbers relied upon, e.g. "1-09.7"
  confidence: "low" | "medium" | "high";
  caveats: string[]; // what the sections don't establish / where to verify
}

/**
 * Forcing the answer through a tool schema (with tool_choice) makes grounding structural,
 * not stylistic: the model must return citations, a confidence level, and caveats as data,
 * rather than us scraping them out of free text. Ported from Atli's submit_answer pattern.
 */
export const SUBMIT_ANSWER_TOOL: Anthropic.Tool = {
  name: "submit_answer",
  description:
    "Answer the question using ONLY the supplied numbered manual excerpts. Cite each excerpt " +
    "you rely on inline in `answer` by its bracketed number, and list those numbers in " +
    "`citations`. State uncertainty in `caveats` rather than guessing.",
  input_schema: {
    type: "object",
    required: ["answer", "citations", "confidence", "caveats"],
    properties: {
      answer: {
        type: "string",
        minLength: 1,
        description: "The answer, with inline citations by excerpt number, e.g. [1] or [3].",
      },
      citations: {
        type: "array",
        items: { type: "integer" },
        description: "The excerpt numbers relied upon, e.g. [1, 3].",
      },
      confidence: { enum: ["low", "medium", "high"] },
      caveats: {
        type: "array",
        items: { type: "string" },
        description: "What the sections do not establish, or where the reader must verify.",
      },
    },
  },
};

/** Assemble the user message: the question, then the retrieved excerpts NUMBERED [1]..[N],
 *  each tagged with the manual and page it came from. Numbering (rather than asking the model
 *  to reproduce labels like "CM p.363") is what makes citations reliable — the model only has
 *  to echo a bracketed integer, which it does exactly. The number maps back to the source. */
export function buildUserMessage(question: string, chunks: ScoredChunk[]): string {
  const evidence = chunks
    .map((c, i) => {
      const where = c.inApp
        ? `${c.source} (${c.sourceId}), section ${c.cite}`
        : `${c.source} (${c.sourceId}), p.${c.page}`;
      return `[${i + 1}] ${where}\n${c.text}`;
    })
    .join("\n\n---\n\n");
  return (
    `Question: ${question}\n\n` +
    `Numbered excerpts from the WSDOT manuals — cite each one you rely on by its bracketed ` +
    `number (e.g. [1], [3]):\n\n${evidence}`
  );
}

/** The excerpt numbers the model actually cited, restricted to ones we supplied (so a
 *  hallucinated citation is dropped). `supplied` is the set of valid numbers as strings. */
export function citedLabels(answer: string, supplied: string[]): string[] {
  const allowed = new Set(supplied);
  const cited = new Set<string>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    if (allowed.has(m[1]!)) cited.add(m[1]!);
  }
  return [...cited];
}

/** Cost of one call in USD, from the response usage. Drives the spend cap. */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_PER_MTOK + outputTokens * OUTPUT_PER_MTOK) / 1_000_000;
}

export interface QuestionCheck {
  ok: boolean;
  reason?: string;
}

/** A question must be a non-empty, reasonably short string — nothing document-sized. */
export function validateQuestion(value: unknown): QuestionCheck {
  if (typeof value !== "string") return { ok: false, reason: "question must be a string" };
  const q = value.trim();
  if (q.length < 3) return { ok: false, reason: "question is too short" };
  if (q.length > 500) return { ok: false, reason: "question is too long (500 char max)" };
  return { ok: true };
}
