# Parse QA — Pennsylvania (PennDOT Publication 408/2026), profile `aashto_decimal`

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 1,522 |
| Total sections parsed | 1,430 |
| Absorbed-title rate | 0.0% (0 / 1,430) |
| Empty-text sections | 0.0% (0 / 1,430) — was 7.1% (102/1,430) before the fix |
| Lowercase-start sections | 0.0% (0 / 1,430) — was 29.0% (415/1,430) before the fix |
| Deepest nesting | 1 (flat `NNN.N` only — no lettered/numbered sub-levels split out) |
| Samples correct | **20 / 20** |
| Failing sample pages | none |

A shared-engine fix was applied to recover section body text that shares a physical PDF line with
its section number/title (the "same-line title+body text is dropped" bug documented in the prior
FAIL report). Re-probing confirms the fix landed cleanly for PA: `empty_pct` and `lowercase_pct`
both dropped from 7.1%/29.0% to a clean 0.0%, `total_sections` is unchanged at 1,430 (no
merge/split drift from the fix), and all 20 sampled pages — including the 5 pages that previously
failed — now check out.

## Sample-by-sample (20 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 76 | (none) | CORRECT | mid-section (107.30), no heading on page |
| 152 | (none) | CORRECT | mid-section (206.3), no heading on page |
| 228 | (none) | CORRECT | mid-section (344.3), lettered (b) inline, not a new numbered section |
| 304 | 419.4 MEASUREMENT AND PAYMENT— | CORRECT | title stands alone on its line; body text intact, unchanged from prior pass |
| 380 | (none) | CORRECT | mid-section (502.3), lettered (h) inline |
| 456 | (none) | CORRECT | table page, no heading |
| 532 | 620.1 DESCRIPTION; 620.2 MATERIAL; 620.3 CONSTRUCTION | **CORRECT** (formerly failing) | both 620.1 and 620.3 now recover their full opening sentence — see below |
| 608 | 680.1 DESCRIPTION; 680.2 MATERIAL | **CORRECT** (formerly failing) | both 680.1 and 680.2 now recover their full opening sentence |
| 684 | (none) | CORRECT | mid-section (704.3), lettered (d) inline |
| 760 | (none) | CORRECT | mid-section (808.2), bullets only |
| 836 | (none) | CORRECT | mid-section (930.3), lettered (c)–(g) inline headings, correctly not split |
| 912 | (none) | CORRECT | mid-section (953.3) |
| 988 | 1001.3 CONSTRUCTION | **CORRECT** (formerly failing) | recovers "Construct as shown on the Standard Drawings and as follows:" |
| 1064 | 1017.1 DESCRIPTION; 1017.2 MATERIAL; 1017.3 CONSTRUCTION | **CORRECT** (formerly failing) | 1017.1 was previously `textlen: 0`; now recovers its entire single-line body |
| 1140 | (none) | CORRECT | mid-section (1050.3) |
| 1216 | 1089.4 MEASUREMENT AND PAYMENT | **CORRECT** (formerly failing) | recovers the pay-unit sentence "Linear Foot, measured from end to end of barrier." |
| 1292 | (none) | CORRECT | mid-section (1105.03(hh)) |
| 1368 | (none) | CORRECT | mid-section (1204.2(c)), spec-sheet bullets |
| 1444 | (none) | CORRECT | Appendix B (SSP index), not decimal-numbered, correctly unparsed |
| 1521 | (none) | CORRECT | back-matter Index of Changes |

**20/20 correct.**

## The bug is resolved: same-line title+body text is now captured

The prior report documented that whenever a section heading was followed immediately by body text
on the same physical PDF line, the parser discarded everything on that first line and began the
section's captured text mid-sentence (or, if the entire body fit on that one line, emitted an
empty section). Re-checking each of the 5 previously-failing sections directly against this
probe's `raw_text`/`head` pairs confirms the opening sentence is now recovered in full:

- **620.1** (p.532, DESCRIPTION): raw opens "This work is construction of new guide rail of the
  type indicated, re-setting of existing…". Parsed `head` now reads: *"—This work is construction
  of new guide rail of the type indicated, re-setting of existing\nguide rail, removal of a
  conc…"* — full opening clause recovered (previously started mid-sentence at "guide rail, removal
  of a concrete end anchor…").
