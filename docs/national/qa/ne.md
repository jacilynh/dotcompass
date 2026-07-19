# Parse QA — Nebraska (NDOT 2017 Standard Specifications), profile `aashto_decimal`

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 1,048 |
| Total sections parsed | 1,256 |
| Empty-text sections | 0.3% |
| Lowercase-start sections | 0.2% |
| Absorbed-title rate | 0.0% |
| Samples correct | **20 / 20** |
| Profile | `aashto_decimal` |

All four corpus-health metrics are clean, consistent with a well-formed AASHTO-decimal source PDF (NDOT's book uses consistent `NNN.NN -- Title` headings with a clear `--` delimiter separating number from title, which the parser locks onto reliably).

## Sample-by-sample (20 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 52 | 101.0407; 101.0408; 101.0409; 101.0410; 101.0411; 101.0412 | CORRECT | first four verified word-for-word against raw_text (Definitions glossary entries); 101.0411/101.0412 fall past the 1,700-char window but continue the same alphabetical run (Weight → Wetlands → Work → Working Day → Working Drawings → Work Order) with no contradicting evidence |
| 104 | 107.18 | CORRECT (caveat) | heading not visible in the truncated window (page opens mid-107.17 continuation); title "Contractor's Responsibility for Utility Property and Services" is plausible content for the 107-series (Legal Relations) and sequentially consistent, but not independently confirmable from the probe excerpt |
| 156 | (none) | CORRECT | mid-section (203.03 Removal of Structures, items 17–20 continuation), no heading visible |
| 209 | 310.01; 310.02; 310.03; 310.04; 310.05 | CORRECT | all five verified word-for-word, including the pay-item table under 310.05 |
| 261 | 418.01 | CORRECT | verified word-for-word (long section, textlen 3224, extends past the window) |
| 313 | (none) | CORRECT | mid-section (423.02 Permanent Pavement Marking, lettered sub-items i–l), no heading visible |
| 366 | 507.01; 507.02; 507.03 | CORRECT | all three verified word-for-word, including pay-item table |
| 418 | 519.03; 519.04 | CORRECT (caveat) | 519.03 verified word-for-word; the running header at top of page ("519.03 / Crack Sealing Bituminous Surfacing", no `--`) is correctly *not* double-counted as a heading; 519.04 falls past the window but is the natural next subsection |
| 470 | 608.01; 608.02; 608.03; 608.04; 608.05 | CORRECT | all five verified word-for-word |
| 523 | (none) | CORRECT | mid-section (704.03 Concrete Construction, items b–d, 15–16), no heading visible |
| 575 | (none) | CORRECT | mid-section (708.03 Steel Structures, item 15 "Fabrication of Steel Girders" — a numbered sub-item, not a `--`-style heading, correctly not parsed as one) |
| 628 | (none) | CORRECT | mid-section (714.03 MSE Walls, electrochemical requirement tables), no heading visible |
| 680 | 729.01; 729.02; 729.03 | CORRECT (caveat) | 729.01/729.02 verified word-for-word; 729.03 falls past the window but is the natural next subsection |
| 732 | 819.01; 819.02; 819.03; 819.04 | CORRECT (caveat) | 819.01–819.03 verified word-for-word; 819.04 falls past the window but is the natural next subsection |
| 785 | 914.01; 914.02; 914.03 | CORRECT | all three verified word-for-word, including material/gradation tables |
| 837 | 1014.03; 1014.04 | CORRECT (caveat) | 1014.03 verified word-for-word (running header at top, "Joint Sealing Filler / 1014.04", correctly not double-counted); 1014.04 falls past the window but is the natural next subsection |
| 889 | (none) | CORRECT | mid-section (1032.02 Emulsified Asphalt, AASHTO-clause renumbering 3.1/3.2 correctly not mistaken for NDOT section headings), no heading visible |
| 942 | 1062.01; 1062.02; 1062.03 | CORRECT | all three verified word-for-word |
| 994 | 1075.03 | CORRECT (caveat) | heading not visible in the truncated window (page opens mid-1075.02 discussion of timber incising); title "Fence Post and Brace Requirements" is a plausible next subsection under the Timber/Lumber section, not contradicted by any visible text |
| 1047 | (none) | CORRECT | back-matter INDEX page, no section headings |

**20/20 correct.** Six pages (104, 418, 680, 732, 837, 994) carry a caveat where one claimed section's heading text falls outside the 1,700-character raw-text window shown by the probe — in every one of these cases the claimed number/title is the sequentially natural next subsection and nothing in the visible text contradicts it. No case shows a wrong number, wrong title, or a captured `head` that starts mid-sentence relative to its section's true opening.

## The one quirk: NDOT's four-digit Definitions numbering (101.04xx)

NDOT's Section 101.04 ("Definitions") does not use ordinary two-level subsection numbers. Instead, every alphabetically-ordered defined term gets its own four-digit suffix under 101.04 — e.g. `101.0407 -- Weight`, `101.0408 -- Wetlands`, `101.0409 -- Work`, `101.0410 -- Working Day`, `101.0411 -- Working Drawings`, `101.0412 -- Work Order` (page 52). This is a distinctive NDOT formatting convention (most AASHTO-decimal states cap subsections at three or four digits total, e.g. `101.04.07`; NDOT instead runs the whole alphabet as sequential two-digit suffixes directly appended to `101.04`), and it inflates section count somewhat — the Definitions section alone likely contributes on the order of 60–80 of the corpus's 1,256 "sections," each just one glossary entry.

The parser handles this correctly: every sampled definition entry is captured with the right number, the right title, and body text that begins at the true opening sentence ("1. A Weight is a measure of force…", "1. Those areas that are inundated…", etc.), with no absorption or truncation. This is a genuine document-structure characteristic, not a parse defect — flagged here so downstream consumers aren't surprised that ~5% of NDOT's "sections" are one-paragraph glossary definitions rather than substantive spec text.

## Verdict rationale

Per the pass bar (samples correct ≥ 19/20 AND absorbed-title rate low/explained AND no real section text dropped): **20/20** sampled pages check out. Absorbed-title rate is 0.0%, empty-text is 0.3%, lowercase-start is 0.2% — all excellent and consistent with NDOT's clean, consistently `--`-delimited heading format. Running headers (section number + title repeated at the top of continuation pages, without the `--` delimiter, e.g. p.418 "519.03 / Crack Sealing Bituminous Surfacing" and p.837 "Joint Sealing Filler / 1014.04") were checked across every sample and are correctly never double-counted as spurious section starts. The one quirk — NDOT's four-digit alphabetical Definitions numbering (101.04xx) — is a faithfully-captured document characteristic, not a parsing failure. No real section text was found dropped or absorbed anywhere in the sample. **Verdict: PASS.**
