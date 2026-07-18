# DOTcompass 50-State Execution Playbook

How a supervised agent fleet builds out the remaining state DOTs — written for the **Opus
supervisor session** that will run it. Fleet agents (Sonnet, occasionally Haiku) do the
per-state work; Opus orchestrates, reviews, resolves quirks, and owns every merge. The plan
was authored with Fable (planning), and executes on Opus + fleet (implementation) —
matching the project's standing model split.

Companion documents (do not duplicate their content — read them):
- `ARCHITECTURE.md` — the cluster-parser + state-descriptor design (already built, proven).
- `EXPANSION.md` — the verified 50-state survey synthesis: clusters, tiers, pilots, risks.
- `catalog.json` — the per-state survey. **A lead list, NOT ground truth**: verification
  caught three URLs serving the *wrong state's* PDF and ~17 fabricated numbering examples.
  Every claim in it must be re-derived from live documents before use.

---

## 1. Definition of done — the capability ladder

“Same functionality as WSDOT” is not achievable for most states (few publish usable
archives), so completeness is a ladder, tracked per state:

| Level | Features | Applies to |
|---|---|---|
| **P0** | Browse + keyword search + scanner-lite (valid/unknown citations; no “removed” without history) | all 50 |
| **P1** | P0 + requirements explorer (party vocabulary adapted per state) | all 50 |
| **P2** | P1 + semantic search + Ask (needs per-state embeddings + multi-state Ask engineering) | all built states, batched |
| **P3** | P2 + section history | only the ~18–20 archive states; needs the `align.py` fuzzy-alignment layer (not yet built) |

**“Built” ≠ “Live.”** The reuse gate (`states/base.py`, `build_state.py`) blocks publishing
any state whose redistribution terms aren't cleared — which today is nearly every state
except Washington. Engineering makes states demo-ready (like North Dakota, local-only);
**publishing each state is a human decision** made on a reuse dossier (Stage 4). The two
clocks are independent: build on the engineering clock, launch on the clearance clock.

## 2. Non-negotiable guardrails

1. **The reuse gate is never weakened or bypassed.** No `--allow-uncleared` in any publish
   path; no agent ever sets a state's reuse to `public` — only a human, on a dossier.
2. **No source PDF is ever committed.** All of `corpus/` stays git-ignored, every state.
3. **The WSDOT regression is the merge gate.** Full suite (2,235-section corpus test + app
   tests) green before any merge that touches shared code. Washington never breaks.
4. **catalog.json is leads, not truth.** Every URL, scheme, and example is re-verified
   against the live document (Stage 0/1) before anything is built on it.
5. **No unverified agent claim survives.** Every fleet finding passes either a
   deterministic check (script, test, schema) or an independent second agent. This is the
   single most load-bearing lesson of this repo.
6. **Shared-code changes are Opus-only.** Fleet agents write additive files (descriptors,
   configs, reports). A change to `parsers/engine.py`, profiles, `build_state.py`, or the
   app's shared components escalates to the supervisor.

## 3. Roles

- **Opus (supervisor):** wave orchestration, artifact review, quirk decisions, all merges,
  all shared-code changes, playbook amendments after each wave retro.
- **Sonnet (analyst):** anything requiring judgment against a rubric — source verification,
  parse probes, adversarial QA, quirk characterization, reuse-dossier research,
  requirements vocabulary adaptation.
- **Haiku (mechanic):** narrow, checkable tasks only — running documented commands,
  checklist confirmation, screenshot eyeballing. When a deterministic script exists
  (build, schema check, tests), **run the script instead of asking a model.**
- **Human (owner):** reuse clearance decisions + DOT outreach, publish approvals, ~30 min
  of spot-QA per wave, credentials for gated portals.

Orchestration mechanics: use the **Workflow tool** for wave fan-outs (deterministic
pipeline, journal, resume); the Agent tool for singletons; git worktrees for parallel
state branches; merges serialized through the supervisor.

## 4. The per-state pipeline

Each state advances through stages; artifacts land in the repo so any session can resume.
A state's branch is `state/<slug>`; its status lives in `docs/national/status.json`.

