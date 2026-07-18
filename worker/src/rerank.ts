/**
 * Second-stage reranking: narrow a wide BM25 candidate set down to the few sections the
 * answer will actually be grounded in.
 *
 * Ported from the Atli query pipeline (retrieve → rerank), which uses a dedicated Cohere
 * rerank model. DOTcompass is Anthropic-only and must stay cheap, so this reranks with one
 * small Haiku call instead: the model reads the question and the numbered candidates and
 * returns the positions of the genuinely relevant ones, best first. Lexical recall is good
 * at *finding* candidate sections but bad at *ordering* them; a reranker fixes the ordering,
 * which is what most improves the quality of the sections the answer step then sees.
 *
 * It fails safe: any error, or an unparseable response, falls back to the lexical top-k, so
 * a rerank hiccup degrades quality rather than breaking the request.
 */

import type Anthropic from "@anthropic-ai/sdk";

import { MODEL, estimateCostUsd } from "./rag";
import type { ScoredChunk } from "./retrieval";

const MAX_SNIPPET = 500; // chars per candidate shown to the reranker — enough to judge relevance

const RANK_TOOL: Anthropic.Tool = {
  name: "rank_sections",
  description:
    "Return the positions (from the numbered list) of the specification excerpts most " +
    "relevant to answering the question, most relevant first. Include only genuinely " +
    "relevant excerpts; omit the rest.",
  input_schema: {
    type: "object",
    required: ["indices"],
    properties: {
      indices: {
        type: "array",
        items: { type: "integer", minimum: 0 },
        description: "Positions of the most relevant excerpts, best first.",
      },
    },
  },
};

export interface RerankResult {
  chunks: ScoredChunk[];
  cost: number;
}

export async function rerank(
  client: Anthropic,
  question: string,
  candidates: ScoredChunk[],
  topK: number,
): Promise<RerankResult> {
  // Nothing to reorder — skip the call and its cost.
  if (candidates.length <= topK) return { chunks: candidates, cost: 0 };

  const list = candidates
    .map(
      (c, i) =>
        `[${i}] (${c.cite} — ${c.source}) ${c.text.replace(/\s+/g, " ").slice(0, MAX_SNIPPET)}`,
    )
    .join("\n\n");
  const prompt =
    `Question: ${question}\n\n` +
    `Numbered specification excerpts:\n\n${list}\n\n` +
    `Using rank_sections, return the positions of the up to ${topK} excerpts most relevant ` +
    `to answering the question, most relevant first.`;

  let cost = 0;
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      tools: [RANK_TOOL],
      tool_choice: { type: "tool", name: "rank_sections" },
      messages: [{ role: "user", content: prompt }],
    });
    cost = estimateCostUsd(res.usage.input_tokens, res.usage.output_tokens);

    const tool = res.content.find((b) => b.type === "tool_use");
    const raw = tool && tool.type === "tool_use" ? (tool.input as { indices?: unknown }).indices : null;
    const indices = Array.isArray(raw)
      ? raw.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < candidates.length)
      : [];

    const seen = new Set<number>();
    const picked: ScoredChunk[] = [];
    for (const i of indices) {
      if (seen.has(i)) continue;
      seen.add(i);
      picked.push(candidates[i]!);
      if (picked.length >= topK) break;
    }
    // Empty/garbage rerank -> keep lexical order rather than dropping everything.
    return { chunks: picked.length > 0 ? picked : candidates.slice(0, topK), cost };
  } catch (err) {
    console.error("rerank failed, using lexical order:", err);
    return { chunks: candidates.slice(0, topK), cost };
  }
}
