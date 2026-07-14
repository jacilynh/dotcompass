# Build Goal — WSDOT Spec Tool

Paste the block below as the goal / opening turn for the Opus build run.

---

Build the WSDOT Standard Specifications tool described in `PLAN.md` in this repo. Read `PLAN.md` first — it is the source of truth for scope, constraints, and rationale. This goal is the execution brief.

## What this is

A free, public, beautiful web tool over the WSDOT Standard Specifications for Road, Bridge, and Municipal Construction (M 41-10), published by Katabatic Engineering. It must be genuinely useful to anyone who reads the spec book, and it doubles as a demonstration of Claude Code to WSDOT engineers who have never seen AI applied to their work. Those engineers are skeptical domain experts whose single fear is that AI makes things up — so **every claim the tool makes must link to the exact section and quoted source text.** Verifiable grounding is the entire trust strategy.

## Six constraints that are not negotiable

1. **Free to every user.** No login, no API key, no install, no payment, no email wall.
2. **Public, not gated.** Do not add SSO, domain restriction, or any access control. `PLAN.md` explains why (Washington state ethics law plus reach); it is a deliberate decision, not an omission.
3. **User documents never leave the browser.** The document scanner is 100% client-side. Accept **no** server-side document intake — no uploads, no pasted text POSTed anywhere. The only server is the Q&A Worker, and it receives questions, never documents.
4. **Runs on locked-down government Windows machines.** Stock Edge/Chrome. No WebGPU, no installs, no multi-GB downloads.
5. **Every requirement, result, finding, and AI answer cites its section** and links through to the verbatim text. Unofficial-tool disclaimer in the footer and on every scanner result and AI answer.
6. **The code is part of the product.** This ships open source (MIT) as a teaching artifact — the goal is that engineers at *other* agencies fork it for their own spec books. Strangers will judge both the tool and the idea from the source, so:
   - **Write tests first.** New behavior arrives with a failing test that names it. `make test` must stay fast and hermetic; the corpus suite runs separately.
   - **Comments explain *why*, never *what*.** A comment earns its place by recording a constraint the code can't show. Read the docstring of `pipeline/parse_any_edition.py` — that's the standard.
   - **Report accuracy honestly.** 85% means you write 85%. Silent truncation and unreported caps are bugs.
   - **`make lint` clean, CI green.** Keep `CONTRIBUTING.md` true as you go.

   There are already **46 passing tests** (35 unit + 11 against the real PDFs) and a clean lint. Do not regress this. The Phase 0 pipeline was tested after the fact; everything you build is test-first.

## Where things stand

**Phase 0 is done and validated — do not redo it.**

- `pipeline/parse_any_edition.py` is the parser. It handles **all 17 editions** using no table of contents at all (only 6 of 17 have a usable one), by inferring each book's typography. Read its docstring before touching it — the traps it survives are not guessable from the code, and an earlier TOC-anchored parser that worked beautifully on 2026 failed on two-thirds of the archive.
- `pipeline/diff_editions.py` diffs any two parsed editions. `pipeline/build_history.py` assembles `pipeline/history.json` — every section's timeline across 26 years.
- All 17 PDFs (2000-2026) are in `corpus/` (gitignored); all 17 parses are in `pipeline/out/`.
- Run with `uv run --with pymupdf python3 pipeline/<script>.py ...`.

**Numbers you can quote:** 3,853 sections ever published; 3,095 live in 2026; 1,599 running continuously since 2000; 269 new in 2026; 11,561 revisions tracked.