### Stage 0 — Verify the source (Sonnet, paired)
- **In:** the state's `catalog.json` entry (leads only).
- **Do:** locate the current spec book from the DOT's own site; download to
  `corpus/<slug>/`; extract first ~3 pages of text and confirm the front matter names this
  state and DOT (**hard gate** — this is what caught Montana serving Mississippi's book);
  record url, edition, date, size, sha256, single-vs-split.
- **Verify:** a second, independent agent (or deterministic grep of the front-matter text)
  re-confirms provenance. Two independent confirmations or it doesn't pass.
- **Escalate:** portal/login-gated downloads, expiring links, split-PDF publication.

### Stage 1 — Cluster assignment + parse probe (Sonnet)
- **Do:** inspect the PDF's real heading typography and number formats (the methodology
  used for ND/PA/MO: num-first lines, font/weight histogram); assign a `SpecProfile`
  (`aashto_decimal` covers ~36 states); run `parsers/engine.py` with it; report section
  count, monotonicity, division distribution; spot-check 5 sections against the book's own
  TOC where one exists.
- **Pass:** coherent count, strictly monotonic order, sane division spread, TOC spot-checks
  match.
- **Escalate:** no existing profile fits → supervisor designs the new cluster (Florida's
  dash scheme `105-8` is the known case; it is NOT aashto_decimal).

### Stage 2 — Adversarial parse QA (Sonnet, independent of Stage 1)
- **Do:** pick 20 random pages from the PDF, read them directly, and confirm each page's
  section is captured with correct number, title, and text boundary. Measure the
  absorbed-title rate (MoDOT-style titleless paragraphs). Identify the state's “one
  quirk” — every book so far has exactly one (PA: header-only lettered subs; MO: titleless
  paragraphs; ND: no division names) — with **evidence, not impression**.
- **Pass:** ≥19/20 spot-checks correct; quirk documented with page references.
- **Out:** `docs/national/qa/<slug>.md`.

### Stage 3 — Descriptor + build + app integration (Haiku/scripts)
- **Do:** write `pipeline/states/<name>.py` (profile, editions, `history=False`,
  reuse status from the dossier or `unstated` pending); register in `build_state.py`;
  run `build_state.py <slug> app/public/data --allow-uncleared` (LOCAL ONLY);
  deterministic JSON-shape validation; add the app `StateConfig`; extend the parameterized
  state test; CDP screenshot of Browse + one section page.
- **Pass:** tests green, screenshots render, zero tracked data/PDF files.

### Stage 4 — Reuse dossier (Sonnet research → human decision)
- **Do:** collect the state's actual terms — site terms-of-use, the PDF's copyright/front
  matter, any public-records statute — quoting and linking everything; classify
  public/unstated/reserved **with evidence**; draft (not send) an outreach email to the
  DOT's publications office requesting redistribution permission.
- **Out:** `docs/national/reuse/<slug>.md`. **No agent ever flips the gate.**

### Stage 5 — Feature lift to P1 (Sonnet)
- **Do:** adapt `extract_requirements.py` party vocabulary to the state's actor nouns
  (e.g., MoDOT “Commission”, PennDOT “Department/Representative”); 30-sample manual
  spot-check of party attribution.
- **Pass:** ≥90% attribution accuracy on the sample; counts sane per division.

### Stage 6 — Review + merge (Opus)
- Review all artifacts; decide quirk handling (accept / per-state override / defer);
  merge the state branch; run the **full** regression; update `status.json`; note
  playbook amendments for the wave retro.

### P2 batch stage (per group of built states, after the multi-state Ask engineering track)
- Per-state embeddings (`embed.mjs`), per-state Ask corpus + Vectorize namespace or
  metadata filter, eval spot-cases per state.

## 5. Waves

