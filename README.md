# WSDOT Spec Tool

A free, public tool over the **WSDOT Standard Specifications for Road, Bridge, and Municipal Construction (M 41-10)** — with 26 years of section history that nobody has been able to see before.

> **Unofficial.** Not affiliated with or endorsed by the Washington State Department of Transportation. Always verify against the published manual.

**Live:** <https://jacilynh.github.io/wsdot-spec-tool/> · A free tool from Katabatic Engineering.

![The section history for 1-09.7 Mobilization — introduced 2000, revised six times, struck in 2026](docs/screenshots/section-history.png)

---

## What it does

Ask what `1-09.7 Mobilization` says today and you get: *nothing.* It's `Vacant` — struck from the 2026 edition. What the spec book won't tell you is that it was introduced in 2000, revised six times, and killed last year — so every draft still citing it for mobilization payment is stale, and no one was told.

That's the idea. **A spec section is not a fact. It's a decision with a history.** This tool reconstructs that history for all **3,853 sections ever published between 2000 and 2026**.

| | |
|---|---|
| Sections ever published (2000–2026) | **3,853** |
| Live in the 2026 edition | 3,095 |
| Marked `Vacant` in 2026 | 142 |
| Running continuously since 2000 | 1,599 |
| New in 2026 | 269 |
| Revisions tracked | 11,561 |

Everything is grounded: each answer, requirement, and finding links to the exact section and its verbatim text. Nothing is asserted that you can't click through and check.

## Why it's built this way

Three decisions are load-bearing, and forks should understand them before changing them:

