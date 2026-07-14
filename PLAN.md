# WSDOT Spec Tool — Project Plan

> Working name candidates: **SpecCompass**, **ClearSpec**, **SpecNavigator** (final name TBD — must read as clearly unofficial, no WSDOT branding).
> Planned with Claude Fable 5 (July 2026). Implementation on Opus / Codex.
> **Phase 0 (corpus pipeline) is COMPLETE and validated — see "Validated findings" below.**

## Mission

A free, public, beautiful web tool over the **WSDOT Standard Specifications for Road, Bridge, and Municipal Construction (M 41-10)** — genuinely useful to anyone who reads the spec book, and a demonstration of Claude Code's capabilities to colleagues at WSDOT who have never seen AI applied to their work.

Published by **Katabatic Engineering** as a free public resource, **open source under MIT**. The tool is the demo; the business is what comes after it.

**It is also a teaching artifact.** Nearly every public agency publishes a spec book as a pile of PDFs with no history and no usable search. This repo is meant to be *forked* by people solving that problem for their own agency, so the code is a deliverable in its own right — see "Code quality bar" below. That is a real constraint on how it gets built, not a nice-to-have.

---

## Hard constraints

1. **Free to every user. No login, no API key, no install, no payment.** Public-agency users cannot and will not pay, and any friction at the door kills adoption.
2. **Public, not gated.** Do not restrict access by email domain, SSO, or agency affiliation. This is both the ethics posture and the marketing strategy — see "Why it stays public" below. It is a load-bearing decision, not a default.
3. **User documents never leave the browser.** The document scanner is entirely client-side. The project accepts **no server-side document intake, ever** — no uploads, no pasted text sent to a server, no exceptions. See "Why documents stay client-side."
4. **Runs on locked-down machines.** Stock Edge/Chrome on old government Windows boxes. No WebGPU, no installs, no multi-GB downloads.
5. **Verifiable grounding.** Every requirement, search result, finding, and AI answer links to its exact section and quoted source text. Prominent disclaimer: unofficial, not affiliated with or endorsed by WSDOT; always verify against the published manual.
6. **The code is part of the product.** Open source, MIT, written to be read and forked. Test-first; comments that explain *why*, never *what*; honest accuracy reporting. See below.

## Code quality bar

The repo will be read by strangers deciding whether to trust the tool and whether to fork it. Both judgments get made from the source.

- **Test-first.** New behavior arrives with a failing test that describes it. `make test` stays fast and hermetic (no network, no PDFs); the ~5-minute suite against the real corpus runs separately, and weekly in CI.
- **Comments record why, not what.** A comment earns its place only by capturing a constraint the code cannot show — almost always something learned the hard way. The parser's comments are the model: they explain why the *obvious* approach is wrong.
- **Honest accuracy.** If extraction is 85% accurate, the docs say 85%. Silent truncation, unreported caps, and "should be fine" are bugs. The tool's entire premise is that it doesn't bluff.
- **`make lint` clean**; ruff-formatted; CI green on every push.
- **Forkability is a feature.** `CONTRIBUTING.md` explains exactly what another agency must change (section-number pattern, sort order, corpus list) and what already generalizes.

Current state: **46 tests pass** (35 unit + 11 integration against the real PDFs), lint clean. The Phase 0 pipeline was written test-*after* and the suite was backfilled — a real gap, now closed. Everything from Phase 1 on is test-first.

## Why it stays public

Washington's Ethics in Public Service Act (RCW 42.52.150) caps gifts to state employees at $50/year from a single source, and restricts employees of an acquiring agency to nominal items from *"a person who seeks to provide goods or services to the agency."* Katabatic Engineering is such a person.

A free **public** website is not a gift to state employees — it is a public resource anyone can use. Gating it to `@wsdot.wa.gov` would convert it into a thing of economic value provided exclusively to state employees by a vendor seeking their agency's business. **The gate is what would manufacture the problem.** (Not legal advice — but it only takes one ethics officer saying "don't use that" to kill the tool and put colleagues in an awkward spot.)