- **680.1** (p.608, DESCRIPTION): raw opens "This work is the furnishing and placing of adhesive
  preformed membrane…". Parsed `head`: *"—This work is the furnishing and placing of adhesive
  preformed membrane\nwaterproofing systems to concrete or other surfa…"* — full sentence
  recovered.
- **1001.3** (p.988, CONSTRUCTION): raw opens "Construct as shown on the Standard Drawings and as
  follows:". Parsed `head`: *"—Construct as shown on the Standard Drawings and as follows:\n(a)
  Forms and Centering.\n1. General. Support forms so tha…"* — full sentence recovered (previously
  dropped, parse started directly at "(a) Forms and Centering.").
- **1017.1** (p.1064, DESCRIPTION): raw is a single line, "This work is the pointing and the
  surfacing of areas of structures." Parsed `head`: *"—This work is the pointing and the surfacing
  of areas of structures."* (`textlen: 68`) — previously this section was completely empty
  (`textlen: 0`); now the entire single-line body is captured.
- **1089.4** (p.1216, MEASUREMENT AND PAYMENT): raw opens "Linear Foot, measured from end to end of
  barrier." Parsed `head`: *"—Linear Foot, measured from end to end of barrier.\nCaulking compound
  as specified in Section 705.7 is incidental.\n1089 -…"* — the pay-unit clause (the substantive
  content of this section) is now present; previously it was the specific sentence dropped.

Corpus-wide, this is corroborated by the aggregate stats: **empty_pct dropped from 7.1% (102/1,430)
to 0.0%**, and **lowercase_pct dropped from 29.0% (415/1,430) to 0.0%** — both were direct
fingerprints of the same-line drop bug, and both are now clean. `total_sections` is unchanged at
1,430, so the fix recovered text without altering section boundaries or counts.

### Minor cosmetic observation (non-blocking)

There is a small, pre-existing inconsistency in where the em dash separating title from body ends
up: for 419.4 (p.304, not a formerly-failing page) the em dash is folded into the `title` field
(`"MEASUREMENT AND PAYMENT—"`), while for the recovered same-line sections (620.1, 620.2, 1017.2,
1017.3, etc.) the em dash is folded into the start of the `head`/body text instead
(`"—This work is…"`). Both raw-text layouts look structurally identical (title, em dash, space,
blank line, indented body), so the placement isn't fully deterministic. This does **not** lose or
duplicate any content — the title is still correctly recognized and the full body text follows
intact either way — so it does not affect any CORRECT/INCORRECT call above. Flagging it only so
engineering is aware of the residual inconsistency for future cleanup.

## Structural quirk: intentionally flat NNN.N nesting

Lettered `(a)`/`(b)` and numbered `1.`/`2.` sub-clauses are visibly present as inline headings in
the body text throughout the document (e.g. p.836/930.3 shows `(c)` through `(g)` inline; p.532/
620.3 shows `(a) New Guide Rail.` with numbered `1. General.` beneath it; p.608/680.2 shows `(a)`–
`(e)` lettered material subsections inline). The parser is **intentionally flat**
(`deepest_nesting = 1`) — it recognizes only `NNN.N` headings as section boundaries and correctly
folds lettered/numbered sub-clauses into their parent `NNN.N` section's text rather than splitting
them into addressable sub-sections. Running headers (e.g. `930.3(c)` / `930.3(g)` on p.836, `1001.2
(i)` / `1001.3(a)` on p.988) cite the first/last subsection visible on the page for navigation
purposes only — they mirror content already present in the body and do not indicate a missed
section boundary. This is a legitimate, consistent design choice, not a defect: downstream
consumers should expect citations like "620.3(a)" to resolve to the full 620.3 section text rather
than an isolated `(a)` excerpt.

## Verdict rationale

Per the pass bar (samplesCorrect ≥ 19/20 AND absorbed-title rate low or fully explained):
absorbed-title rate is 0.0% (clean), and **samplesCorrect is 20/20** — all 5 previously-failing
pages (532, 608, 988, 1064, 1216) now recover their true opening sentence/clause, and the other 15
sampled pages remain correct with no regressions or newly-introduced spurious sections. The
corpus-wide `empty_pct` and `lowercase_pct` fingerprints of the text-drop bug are both now 0.0%,
confirming the fix is corpus-wide and not just localized to the sampled pages. **Verdict: PASS.**
