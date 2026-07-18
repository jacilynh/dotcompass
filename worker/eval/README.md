# Ask eval harness

Measures the quality of the "Ask the Specs" pipeline against a gold set of questions, so
changes to retrieval, the reranker, or the prompt can be judged by numbers instead of vibes.
Adapted from the Atli query project's retrieval eval.

## Run it

```bash
make eval                 # retrieval recall — FREE, no API key. The fast inner-loop metric.
make eval ARGS=--rerank   # + the reranker's lift (Recall@6 reranked + MRR). Needs ANTHROPIC_API_KEY.
make eval ARGS=--answer   # + end-to-end against the live Worker: citation accuracy + refusal.
```

- **retrieval** (default): loads the live corpus, runs BM25, reports **Recall@24** (did the
  right section make the candidate set?) and **Recall@6** (did it survive to the answer step
  without reranking?). Free and instant — run it on every retrieval/prompt change.
- **--rerank**: also runs the Haiku reranker and reports **Recall@6 (reranked)** and **MRR**,
  so you can see how much reranking improves the final six sections. A few cheap Haiku calls.
- **--answer**: hits the deployed Worker for the full pipeline and checks whether each answer
  actually **cites** an expected section, and whether **out-of-scope** questions are correctly
  refused / marked low confidence. Costs real (capped) spend — run sparingly.

Each mode exits non-zero below its threshold (`RECALL_THRESHOLD`, `CITATION_THRESHOLD` in
`run.ts`), so it can gate changes in CI.

## The gold set (`cases.ts`)

Each case is a question plus `expect`: section-number **prefixes**, any of which counts as a
hit (so `["1-08.6"]` matches `1-08.6(2)`, and a family prefix `["8-01"]` matches any `8-01.x`).
`outOfScope` cases have no expected section — the right behavior is to refuse.

**This is a starter set — extend it.** Adding a case is a few lines, so every "Ask got this
wrong" becomes a permanent regression test. When you add a case, confirm the expected section
against the section index (the eval itself will tell you if your label is wrong — that is how
three labels in the first run got corrected).

## Baseline

BM25-only (16 answerable + 3 out-of-scope, single-manual corpus):

| Metric | Result |
|---|---|
| Recall@24 (BM25 candidates) | 94% (15/16) |
| Recall@6 (lexical, rerank off) | 88% (14/16) |
| Citation accuracy (end-to-end) | 94% (15/16) |
| Refusal on out-of-scope | 67% (2/3) |

After adding **hybrid retrieval** (BM25 + semantic via Workers AI + Vectorize) over the
7-manual corpus, then a **similarity floor** to fix the refusal regression it caused:

| Metric | BM25-only | Hybrid | Hybrid + floor |
|---|---|---|---|
| Citation accuracy (end-to-end) | 94% (15/16) | 94% (15/16) | 94% (15/16) |
| Refusal on out-of-scope | 67% (2/3) | 33% (1/3) | **75% (3/4)** |

Hybrid made every answerable case high-confidence and cross-manual, but semantic's always-a-
neighbour behaviour dropped refusal; the similarity floor (drop hits below cosine 0.55)
restored it without losing any answerable win. The one remaining refusal "miss"
(`oos-human-remains`) is a debatable label — WSDOT §1-07.16 does cover archaeological finds.

What the runs surfaced, worth tracking:

- **`materials-on-hand` — fixed by semantic.** BM25 missed §1-09.8 (the question shares no
  rare terms with "Payment for Material on Hand"); semantic retrieval finds it, and the answer
  went from low-confidence-refusal to a high-confidence citation of §1-09.8. This is the win
  hybrid retrieval was added for.
- **Out-of-scope refusal regressed (the semantic tradeoff).** BM25 returns *nothing* for a
  truly foreign question, which the Worker reads as "not in the manuals". Semantic retrieval
  always returns nearest neighbors, so "will it rain next Tuesday?" now retrieves
  weather-suspension chunks and gets answered confidently. The fix to try next: a **similarity
  floor** on the top semantic score — below it, treat the question as out-of-scope. The eval's
  `oos-*` cases are how you'd measure that change.
- **`structural-concrete`** — §6-02 sits at lexical rank 11 but the reranker (and now semantic)
  surfaces it; a clean demonstration of why the later stages exist.
