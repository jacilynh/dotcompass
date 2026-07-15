/**
 * In-browser semantic search over the specification chunks.
 *
 * Everything here is lazy and optional. The model (~23 MB) and the ONNX runtime (~11 MB)
 * load only when semantic search is first used, and only ever from our own origin — no
 * external request, so it works on locked-down machines. If anything fails to load, the
 * caller falls back to keyword search: semantic is a progressive enhancement, never a
 * requirement.
 *
 * The passage vectors were precomputed by scripts/embed.mjs with the SAME model and
 * quantization, so the query vector produced here is directly comparable to them.
 */

interface EmbeddingsMeta {
  count: number;
  dims: number;
  scale: number;
  model: string;
  sections: string[]; // row i -> the section that chunk i belongs to
}

export interface SemanticHit {
  section: string;
  score: number;
}

// A feature-extraction pipeline; typed loosely to avoid importing transformers.js types
// into the main bundle. It maps text -> a normalized float32 embedding.
type Embedder = (
  texts: string[],
  opts: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array }>;

interface Engine {
  embed: Embedder;
  vectors: Int8Array;
  meta: EmbeddingsMeta;
}

let enginePromise: Promise<Engine> | null = null;

/** Load the model, runtime, and precomputed vectors once. Rejects if unavailable. */
function loadEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = init().catch((err) => {
      enginePromise = null; // allow a later retry after a transient failure
      throw err;
    });
  }
  return enginePromise;
}

async function init(): Promise<Engine> {
  const base = import.meta.env.BASE_URL;

  // Dynamic import keeps transformers.js out of the main bundle — it's only pulled in
  // when someone actually runs a semantic search.
  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowLocalModels = true; // load from our own origin (public/models)…
  env.allowRemoteModels = false; // …and never reach out to a CDN
  env.localModelPath = new URL(`${base}models/`, location.href).href;
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1; // single-threaded: no SharedArrayBuffer -> no COOP/COEP needed
    wasm.wasmPaths = new URL(`${base}ort/`, location.href).href; // self-hosted runtime
  }

  const [meta, buffer, embedder] = await Promise.all([
    fetch(`${base}data/embeddings.json`).then((r) => r.json() as Promise<EmbeddingsMeta>),
    fetch(`${base}data/embeddings.bin`).then((r) => r.arrayBuffer()),
    pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" }),
  ]);

  return { embed: embedder as unknown as Embedder, vectors: new Int8Array(buffer), meta };
}

/**
 * Top-k sections for a query by cosine similarity. Chunks are scored, then collapsed to
 * their best-scoring section. Because both sides are unit-normalized and the passages were
 * quantized with one global scale, the raw dot product ranks identically to true cosine.
 */
export async function semanticSearch(query: string, k = 10): Promise<SemanticHit[]> {
  const { embed, vectors, meta } = await loadEngine();
  const out = await embed([query], { pooling: "mean", normalize: true });
  const q = out.data;
  const { dims, count, sections } = meta;

  const bestBySection = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    let dot = 0;
    const base = i * dims;
    for (let j = 0; j < dims; j++) dot += q[j]! * vectors[base + j]!;
    const section = sections[i]!;
    const prev = bestBySection.get(section);
    if (prev === undefined || dot > prev) bestBySection.set(section, dot);
  }

  return [...bestBySection.entries()]
    .map(([section, score]) => ({ section, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