Gating is also bad strategy. M 41-10 is the baseline spec for cities, counties, ports, contractors, suppliers, and every other consulting firm in Washington — the people who could *hire* Katabatic. A public tool gets shared; a walled garden cannot. **The BD value comes from authorship, not access control.**

## Why documents stay client-side

Katabatic does and seeks WSDOT work. A server that accepts draft special provisions would put pre-decisional, pre-bid project documents onto a vendor's infrastructure — a real procurement-integrity and conflict-of-interest exposure, and a far bigger risk than any token bill. Keeping the scanner in the browser is protective of *us*, and "your draft never leaves your computer" is a headline feature for this audience.

## Business model

**Give away the tool; sell the capability.** The free public tool is the demo. If WSDOT (or a city, county, or port) wants a private internal version — indexing their non-public GSPs, project files, and design memos — that is a **contract**, not a giveaway. An agency paying a consultant for a service is procurement, a road they already know how to walk. The funnel is one quiet line on the About page: *we build tools like this — get in touch.*

---

## Cost model

Cost is **not** the constraint; it was analyzed and dismissed.

- Ask the Specs (RAG Q&A) on **Claude Haiku 4.5** (`claude-haiku-4-5`, $1/MTok input, $5/MTok output): roughly **half a cent per question** (~5k input tokens of retrieved sections + system prompt, ~500 output tokens). 1,000 questions/month ≈ $10. 10,000 ≈ $100.
- Budget **$20–50/month**, enforced by a hard spend cap in the Worker. Everything else on the site is static and costs nothing.
- Note: prompt caching is of limited use here — retrieved chunks vary per question, and the stable system prompt likely falls below Haiku's 4,096-token minimum cacheable prefix. Do not over-engineer for it.

---

## Validated findings (Phase 0 — done)

Everything below was verified against the real documents.

**The corpus is a best case.** `SS2026.pdf` — 1,243 pages, 8.9 MB, born-digital (Adobe InDesign), clean text layer on every page, plus an **embedded 2,265-entry table of contents** with four levels of hierarchy and page anchors. 3.5M characters across **2,235 numbered sections**; 15,561 "shall" statements. No copyright notice anywhere in the document; it is a Washington State publication and WSDOT invites redistribution.

**The parser is written and recovers 2,235 / 2,235 sections** (`pipeline/parse_specs.py`), zero false positives. Three non-obvious problems, all solved:
- The running header reprints the section heading verbatim atop every page — real headings are distinguished only by vertical position (header at y≈12.2; a true heading starts at y≥24.6).
- Division 9's cross-reference tables contain heading-lookalike cells — rejected by anchoring every candidate to its TOC page.
- InDesign sometimes merges a heading into the previous section's closing paragraph — so headings are detected **per line, not per block** (a heading is a line that is *exactly* a section number), which also ignores inline cross-references.

**"Vacant" sections are real data.** 124 sections are titled `Vacant` — WSDOT's marker for a struck or reserved section number. A draft citing one is exactly what the scanner should flag.

**Amendments don't exist — editions do.** WSDOT publishes a full new edition annually rather than mid-cycle amendment packets. Section numbers are stable, so a diff is exact rather than fuzzy.

**All 17 editions (2000–2026) are parsed, and every section now has a 26-year life story.** This is the headline capability. `corpus/` holds all 17 PDFs; `pipeline/parse_any_edition.py` parses every one; `pipeline/build_history.py` assembles `history.json` (3.0 MB — shippable).

| | |
|---|---|
| sections ever published, 2000–2026 | **3,853** |
| live in 2026 | 3,095 |
| vacant in 2026 | 142 |
| running continuously since 2000 | 1,599 |
| new in 2026 | 269 |
| revisions tracked | 11,561 |
| removals / vacations | 633 / 250 |

