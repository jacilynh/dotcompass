/**
 * Embed the Ask corpus for semantic retrieval, into an NDJSON file Vectorize can ingest.
 *
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... node pipeline/embed_corpus.mjs \
 *       app/public/data/ask-corpus.json pipeline/ask-vectors.ndjson
 *
 * Embeds every chunk with the SAME Workers AI model the Worker uses at query time
 * (@cf/baai/bge-base-en-v1.5), so the vectors are comparable. Passages are embedded without
 * the query instruction prefix (bge is asymmetric — the Worker adds the prefix to questions
 * only). Each vector's id is the chunk's position in the corpus, the key the Worker fuses on.
 *
 * Run after the corpus changes (new manuals), then `wrangler vectorize insert`. See `make
 * index-ask`. Cost is a one-time, tiny Workers AI charge (~$0.04 at 18k chunks); query-time
 * embedding is one short string per question.
 */

import { createWriteStream, readFileSync } from "node:fs";

const [, , corpusPath, outPath] = process.argv;
const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;
if (!corpusPath || !outPath || !ACCOUNT || !TOKEN) {
  console.error("usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node embed_corpus.mjs <corpus.json> <out.ndjson>");
  process.exit(1);
}

const MODEL = "@cf/baai/bge-base-en-v1.5";
const BATCH = 100; // texts per Workers AI call

async function embed(texts) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(`AI run failed: ${JSON.stringify(body.errors)}`);
  return body.result.data;
}

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const out = createWriteStream(outPath);
let done = 0;

for (let i = 0; i < corpus.length; i += BATCH) {
  const slice = corpus.slice(i, i + BATCH);
  let vectors;
  for (let attempt = 0; ; attempt++) {
    try {
      vectors = await embed(slice.map((c) => c.text));
      break;
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  for (let j = 0; j < slice.length; j++) {
    // Round to 6 decimals to keep the NDJSON compact; well within cosine's tolerance.
    const values = vectors[j].map((v) => Math.round(v * 1e6) / 1e6);
    out.write(`${JSON.stringify({ id: String(i + j), values })}\n`);
  }
  done += slice.length;
  process.stderr.write(`  embedded ${done}/${corpus.length}\r`);
}

out.end();
process.stderr.write(`\nwrote ${corpus.length} vectors to ${outPath}\n`);
