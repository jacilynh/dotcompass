/**
 * "Ask the Specs" — a stateless Cloudflare Worker that answers questions about the WSDOT
 * Standard Specifications, grounded strictly in the real section text.
 *
 * Flow: validate the question -> rate-limit the caller -> retrieve the most relevant
 * sections from a cached corpus -> check the monthly spend cap -> ask Claude Haiku to
 * answer using ONLY those sections, with citations -> record the cost.
 *
 * Design commitments (see PLAN.md):
 *   - It accepts a QUESTION only. It never receives a user's document. Retrieval happens
 *     here, over public specification text, so the endpoint can't be steered into
 *     summarizing arbitrary supplied text.
 *   - The API key is a Cloudflare secret, never in the repo or in client code.
 *   - A hard monthly spend cap makes overspending impossible: when it's reached the
 *     Worker returns `capped`, and the client falls back to keyword search — it never
 *     fails silently and never keeps spending.
 */

import Anthropic from "@anthropic-ai/sdk";

import {
  MAX_TOKENS,
  MODEL,
  SUBMIT_ANSWER_TOOL,
  SYSTEM_PROMPT,
  type StructuredAnswer,
  buildUserMessage,
  citedLabels,
  estimateCostUsd,
  validateQuestion,
} from "./rag";
import { rerank } from "./rerank";
import { type Chunk, type PreparedChunk, type ScoredChunk, prepare, retrieve } from "./retrieval";
import { type SemanticEnv, embedQuery, fuse, semanticSearch } from "./semantic";

interface Env extends SemanticEnv {
  ANTHROPIC_API_KEY: string; // secret: wrangler secret put ANTHROPIC_API_KEY
  SPEND: KVNamespace; // monthly cost counter
  RATE_LIMITER?: RateLimit; // optional native rate-limit binding
  CORPUS_URL: string; // where to fetch ask-corpus.json
  ALLOWED_ORIGIN: string; // the site origin permitted to call this Worker
  MONTHLY_CAP_USD: string; // hard spend ceiling, e.g. "30"
  // AI + VECTORIZE bindings come from SemanticEnv (semantic retrieval).
}

const CANDIDATE_K = 24; // wide BM25 recall set fed to the reranker
const FINAL_K = 6; // sections kept after reranking and given to the answer step

// Cached across requests within a warm isolate — the corpus is fetched at most once per
// isolate, not per request. A promise guards concurrent first requests.
let corpusPromise: Promise<PreparedChunk[]> | null = null;

function loadCorpus(url: string): Promise<PreparedChunk[]> {
  if (!corpusPromise) {
    corpusPromise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`corpus fetch failed (${res.status})`);
        return res.json() as Promise<Chunk[]>;
      })
      .then(prepare)
      .catch((err) => {
        corpusPromise = null; // let a later request retry a transient failure
        throw err;
      });
  }
  return corpusPromise;
}

function monthKey(): string {
  return `spend:${new Date().toISOString().slice(0, 7)}`; // spend:YYYY-MM
}

async function spentThisMonth(env: Env): Promise<number> {
  return Number((await env.SPEND.get(monthKey())) ?? "0");
}

async function recordSpend(env: Env, usd: number): Promise<void> {
  const key = monthKey();
  const next = (Number((await env.SPEND.get(key)) ?? "0") + usd).toFixed(6);
  // Expire a couple of months out so old counters clean themselves up.
  await env.SPEND.put(key, next, { expirationTtl: 70 * 24 * 3600 });
}

function cors(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** One structured-answer call via the submit_answer tool. Returns the parsed answer + cost. */
async function generateAnswer(
  client: Anthropic,
  question: string,
  chunks: ScoredChunk[],
): Promise<{ answer: StructuredAnswer; cost: number }> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_ANSWER_TOOL],
    tool_choice: { type: "tool", name: "submit_answer" },
    messages: [{ role: "user", content: buildUserMessage(question, chunks) }],
  });
  const cost = estimateCostUsd(message.usage.input_tokens, message.usage.output_tokens);
  const tool = message.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") throw new Error("submit_answer was not called");
  const out = tool.input as Partial<StructuredAnswer>;
  const confidence =
    out.confidence === "high" || out.confidence === "medium" || out.confidence === "low"
      ? out.confidence
      : "medium";
  return {
    cost,
    answer: {
      answer: typeof out.answer === "string" ? out.answer : "",
      citations: Array.isArray(out.citations) ? out.citations.map((c) => String(c)) : [],
      confidence,
      caveats: Array.isArray(out.caveats)
        ? out.caveats.filter((c): c is string => typeof c === "string")
        : [],
    },
  };
}

/** A citation the client can render and link: the excerpt's number (what the model cited),
 *  the readable label, and its source manual. */
interface Citation {
  id: number; // the bracketed number the model cited, [id]
  cite: string; // readable label, e.g. "1-09.7" or "CM p.363"
  source: string;
  sourceId: string;
  ref: string;
  page: number;
  url: string;
  inApp: boolean;
}