Batches of ~5 are right — not for compute (a wave's fleet work is hours), but because
supervisor review, the user's spot-QA, and serialized merges are the real constraints, and
early waves generate playbook fixes that later waves inherit.

- **Wave 1 — prove the factory (5 states):** finish **North Dakota** (descriptor exists,
  parse proven), **Pennsylvania**, **Missouri** (parses proven; quirks known), plus **two
  tier-1 single-PDF AASHTO states** selected at kickoff from `catalog.json` (criteria:
  tier 1, aashto scheme, single PDF, verification passed, reuse not
  all-rights-reserved) and confirmed by Stage 0. All on the known-good profile path.
- **Wave 2 — prove the hard capabilities (~6):** **Florida** (new dash cluster — supervisor
  builds the profile; also the future P3 history pilot), **Indiana** (per-division PDFs —
  multi-file ingestion), + 4 more tier-1s. Also the app-scaling checkpoint (below).
- **Waves 3–6 — scale (~6–8/wave):** remaining tier-1 and tier-2 states, roster from
  `status.json`, playbook now stable.
- **Final wave — the hard 9:** bot-walls, portals, gated archives. Expect manual
  acquisition help from the owner; some may stall indefinitely — record and move on.
- **After every wave:** retro → amend this playbook → then the next wave.

## 6. Status tracking

`docs/national/status.json`, committed, one entry per state. **Supervisor bootstrap (first
action):** generate it from `catalog.json` with every state at `stage: "pending"`.

```json
"pa": {
  "state": "Pennsylvania", "dot": "PennDOT", "tier": 1, "cluster": "aashto_decimal",
  "stage": "pending|0-source|1-parse|2-qa|3-built|4-dossier|5-p1|6-merged",
  "capability": "none|P0|P1|P2|P3",
  "reuse": { "status": "unstated", "dossier": null, "cleared": false },
  "live": false,
  "source": { "url": null, "edition": null, "sha256": null, "verified": false },
  "quirks": [], "blockers": []
}
```

## 7. Parallel Opus-led engineering tracks (not fleet work)

1. **Multi-state Ask:** worker takes a state parameter; per-state corpus URL; one Vectorize
   index with `{state}` metadata filter (or per-state namespaces); prompt de-WSDOT-ified;
   spend cap policy (shared vs per-state). ~Half-day design, then fleet rollout in P2.
2. **`align.py` — the history layer (P3):** fuzzy cross-edition alignment
   (exact-number → title/text similarity, confidence surfaced in the UI). A multi-week
   engineering effort. Pilot on Florida (best archive in the country) + Missouri/North
   Dakota per `EXPANSION.md`. Do not fleet this; it is real algorithm work.
3. **App scaling checkpoint (at Wave 2):** the header dropdown and single-site model were
   built for 2 states. Decide: 50-state switcher UI vs per-state deploys
   (`ARCHITECTURE.md` sketched both); measure static-hosting growth (~25 MB/state) and
   Pages limits before Wave 3.
4. **Requirements generalization:** factor WSDOT-specific vocabulary out of
   `extract_requirements.py` into per-state config so Stage 5 is pure configuration.

## 8. Timeline and budget (honest ranges)

Per clean tier-1 state: ~8–15 fleet agents, ~1–3M tokens, fleet wall-clock 1–3 h, plus
supervisor review. Wave of 5: fleet work fits in a day; a week including review, retro,
and owner spot-QA.

| Milestone | Estimate |
|---|---|
| Wave 1 (5 states to P0/P1, factory proven) | 1–2 weeks |
| ~39 tractable states to P0/P1 | 6–10 weeks cumulative |
| P2 (semantic + Ask) across built states | +2–3 weeks, overlappable |
| Hard 9 | +2–4 weeks, partly owner-dependent |
| P3 history track (align.py + pilots) | 3–6 weeks, parallel, Opus-led |
| **Engineering-complete (tractable states)** | **~2–3 months part-time** |
| Public launches per state | On the clearance clock — weeks-to-months per DOT response, rolling |

Token budget, order of magnitude: fleet ~75–150M tokens across all states (mostly Sonnet),
plus ~20–40M supervision. At API rates that is low hundreds of dollars; on a subscription
it is many working sessions spread across waves. The recon (101 agents, 3M tokens, 26 min)
is the calibration point — per-state pipelines are deeper than recon lookups.

## 9. What only the human can do

1. Approve and send reuse-outreach emails (drafted by Stage 4); decide clearances.
2. Approve each state's public launch.
3. ~30 minutes of spot-QA per wave (open 2–3 states, check a few sections against PDFs).
4. Provide credentials/manual downloads for portal-gated states.
5. Wave-boundary go/no-go.

## 10. Supervisor first-session checklist

1. Read this file, `ARCHITECTURE.md`, `EXPANSION.md`; skim `catalog.json`.
2. Bootstrap `docs/national/status.json` from `catalog.json`; commit.
3. Verify the live baseline (dotcompass.dev; Ask answers with citations; eval green).
4. Select Wave 1's two additional states per §5 criteria; confirm with the owner.
5. Run Wave 1 Stage 0 as a Workflow fan-out (verification pairs); review; proceed stage by
   stage. Merge states one at a time.
6. End of wave: retro, amend playbook, report to owner with per-state status and the
   reuse-outreach drafts awaiting approval.