- **It's public and free, and it must stay ungated.** Washington's ethics law ([RCW 42.52.150](https://app.leg.wa.gov/rcw/default.aspx?cite=42.52.150)) restricts what state employees may accept from a vendor seeking their agency's business. A free *public* resource isn't a gift to anyone. Restricting it to state employees is what would turn it into one. The gate would *create* the problem it looks like it solves.
- **Your documents never leave your browser.** The document scanner is entirely client-side. There is no upload endpoint and never will be one — draft, pre-bid provisions have no business on someone else's server.
- **AI runs at build time, not run time.** Claude read and structured the corpus once, offline. The shipped site is static. The one live feature (grounded Q&A) is a rate-limited, spend-capped Cloudflare Worker, free to everyone, that receives *questions* and never documents.

## The interesting part: parsing 26 years of PDFs

This is the bit worth reading if you're here to learn something.

Parsing the 2026 edition is easy — it's a born-digital InDesign PDF with a 2,265-entry embedded table of contents. Parsing *the archive* is not, and the naive assumption ("just run it on the older ones") fails immediately:

**Only 6 of the 17 editions have a usable table of contents.** The 2000–2008 books ship a **two-entry** TOC. 2010–2018 list divisions only. Even 2023's is incomplete.

So [`pipeline/parse_any_edition.py`](pipeline/parse_any_edition.py) uses no TOC at all. It can't hardcode anything either, because nearly everything changes across 26 years:

| | 2000–2008 | 2010–2018 | 2020–2026 |
|---|---|---|---|
| Page size | 396×612 (half-width) | 396×612 | 612×792 |
| Heading font | `Times-Bold` | `TimesNewRomanPS-BoldMT` | **`Lato-Heavy`** |
| Heading layout | number + title in **one span** | one span | number and title on **separate lines** |

Note `Lato-Heavy` — it's a heading font whose name doesn't contain the word "Bold." Matching the literal string silently collapsed a third of the corpus to ~140 sections before I caught it.

So the parser **measures each book** instead of assuming: modal body font, header/footer bands, heading contrast. Then it survives two traps that each destroyed most of the book before being found:

1. **Numbering restarts more than once per document.** The front-matter contents listing is itself a complete `1-01`…`9-35` run, and the older editions contain an **APWA Supplement that restarts at 1-01 mid-book**. "Start at the last 1-01" skips all of Division 1; "start at the first" reads the table of contents as if it were the book. The fix: try every `1-01`, keep whichever yields the most headings that actually have prose beneath them. (Scoring by text *volume* picks the wrong one — fewer sections means bigger sections.)

2. **One stray table cell can truncate the entire book.** Division 9's cross-reference tables contain cells that are typographically identical to headings. Rejecting out-of-order numbers is right; doing it *greedily* is fatal — a cell citing `9-35` from inside Division 1 gets accepted (it increases), and every real heading below `9-35` is then rejected. That's the rest of the book. The parser takes the **longest non-decreasing subsequence** instead, which drops the one outlier rather than everything after it.

Result: it recovers all 2,235 TOC-listed sections of the 2026 edition **with zero misses, without reading the TOC** — and finds ~1,000 more that WSDOT's own TOC omits (the deepest `(2)A` level).

### On semantic search

Search is **hybrid**: keyword (lexical) results appear instantly, and in-browser semantic results — computed by an `all-MiniLM-L6-v2` model running via WebAssembly — merge in via reciprocal-rank fusion once the model loads. Passage vectors are precomputed at build time (`app/scripts/embed.mjs`) with the *same* model and int8 quantization the browser uses, so query and passage vectors are directly comparable. The model and ONNX runtime are **self-hosted** (~44 MB, git-ignored, deployed with the site), so the feature needs no external request and works on locked-down machines. It's a progressive enhancement: if the model can't load, search stays keyword-only.

### On the requirements extraction

The requirements index is **rule-based, not model-generated** — every entry is a verbatim sentence, so there's nothing to hallucinate (the same reason the scanner is deterministic). The one judgment call, *who the obligation binds*, is spot-checked by hand at roughly **90% accuracy** on named parties (Contractor / Engineer / Agency); the residual errors are mostly an actor named in a subordinate clause rather than as the grammatical subject, or a passive "…must be furnished by the Contractor" where the actor follows the verb. The passive majority ("concrete shall reach 4000 psi") is labelled *Work/Material*. The sentence splitter also occasionally merges a numbered list into one long entry. A Claude-assisted enrichment pass (richer topic tags, better party attribution) is a clean future add; the deterministic core is the honest, reproducible baseline.

### Where it's still weak — stated plainly

The pre-2010 parses are the least reliable, 2004 worst. The raw output claimed 228 sections vanished and returned; **215 were gaps of exactly one edition**, clustered in the editions that parse badly. WSDOT does not strike and reinstate 215 sections two years apart — the parser missed them. Those gaps are healed and flagged `inferred`, which drops spurious reinstatements from 232 to 17. The UI marks pre-2010 data lower-confidence. A tool whose whole premise is *it doesn't bluff* should not open by bluffing about its own data.

## Quick start

```bash
make help      # what you can do
make test      # fast unit suite — no downloads needed
make history   # fetch all 17 editions, parse them, build the timeline
make test-all  # everything, including the ~5min suite against the real PDFs
```

The source PDFs are **not vendored** into this repo — they're WSDOT's to publish. `make corpus` fetches them from wsdot.wa.gov. The integration tests self-skip if they're absent, so a fresh clone runs green immediately.

## The web app

The site itself — a Spec Explorer over the current edition and a **Section History** viewer showing each section's 26-year life — lives in [`app/`](app/) (Vite + React + TypeScript). Build its data and run it with:

```bash
make app-data     # fetch + parse 17 editions, emit app/public/data/ (~5 min once)
cd app && npm install && npm run dev
```

See [`app/README.md`](app/README.md) for the layout. The pipeline that feeds it is described below.

## Build your own

**This is meant to be forked.** Nearly every public agency publishes a spec book as a pile of PDFs with no history, no search worth the name, and no way to know what changed. If that's your agency, the pipeline here should transfer with modest effort — the hard-won part is `parse_any_edition.py`, and it's deliberately written to infer layout rather than assume it.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to point it at a different corpus, and [PLAN.md](PLAN.md) for the full architecture and the reasoning behind each constraint.

## License

[MIT](LICENSE). The WSDOT Standard Specifications are a Washington State public document; this project claims no rights in them and reproduces them with attribution.
