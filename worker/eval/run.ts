/**
 * Ask eval harness — measures retrieval and answer quality against the gold set in
 * `cases.ts`, so changes to BM25, the reranker, or the prompt can be judged by numbers
 * instead of vibes. Adapted from Atli's retrieval-eval (packages/skills/atli-query/scripts).
 *
 * Modes:
 *   (default)   Retrieval recall only. FREE, no API key — the fast inner-loop metric.
 *               Reports Recall@24 (BM25 candidates) and Recall@6 (lexical top-6, rerank OFF).
 *   --rerank    Also runs the Haiku reranker and reports Recall@6 (reranked) + MRR, so you
 *               can see the lift reranking gives. Needs ANTHROPIC_API_KEY (a few cheap calls).
 *   --answer    End-to-end against the deployed Worker (ASK_URL): does the answer CITE an
 *               expected section, and do out-of-scope questions correctly get refused / low
 *               confidence. Costs real (capped) spend — run sparingly.
 *
 * Usage:
 *   make eval                 # retrieval recall (free)
 *   make eval ARGS=--rerank   # + reranker lift  (needs ANTHROPIC_API_KEY)
 *   make eval ARGS=--answer   # + end-to-end     (hits the live Worker)
 *
 * Exits non-zero when recall (or, in --answer mode, citation accuracy) falls below the
 * thresholds below, so it can gate changes in CI.
 */

import { type ScoredChunk, prepare, retrieve } from "../src/retrieval";
import { type EvalCase, CASES } from "./cases";

const CORPUS_URL = process.env.CORPUS_URL ?? "https://dotcompass.dev/data/ask-corpus.json";
const ASK_URL = process.env.ASK_URL ?? "https://wsdot-ask-the-specs.jacihayden.workers.dev/";
const CANDIDATE_K = 24; // must match the Worker's retrieval width
const FINAL_K = 6; // must match the Worker's post-rerank cut

const RECALL_THRESHOLD = 0.8; // fail the run below this (tune as the gold set grows)
const CITATION_THRESHOLD = 0.7;