Two facts the parser surfaced that shape the product: **142 sections are titled "Vacant"** (WSDOT's marker for a struck section — a draft citing one is a real finding), and **WSDOT publishes full annual editions, not amendment packets**, so "what changed" is a diff across editions — which is why the section history exists and why it's the centerpiece.

## Build it in this order

Ship a live URL early and keep it live. Each phase should end with something deployed and working.

**Phase 1 — Site skeleton + Spec Explorer.** Vite + React + TypeScript + Tailwind. Static SPA, deployed to GitHub Pages via GitHub Actions. Full book browsable by division → section, deep-linkable URLs (`/section/1-07.1`), `Vacant` sections clearly marked.

**Phase 2 — Requirements extraction + Requirements Explorer.** Write `pipeline/extract_requirements.py`: build-time, Claude-assisted extraction of every "shall/must/required" statement (there are ~15,500 "shall" occurrences across ~7,500 chunks), tagged with division, topic, and bound party (Contractor / Engineer / other). Spot-check a sample by hand and report accuracy honestly. Ship a filterable UI. This feature must be useful with AI switched off — that's part of the point.

**Phase 3 — Hybrid search.** Write `pipeline/embed.py`: precompute int8 paragraph embeddings (11,449 chunks × 384 dims ≈ 4.4 MB — sized and confirmed shippable). In the app, MiniSearch (BM25 keyword) merged with semantic search using an in-browser transformers.js query encoder (quantized, WASM — no WebGPU). Results link to source sections.

**Phase 4 — Section history viewer.** *Protect this feature; it is the best thing in the product.* All 17 editions (2000-2026) are already parsed into `pipeline/out/` and assembled into `pipeline/history.json`. Render it: for any section, a 26-year timeline of introduced / revised (with a churn score) / vacated / restored / removed, plus side-by-side text between any two editions, plus change badges in the Explorer. Make `1-09.7 Mobilization` easy to find — introduced 2000, revised six times, struck in 2026 — it is the demo moment. Mark pre-2010 data as lower-confidence: those PDFs parse least reliably (2004 worst), and single-edition gaps in the data are inferred, not observed.

**Phase 5 — Document scanner + checklist builder.** Client-side only. Deterministic, rule-based checks first, because they are precise and build trust: references to Vacant or removed sections, stale section numbers, sections changed since the draft's edition. Then surface semantically related requirements alongside. Say prominently on the page that the text never leaves the browser. Checklist builder: pick work types → exportable PDF/CSV assembled from the requirements DB.

**Phase 6 — "Ask the Specs" Worker.** The only server. A Cloudflare Worker doing grounded RAG over the section chunks, free to everyone with no login.
- Model: `claude-haiku-4-5` via the Anthropic TypeScript SDK (`@anthropic-ai/sdk`). ~$1/MTok in, $5/MTok out — roughly half a cent per question.
- The API key is a **Cloudflare secret**. It must never appear in the repo, in client code, or in any committed file.
- Answers must quote and cite section numbers, and the UI must link each citation to the section text. If the model can't ground an answer in retrieved sections, it should say so rather than guess.
- Per-IP rate limiting and a **hard monthly spend cap**. When the cap is hit, degrade gracefully to keyword search with a clear message — never fail silently, never overspend.
- The Worker accepts a question string. It does not accept files or documents. Ever.
- Don't over-engineer prompt caching: retrieved chunks vary per question, and the system prompt likely falls under Haiku's 4,096-token minimum cacheable prefix.

**Phase 7 — Polish and the story.** A real visual pass (see below). A "How this was built" page telling the making-of honestly — the pipeline, the process, the parser problems and how they were solved, the actual cost. Since the goal is demonstrating capability, the making-of is a first-class feature, not an afterthought. A README with screenshots and an architecture diagram.

## Design bar

Professional and beautiful — this is being shown to engineers and management as a work sample, and it should look like one. Dense-reference-text typography with strong hierarchy, generous reading measure, light and dark themes, fast. Nothing that reads as a bootstrapped side project or a generic AI-generated template. Footer: *A free tool from Katabatic Engineering*, alongside the unofficial-tool disclaimer.

Branding is clearly **unofficial** — no WSDOT marks, no implication of endorsement. Every AI answer and every scanner result carries a "verify against the published manual" note.

## How to work

- Give me a working, deployed thing at the end of each phase rather than one big reveal.
- Where you make a judgment call I didn't specify, make it and tell me — don't stall.
- If something in `PLAN.md` turns out to be wrong when it meets reality, say so and propose the change; the plan has already been revised once by exactly that kind of finding.
- Report honestly: if extraction accuracy is 85%, say 85%. This tool's whole premise is that it doesn't bluff, and neither should the build report.
