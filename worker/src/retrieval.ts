/**
 * Lexical candidate retrieval over the specification chunks, run inside the Worker.
 *
 * The Worker does its own retrieval — the client sends only a question — so the endpoint
 * can never be steered to summarize arbitrary text a caller supplies. Grounding always
 * comes from the real specifications.
 *
 * This is a compact BM25 ranker: it needs no model or vector store at query time, runs in
 * a couple of milliseconds over ~5k chunks, and is a strong first-stage filter. It casts a
 * WIDE net (a large candidate set) that a second-stage reranker then narrows to the few
 * chunks the answer is grounded in — the pattern ported from the Atli query pipeline
 * (retrieve → rerank), which is far more accurate than sending raw lexical top-k to the
 * model. BM25 beats plain term-overlap by rewarding term frequency while damping long
 * chunks and common terms.
 */

/** One retrieval chunk. Carries its source so an answer can cite the manual it came from. */
export interface Chunk {
  text: string;
  source: string; // manual title, e.g. "Construction Manual"
  sourceId: string; // M-number, e.g. "M 41-01"
  cite: string; // short label the model cites, e.g. "1-09.7" or "CM p.363"
  ref: string; // fuller section/heading, may be ""
  page: number; // page in the source PDF
  url: string; // source PDF url (client appends #page=N); unused when inApp
  inApp: boolean; // true -> the citation links to /section/<ref> in the app (Standard Specs)
}

export interface PreparedChunk {
  chunk: Chunk;
  /** Term frequencies within this chunk. */
  tf: Map<string, number>;
  /** Token count (document length), for BM25 length normalization. */
  len: number;
  /** Position in the corpus — the stable id shared with the Vectorize index, so a semantic
   *  hit (which returns this id) and a lexical hit fuse on the same key. */
  idx: number;
}

export interface ScoredChunk extends Chunk {
  score: number;
  idx: number;
}

// BM25 parameters. k1 controls term-frequency saturation; b controls length normalization.
const K1 = 1.5;
const B = 0.75;

// Common words carry no retrieval signal and would match almost everything.
const STOPWORDS = new Set(
  ("the a an and or of to in for on at by with as is are be shall must will this that " +
    "it its which when where all any each from within into per not no such other than " +
    "may can under over between if then so").split(" "),
);

/** Lowercased alphanumeric tokens of length >= 3, minus stopwords. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t),
  );
}

/** Precompute each chunk's term frequencies and length once, at corpus load. */
export function prepare(corpus: Chunk[]): PreparedChunk[] {
  return corpus.map((chunk, idx) => {
    const tokens = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk, tf, len: tokens.length, idx };
  });
}

/**
 * The top `k` chunks for a question by BM25. Returns fewer than `k` when little matches,
 * and nothing when nothing does — the caller treats an empty result as "not in the
 * specifications". `k` is intentionally large here: this is the recall stage that feeds a
 * reranker, not the final selection.
 */
export function retrieve(prepared: PreparedChunk[], question: string, k: number): ScoredChunk[] {
  const terms = [...new Set(tokenize(question))];
  if (terms.length === 0) return [];

  const N = prepared.length;
  const avgdl = prepared.reduce((sum, p) => sum + p.len, 0) / (N || 1);

  // Document frequency and BM25 IDF per query term (probabilistic IDF, floored at 0).
  const idf = new Map<string, number>();
  for (const term of terms) {
    let df = 0;
    for (const p of prepared) if (p.tf.has(term)) df++;
    idf.set(term, Math.max(0, Math.log(1 + (N - df + 0.5) / (df + 0.5))));
  }

  const scored: ScoredChunk[] = [];
  for (const p of prepared) {
    let score = 0;
    for (const term of terms) {
      const tf = p.tf.get(term);
      if (!tf) continue;
      const norm = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + (B * p.len) / avgdl);
      score += (idf.get(term) ?? 0) * (norm / denom);
    }
    if (score > 0) scored.push({ ...p.chunk, score, idx: p.idx });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