/** 1-based rank of the first chunk whose section matches any expected prefix; 0 if none. */
function matchRank(chunks: Array<{ cite: string }>, expect: string[]): number {
  for (let i = 0; i < chunks.length; i++) {
    if (expect.some((p) => chunks[i]!.cite.startsWith(p))) return i + 1;
  }
  return 0;
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)}%`;
}

async function loadCorpus() {
  const res = await fetch(CORPUS_URL);
  if (!res.ok) throw new Error(`corpus fetch failed (${res.status}) for ${CORPUS_URL}`);
  return prepare((await res.json()) as Parameters<typeof prepare>[0]);
}

async function retrievalEval(useRerank: boolean): Promise<number> {
  const corpus = await loadCorpus();

  let rerank: typeof import("../src/rerank").rerank | null = null;
  let client: import("@anthropic-ai/sdk").default | null = null;
  if (useRerank) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("--rerank needs ANTHROPIC_API_KEY");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    rerank = (await import("../src/rerank")).rerank;
  }

  const cases = CASES.filter((c) => !c.outOfScope);
  let candHits = 0;
  let lexHits = 0;
  let rrHits = 0;
  let mrrSum = 0;

  console.log(`Retrieval eval over ${cases.length} answerable cases (corpus: ${CORPUS_URL})\n`);
  for (const c of cases) {
    const candidates = retrieve(corpus, c.question, CANDIDATE_K);
    const candRank = matchRank(candidates, c.expect);
    const lexRank = matchRank(candidates.slice(0, FINAL_K), c.expect);

    let rrRank = 0;
    let finalChunks: ScoredChunk[] = candidates.slice(0, FINAL_K);
    if (useRerank && rerank && client) {
      const r = await rerank(client, c.question, candidates, FINAL_K);
      finalChunks = r.chunks;
      rrRank = matchRank(finalChunks, c.expect);
    }

    if (candRank) candHits++;
    if (lexRank) lexHits++;
    if (rrRank) {
      rrHits++;
      mrrSum += 1 / rrRank;
    }

    const decisive = useRerank ? rrRank : lexRank;
    const rerankCol = useRerank ? `  rerank@${FINAL_K}:${rrRank || "-"}` : "";
    console.log(
      `${decisive ? "PASS" : "FAIL"} ${c.id.padEnd(24)} ` +
        `cand@${CANDIDATE_K}:${candRank || "-"}  lex@${FINAL_K}:${lexRank || "-"}${rerankCol}  ` +
        `expect[${c.expect.join(", ")}]`,
    );
    if (!decisive) {
      const top = (useRerank ? finalChunks : candidates).slice(0, 5).map((x) => x.cite);
      console.log(`     surfaced: ${top.join(", ")}`);
    }
  }

  const n = cases.length;
  console.log(`\nRecall@${CANDIDATE_K} (BM25 candidates):        ${candHits}/${n}  ${pct(candHits, n)}`);
  console.log(`Recall@${FINAL_K}  (lexical top-${FINAL_K}, rerank OFF): ${lexHits}/${n}  ${pct(lexHits, n)}`);
  if (useRerank) {
    console.log(
      `Recall@${FINAL_K}  (reranked):               ${rrHits}/${n}  ${pct(rrHits, n)}   MRR ${(mrrSum / n).toFixed(3)}`,
    );
  }
  return (useRerank ? rrHits : lexHits) / n;
}

async function answerEval(): Promise<number> {
  console.log(`End-to-end eval against ${ASK_URL}\n`);
  let answerable = 0;
  let citeHits = 0;
  let scope = 0;
  let refused = 0;

  for (const c of CASES) {
    const res = await fetch(ASK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://dotcompass.dev" },
      body: JSON.stringify({ question: c.question }),
    });
    const d = (await res.json()) as {
      answer?: string;
      citations?: Array<{ cite: string }>;
      confidence?: string;
      capped?: boolean;
    };
    if (d.capped) {
      console.log(`SKIP ${c.id} — worker is over its spend cap`);
      continue;
    }
    const citations = d.citations ?? [];

    if (c.outOfScope) {
      scope++;
      const didRefuse =
        d.confidence === "low" ||
        citations.length === 0 ||
        /could not find|couldn.t find|not (?:addressed|found|contained)/i.test(d.answer ?? "");
      if (didRefuse) refused++;
      console.log(
        `${didRefuse ? "PASS" : "FAIL"} ${c.id.padEnd(24)} out-of-scope  conf:${d.confidence}  cites:${citations.length}`,
      );
    } else {
      answerable++;
      const hit = citations.some((s) => c.expect.some((p) => s.cite.startsWith(p)));
      if (hit) citeHits++;
      console.log(
        `${hit ? "PASS" : "FAIL"} ${c.id.padEnd(24)} conf:${d.confidence}  cites:[${citations.map((s) => s.cite).join(", ")}]  expect[${c.expect.join(", ")}]`,
      );
    }
  }

  console.log(`\nCitation accuracy: ${citeHits}/${answerable}  ${pct(citeHits, answerable)} of answerable cases cited an expected section`);
  console.log(`Refusal on out-of-scope: ${refused}/${scope}  ${pct(refused, scope)} correctly refused / low confidence`);
  return answerable === 0 ? 1 : citeHits / answerable;
}

async function main() {
  const mode = process.argv.includes("--answer")
    ? "answer"
    : process.argv.includes("--rerank")
      ? "rerank"
      : "retrieval";

  if (mode === "answer") {
    const acc = await answerEval();
    if (acc < CITATION_THRESHOLD) {
      console.log(`\n❌ citation accuracy ${pct(Math.round(acc * 100), 100)} below threshold ${CITATION_THRESHOLD}`);
      process.exitCode = 1;
    } else {
      console.log(`\n✓ citation accuracy meets threshold`);
    }
    return;
  }

  const recall = await retrievalEval(mode === "rerank");
  if (recall < RECALL_THRESHOLD) {
    console.log(`\n❌ recall ${recall.toFixed(2)} below threshold ${RECALL_THRESHOLD}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ recall meets threshold ${RECALL_THRESHOLD}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