/** The excerpt labels the answer actually grounds in: inline [x] markers plus the tool's
 *  `citations`, both filtered to the labels we supplied (so a hallucinated citation is
 *  dropped, never surfaced). */
function resolveCitations(out: StructuredAnswer, supplied: string[]): string[] {
  const allowed = new Set(supplied);
  const set = new Set<string>(citedLabels(out.answer, supplied));
  for (const c of out.citations) if (allowed.has(c)) set.add(c);
  return [...set];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, headers);

    // 1. Validate the request — a question string, nothing else.
    let body: { question?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400, headers);
    }
    const check = validateQuestion(body.question);
    if (!check.ok) return json({ error: check.reason }, 400, headers);
    const question = (body.question as string).trim();

    // 2. Rate-limit by client IP, if the binding is configured.
    if (env.RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return json({ error: "rate limited", retryAfter: 60 }, 429, headers);
      }
    }

    // 3. HYBRID retrieval: BM25 (exact terms) fused with semantic (meaning) via Workers AI +
    //    Vectorize. Retrieval is free — no Anthropic call yet; an empty result is a grounded
    //    "not found". Semantic fails safe: if it errors, we proceed on BM25 alone.
    let corpus: PreparedChunk[];
    try {
      corpus = await loadCorpus(env.CORPUS_URL);
    } catch {
      return json({ error: "corpus unavailable" }, 503, headers);
    }
    const lexical = retrieve(corpus, question, CANDIDATE_K);
    const queryVector = await embedQuery(env, question);
    const semantic = queryVector
      ? await semanticSearch(env, queryVector, corpus, CANDIDATE_K)
      : [];
    const candidates = semantic.length > 0 ? fuse([lexical, semantic], CANDIDATE_K) : lexical;
    if (candidates.length === 0) {
      return json(
        {
          answer: "I could not find anything about that in the WSDOT manuals.",
          citations: [],
          sources: [],
          confidence: "low",
          caveats: [],
        },
        200,
        headers,
      );
    }

    // 4. Enforce the hard monthly spend cap BEFORE spending anything.
    const cap = Number(env.MONTHLY_CAP_USD || "0");
    if (cap > 0 && (await spentThisMonth(env)) >= cap) {
      return json({ capped: true }, 200, headers);
    }

    // 5. Rerank the candidates to the few most relevant, then answer using ONLY those, via
    //    the submit_answer tool. Retry once if nothing is cited; downgrade if it still
    //    isn't. Every model call is Haiku and counts toward the spend cap.
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    let totalCost = 0;
    try {
      const reranked = await rerank(client, question, candidates, FINAL_K);
      totalCost += reranked.cost;
      const chunks: ScoredChunk[] = reranked.chunks;
      // Number the excerpts [1]..[N]; the model cites those numbers. Map each back to the
      // source metadata the client needs to render + link the citation.
      const supplied = chunks.map((_, i) => String(i + 1));
      const meta = new Map<string, Citation>();
      chunks.forEach((c, i) => {
        meta.set(String(i + 1), {
          id: i + 1,
          cite: c.cite,
          source: c.source,
          sourceId: c.sourceId,
          ref: c.ref,
          page: c.page,
          url: c.url,
          inApp: c.inApp,
        });
      });

      const first = await generateAnswer(client, question, chunks);
      totalCost += first.cost;
      let out = first.answer;
      let cited = resolveCitations(out, supplied);

      // Citation retry: a fluent answer citing nothing usually means the prompt slipped.
      if (cited.length === 0) {
        const retry = await generateAnswer(client, question, chunks);
        totalCost += retry.cost;
        out = retry.answer;
        cited = resolveCitations(out, supplied);
      }
      // Still ungrounded -> downgrade and say so, rather than assert something uncited.
      if (cited.length === 0) {
        out = {
          ...out,
          confidence: "low",
          caveats: [
            ...out.caveats,
            "No part of this answer could be tied to a specific manual excerpt — treat it as a lead, not an answer, and verify against the manual.",
          ],
        };
      }

      const citations = cited.map((label) => meta.get(label)!).filter(Boolean);
      const sources = [...new Set(citations.map((c) => `${c.source} (${c.sourceId})`))];

      // 6. Record spend, then return the grounded answer with source-tagged citations.
      await recordSpend(env, totalCost);
      return json(
        {
          answer: out.answer,
          citations,
          sources,
          confidence: out.confidence,
          caveats: out.caveats,
          model: MODEL,
        },
        200,
        headers,
      );
    } catch (err) {
      // Never fail silently: log for debugging (wrangler tail), charge for any calls that
      // did run, and tell the client so it can fall back to keyword search.
      console.error("generation failed:", err);
      await recordSpend(env, totalCost);
      return json({ error: "generation failed" }, 502, headers);
    }
  },
};