Each section carries a timeline of `introduced`, `revised` (with a churn score, so a typo is distinguishable from a rewrite), `vacated`, `restored`, `removed`, `reinstated`. **`1-09.7 Mobilization`: introduced 2000, revised six times, struck in 2026.** That single timeline is the demo — a spec section is not a fact, it's a decision with a history, and nobody currently has a way to see it.

**Parsing the archive was much harder than parsing 2026, and the parser is the real asset.** Only 6 of 17 editions have a usable TOC (2000–2008 ship a 2-entry TOC; 2010–2018 are division-level only; 2023's is incomplete), so `parse_any_edition.py` uses no TOC at all. Nothing is hardcoded, because everything changes across 26 years — page geometry (the 2000 book is half-width), heading font (Times-Bold → TimesNewRomanPS-BoldMT → **Lato-Heavy**, which doesn't contain "Bold" at all), and heading layout (2000–2018 put number and title in one span; 2020–2026 split them across lines). It therefore *measures* each document: modal body font, header/footer bands, and two order-based filters. Two traps it must survive, both found the hard way:
- The front-matter contents listing is itself a complete 1-01…9-35 run, and the older editions contain an **APWA Supplement that restarts numbering at 1-01** mid-book. Body start is chosen by whichever "1-01" yields the most headings that actually have prose under them. (Scoring by text *volume* picks the wrong one — fewer sections means bigger sections.)
- Section order is enforced as a **longest non-decreasing subsequence**, not a greedy scan: greedy lets one spurious high number (a Division 9 table cell citing 9-35 from inside Division 1) reject every real heading after it.

Validated: reproduces all 2,235 TOC-listed 2026 sections with zero misses, and finds ~1,000 more that WSDOT's own TOC omits (the deepest `(2)A` level). Counts grow smoothly, 2,132 (2000) → 3,237 (2026).

**Known accuracy caveat, stated honestly.** The raw parse produced 228 sections that vanished for exactly one edition and returned — clustered in 2004, the weakest parse. WSDOT does not strike and reinstate 215 sections two years apart; those are parse misses, so single-edition gaps are healed and marked `inferred` rather than reported as history. That drops spurious `reinstated` events from 232 to 17. The older editions (especially 2004) remain the least reliable and should carry a lower-confidence marker in the UI.

**Search index is small enough to ship.** 11,449 paragraph chunks (avg 284 chars). At 384 dimensions: 17.6 MB fp32, 8.8 MB fp16, **4.4 MB int8**.

---

## Features (v1)

| # | Feature | Runs where | Notes |
|---|---|---|---|
| 1 | **Spec Explorer** | Static | Full book, browsable by division/section, deep-linkable URLs, `Vacant` clearly marked |
| 2 | **Requirements database** | Static | Every "shall" statement extracted, filterable by division, topic, bound party (Contractor / Engineer). Useful with AI switched off — part of the point |
| 3 | **Hybrid search** | Client | MiniSearch (BM25) + semantic search over precomputed int8 embeddings, in-browser query encoder (transformers.js, WASM). Instant, offline after first load |
| 4 | **Section history** (2000–2026) | Static | *Protect this one — it is the best feature in the product.* Every section's 26-year timeline: introduced, revised (with churn), vacated, removed, reinstated. Side-by-side text for any pair of editions. Nobody at WSDOT currently has any way to see this |
| 5 | **Document scanner** | **Client only** | Paste a draft provision. Deterministic, rule-based checks (no LLM): references to Vacant/removed sections, stale section numbers, sections changed since the draft's edition. Plus semantically related requirements. **Never sent to a server.** |
| 6 | **Checklist builder** | Static | Pick work types → exportable compliance checklist (PDF/CSV) |
| 7 | **Ask the Specs** | **Worker** | Grounded RAG Q&A. Free to everyone, no login. Haiku 4.5 behind a Cloudflare Worker. Every answer cites sections and links to source. Degrades to keyword search when the spend cap is hit |
| 8 | **How this was built** | Static | The making-of: pipeline, prompts, process, cost. The real goal is demonstrating capability — make the making-of a first-class feature |

