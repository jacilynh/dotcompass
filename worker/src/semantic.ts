/**
 * The semantic arm of hybrid retrieval: embed the question with Workers AI, find the nearest
 * chunks in Vectorize, and fuse that ranking with BM25's.
 *
 * BM25 is precise on shared terms but blind to paraphrase — "how wide is a travel lane" and
 * "traveled way width" share almost no rare words. A semantic embedding matches by meaning, so
 * it surfaces the definitional section BM25 misses. Fusing the two (Reciprocal Rank Fusion)
 * keeps BM25's precision and adds semantic recall.
 *
 * Everything here fails safe: if the embedding or the vector query errors, it returns nothing
 * and the caller proceeds with BM25 alone — semantic retrieval is an enhancement, not a
 * dependency. The Vectorize index is keyed by each chunk's corpus position (`idx`), the same
 * key BM25 hits carry, so the two rankings fuse directly.
 */

import type { PreparedChunk, ScoredChunk } from "./retrieval";

export const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
// bge-*-en-v1.5 is asymmetric: the query gets a retrieval instruction, passages do not. The
// corpus is embedded without it (see pipeline/embed_corpus.mjs), so only queries add it here.
const QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: ";
const RRF_K = 60; // Reciprocal Rank Fusion constant; higher flattens the rank weighting

/** The Cloudflare bindings this module needs, typed minimally so it doesn't depend on a
 *  particular @cloudflare/workers-types version. */
export interface SemanticEnv {
  AI: { run: (model: string, input: { text: string[] }) => Promise<{ data?: number[][] }> };
  VECTORIZE: {
    query: (
      vector: number[],
      opts: { topK: number },
    ) => Promise<{ matches?: Array<{ id: string; score: number }> }>;
  };
}

/** Embed the question, or null if Workers AI is unavailable (caller falls back to BM25). */
export async function embedQuery(env: SemanticEnv, question: string): Promise<number[] | null> {
  try {
    const res = await env.AI.run(EMBED_MODEL, { text: [QUERY_INSTRUCTION + question] });
    const vector = res?.data?.[0];
    return Array.isArray(vector) ? vector : null;
  } catch (err) {
    console.error("query embedding failed:", err);
    return null;
  }
}

/** The nearest `topK` corpus chunks to the query vector, as ScoredChunks (score = similarity). */
export async function semanticSearch(
  env: SemanticEnv,
  queryVector: number[],
  prepared: PreparedChunk[],
  topK: number,
): Promise<ScoredChunk[]> {
  try {
    const res = await env.VECTORIZE.query(queryVector, { topK });
    const hits: ScoredChunk[] = [];
    for (const match of res.matches ?? []) {
      const idx = Number(match.id);
      const p = prepared[idx];
      if (p) hits.push({ ...p.chunk, score: match.score, idx });
    }
    return hits;
  } catch (err) {
    console.error("vectorize query failed:", err);
    return [];
  }
}

/** Reciprocal Rank Fusion of ranked lists, keyed by chunk position. A chunk high in either
 *  list rises; a chunk high in both rises most. */
export function fuse(lists: ScoredChunk[][], limit: number): ScoredChunk[] {
  const score = new Map<number, number>();
  const byIdx = new Map<number, ScoredChunk>();
  for (const list of lists) {
    list.forEach((chunk, rank) => {
      score.set(chunk.idx, (score.get(chunk.idx) ?? 0) + 1 / (RRF_K + rank + 1));
      if (!byIdx.has(chunk.idx)) byIdx.set(chunk.idx, chunk);
    });
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([idx, fused]) => ({ ...byIdx.get(idx)!, score: fused }));
}
