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
  "You answer questions about the WSDOT Standard Specifications (M 41-10) using ONLY the",
  "numbered specification sections provided in the user message. Rules:",
  "- Base every statement solely on the provided sections. Never use outside knowledge.",
  "- Cite the section you rely on inline, in square brackets, e.g. [1-09.7]. Cite often —",
  "  every factual claim must carry at least one citation to a supplied section.",
  "- If the provided sections do not contain the answer, say so plainly in `answer` (e.g.",
  '  "I could not find that in the provided sections") and set confidence to "low".',
  "- Put what the sections do NOT establish, or where the reader must verify against the",
  "  full manual, in `caveats` — never bluff to fill a gap.",
  "- Set `confidence`: high when the sections answer the question directly and completely;",
  "  medium when they answer it partially or by inference; low when support is thin.",
  "- Be concise and precise. This is a reference, not a chat. Do not speculate.",
  "- Respond by calling the submit_answer tool. You are unofficial and advisory.",
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
    "Answer the question using ONLY the supplied specification sections. Cite each section " +
    "you rely on inline in `answer` as [section-number], and list those numbers in " +
    "`citations`. State uncertainty in `caveats` rather than guessing.",
  input_schema: {
    type: "object",
    required: ["answer", "citations", "confidence", "caveats"],
    properties: {
      answer: {
        type: "string",
        minLength: 1,
        description: "The answer, with inline [1-09.7]-style citations to supplied sections.",
      },
      citations: {
        type: "array",
        items: { type: "string" },
        description: "Section numbers relied upon, e.g. [\"1-09.7\", \"2-01.5\"].",
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

/** Assemble the user message: the question, then the retrieved sections as evidence. */
export function buildUserMessage(question: string, chunks: ScoredChunk[]): string {
  const evidence = chunks
    .map((c) => `[${c.section}]\n${c.text}`)
    .join("\n\n---\n\n");
  return `Question: ${question}\n\nSpecification sections:\n\n${evidence}`;
}

/** Section numbers the model cited that were actually among the ones we supplied. */
export function citedSections(answer: string, supplied: string[]): string[] {
  const allowed = new Set(supplied);
  const cited = new Set<string>();
  for (const m of answer.matchAll(/\[(\d-\d{2}(?:\.\d+)?(?:\([0-9A-Za-z]+\))*[A-Z]?)\]/g)) {
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
