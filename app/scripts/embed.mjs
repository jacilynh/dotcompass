/**
 * Precompute semantic-search embeddings for the specification chunks, and self-host the
 * model the browser will use to embed queries.
 *
 * Run from app/:  npm run embed   (after `make app-data` has produced ask-corpus.json)
 *
 * Why this is a JavaScript build step and not pipeline/embed.py: semantic search only
 * works if the passage vectors (computed here) and the query vector (computed in the
 * browser) come from the *identical* model, tokenizer, and quantization. Using the same
 * `@huggingface/transformers` package on both sides guarantees that; a Python encoder and
 * a JS query encoder would silently drift and rank badly.
 *
 * Outputs into app/public/data:
 *   embeddings.bin    int8 matrix, count x 384, row i = chunk i
 *   embeddings.json   { count, dims, scale, sections[] }  (row i -> its section number)
 * And into app/public/models: the quantized model + tokenizer, so the browser loads it
 * same-origin with no external request (the locked-down-machine requirement).
 */

import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pipeline } from "@huggingface/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const DIMS = 384;
const BATCH = 128;

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "public", "data");
const modelsDir = join(here, "..", "public", "models");

const corpus = JSON.parse(readFileSync(join(dataDir, "ask-corpus.json"), "utf8"));
console.log(`embedding ${corpus.length.toLocaleString()} chunks with ${MODEL} (q8)…`);

const embed = await pipeline("feature-extraction", MODEL, { dtype: "q8" });

// Embed in batches; collect L2-normalized float vectors.
const vectors = new Float32Array(corpus.length * DIMS);
for (let i = 0; i < corpus.length; i += BATCH) {
  const batch = corpus.slice(i, i + BATCH).map((c) => c.text);
  const out = await embed(batch, { pooling: "mean", normalize: true });
  vectors.set(out.data, i * DIMS);
  if (i % (BATCH * 10) === 0) process.stdout.write(`  ${i}/${corpus.length}\r`);
}
console.log(`  ${corpus.length}/${corpus.length} embedded        `);

// Quantize to int8. The vectors are unit-length, so components are small; scaling by
// 127/maxAbs uses the full int8 range and keeps quantization error low. A single global
// scale preserves cosine ranking: score = dot(queryFloat, passageInt8) is the true cosine
// times a constant, so the order is unchanged and the query needs no dequantization.
let maxAbs = 0;
for (const v of vectors) maxAbs = Math.max(maxAbs, Math.abs(v));
const scale = 127 / maxAbs;

const quantized = new Int8Array(vectors.length);
for (let i = 0; i < vectors.length; i++) {
  quantized[i] = Math.max(-127, Math.min(127, Math.round(vectors[i] * scale)));
}

writeFileSync(join(dataDir, "embeddings.bin"), Buffer.from(quantized.buffer));
writeFileSync(
  join(dataDir, "embeddings.json"),
  JSON.stringify({
    count: corpus.length,
    dims: DIMS,
    scale,
    model: MODEL,
    sections: corpus.map((c) => c.section),
  }),
);

// Self-host the model so the browser fetches it from our own origin.
const cache = join(here, "..", "node_modules", "@huggingface", "transformers", ".cache", MODEL);
const dest = join(modelsDir, MODEL);
mkdirSync(dirname(dest), { recursive: true });
cpSync(cache, dest, { recursive: true });

// Self-host the ONNX runtime WASM too, so the whole feature works with no external
// request — the locked-down-machine audience can't reach a CDN. onnxruntime-web 1.22 ships
// a unified "jsep" build; that's the loader transformers.js imports, and it runs the WASM
// backend fine at numThreads=1 (it just also *could* use WebGPU, which we don't enable —
// avoiding SharedArrayBuffer / COOP-COEP headers GitHub Pages doesn't set).
const ortDist = join(here, "..", "node_modules", "onnxruntime-web", "dist");
const ortDest = join(here, "..", "public", "ort");
mkdirSync(ortDest, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.mjs"]) {
  cpSync(join(ortDist, f), join(ortDest, f));
}

const mb = (quantized.length / 1e6).toFixed(1);
console.log(`wrote embeddings.bin (${mb} MB int8) + embeddings.json`);
console.log(`self-hosted ${MODEL} and the ONNX runtime into public/models + public/ort`);