Out of scope for v1: plan-sheet (drawing) analysis, any server-side document intake, other manuals (Design M 22-01, Construction M 41-01, LAG M 36-63 come later — the parser will likely transfer, as WSDOT uses one InDesign template across manuals).

## Architecture

```
pipeline/                  # build-time, run locally; output committed as static JSON
  parse_specs.py           # DONE — TOC-anchored parser; best on 2024-2026
  parse_any_edition.py     # DONE — TOC-FREE parser; works on all 17 editions (2000-2026)
  diff_editions.py         # DONE — section-level diff between any two editions
  build_history.py         # DONE — assembles history.json: every section's 26-year timeline
  extract_requirements.py  # TODO — Claude-assisted "shall" extraction + topic tags
  embed.py                 # TODO — int8 section/paragraph embeddings (~4.4 MB)
  out/e2000.json ... e2026.json   # 17 parsed editions
  history.json             # 3.0 MB — the section-history artifact the app ships
corpus/                    # all 17 source PDFs (gitignored; fetched by script)
app/                       # Vite + React + TypeScript + Tailwind, static SPA
worker/                    # Cloudflare Worker — the ONLY server. RAG Q&A only.
                           # No document intake. API key is a Cloudflare secret.
.github/workflows/         # build + deploy app to GitHub Pages
```

Design bar: professional and beautiful. Dense-reference-text typography, strong hierarchy, light/dark, fast. Unofficial branding; disclaimer in the footer and on every scanner result and AI answer. Footer: *A free tool from Katabatic Engineering.*

## Build phases

- **Phase 0 — Corpus pipeline. ✅ DONE.** All 17 editions (2000–2026) downloaded and parsed; edition diff and full section history built and validated.
- **Phase 1 — Site skeleton + Spec Explorer.** Vite/React/Tailwind scaffold, deep-linkable section routes, GitHub Pages deploy. Ship early so there is always a live URL.
- **Phase 2 — Requirements extraction + Explorer.** Build-time Claude extraction with spot-check QA; filterable UI.
- **Phase 3 — Hybrid search.** MiniSearch + transformers.js, merged ranking, source-linked results.
- **Phase 4 — Section history viewer.** Render `history.json`: a timeline per section, side-by-side text between any two editions, and change badges in the Explorer. Mark pre-2010 data as lower-confidence.
- **Phase 5 — Document scanner + checklist builder.** Deterministic checks first (precise, trust-building); related-requirements second. Client-side only.
- **Phase 6 — Ask the Specs Worker.** Cloudflare Worker + Haiku 4.5, rate limits, hard spend cap, graceful degradation.
- **Phase 7 — Polish + story.** Visual pass, "How this was built," demo script, README with screenshots and architecture diagram.

## Demo script

1. Open the site. No install, no login, no key. It's just a URL — and it's public, so anyone in the room can pull it up on their phone right now.
2. A colleague asks a question they already know the answer to; search finds it; click the citation and land on the verbatim section text.
3. Pull up **1-09.7 Mobilization**: introduced 2000, revised six times, struck in 2026. Ask the room who knew. Then show that every one of 3,853 sections has a timeline like it.
4. Paste a draft provision into the scanner; it flags the stale reference. Note the text never left the browser.
5. Ask the Specs a real question; the answer cites sections; click through and verify.
6. Close on "How this was built": one person, Claude Code, a few weeks, and a rounding error in hosting cost.

## Open questions

- Final name and GitHub org/repo.
- Confirm reuse/attribution informally with WSDOT contacts (no legal blocker found, but courtesy matters).
- Branding weight: currently *"A free tool from Katabatic Engineering"* in the footer + About page. A softer version (neutral brand, Katabatic on the About page only) is a one-line change if that lands better with the room.
