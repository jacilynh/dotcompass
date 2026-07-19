# Parse QA — Rhode Island (RIDOT, Feb 2026 Standard Specifications), profile `aashto_decimal`

**Verdict: FAIL**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 951 |
| Total sections parsed | 887 |
| Empty-text sections | 0.0% |
| Lowercase-start sections | 2.0% |
| Absorbed-title rate | 0.1% |
| Samples correct | **18 / 20** |
| Profile | `aashto_decimal` |

## Sample-by-sample (20 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 47 | 104.09 | CORRECT (caveat) | heading falls outside the 1,700-char raw_text window (page opens mid a lettered list, `b.`/`c.`/`d.`); title/head plausible and internally coherent, not contradicted by visible text |
| 94 | (none) | CORRECT | mid-section (108.xx CPM-schedule lettered sub-items continuation), no true heading visible |
| 142 | (none) | CORRECT | mid-section (202.01 DESCRIPTION continuation); "Handling, Hauling…" and "Load, Haul…" are unnumbered captions, not section headings |
| 189 | 208.01; 208.02; 208.03 | CORRECT (caveat on 208.03) | 208.01 and 208.02 verified word-for-word; 208.03's heading is past the 1,700-char window but plausible given the page's dense MATERIALS sub-captions |
| 237 | 402.01; 402.02 | CORRECT | both verified word-for-word |
| 284 | (none) | CORRECT | mid-section (601.xx numbered-note-list continuation) |
| 332 | 701.05 | CORRECT | verified word-for-word |
| 379 | 804.01 | CORRECT | verified word-for-word |
| 427 | (none) | CORRECT | mid-section (808 concrete-placement prose continuation) |
| 474 | 816.04; 816.05 | CORRECT | both verified word-for-word |
| 522 | (none) | CORRECT | mid-section (825 Paint Application continuation) |
| 569 | 841.04; 841.05 | CORRECT | both verified word-for-word |
| 617 | 903.02; 903.03 | CORRECT | both verified word-for-word, including the unnumbered "General." caption correctly folded into 903.03's body |
| 664 | 920.05 | CORRECT | verified word-for-word |
| 712 | (none) | CORRECT | mid-section (937 Payment for Full Compliance continuation) |
| 759 | (none) | CORRECT | mid-section (Part L, SECTION L07); "Mulching."/"Fertilization."/"Weed Control."/"Pruning." are unnumbered captions, no numbered heading visible |
| **807** | **(none)** | **INCORRECT** | **real text loss** — `M07.11 PILE POINTS AND DRIVE SHOES.` and `M07.12 CLOSURE PLATES AND CAPS.` are both clearly visible, numbered section headings with real body text; parser captured **zero** sections on this page |
| **854** | **(none)** | **INCORRECT** | **real text loss** — `M16.04.7 Parking Sign, Mile Marker, and Delineator Posts.` is a clearly visible numbered heading with real body text; parser captured **zero** sections on this page |
| 902 | (none) | CORRECT (suspect) | no numbered heading visible in the truncated window (only the unnumbered "Foundations." caption); Part T page — consistent with, but not independently proof of, the same alpha-prefix gap seen in Part M |
| 950 | (none) | CORRECT (suspect) | no numbered heading visible in the truncated window (only unnumbered captions); Part T page — same caveat as p.902 |

**18/20 correct**, with two confirmed real misses (p.807, p.854) and two more pages in the same affected part (Part T, p.902/p.950) that are consistent with, but not independently provable as, the same defect from the truncated raw_text window alone.

## The quirk: alpha-prefixed Part L/M/T section numbers are not being captured

RIDOT's spec book, like most AASHTO-derivative documents, splits into numeric Parts (100–900,
sections `104.09`, `208.01`, `816.05`, etc.) **and** three alpha-prefixed appendix Parts — L
(Landscaping, `L01`–`L07`…), M (Materials, `M01`–`M18`…), and T (Traffic Control Systems, `T01`–`T24`…).
Within those alpha parts, subsections are numbered `M07.11`, `M16.04.7`, `L07.03`, `T20.02`, etc. —
the same decimal-nesting convention as the numeric parts, just with a letter prefix on the section
number instead of three digits.

Across the 20-page sample, every one of the 15 numeric-part pages behaved correctly — every visible
`NNN.NN` heading was captured with the right number, title, and exact opening text. But of the 5
sampled pages that fall inside Parts L/M/T, **not a single alpha-prefixed section number was ever
captured**, and on two of those pages the raw text contains an unambiguous, fully-formed numbered
heading that the parser silently dropped:

- **p.807** (`SECTION M07 — SHEET PILING AND PILES`): raw text reads exactly —
  ```
  M07.11
  PILE POINTS AND DRIVE SHOES.
  Use pile points and drive shoes that are carbon-steel castings that conform to AASHTO M103 …

  M07.12
  CLOSURE PLATES AND CAPS.
  Use closure plates and caps that are mild carbon steel that conforms to AASHTO M270 …
  ```
  Both are real, numbered, titled sections with real body text. `parsed_sections_starting_here` for
  this page is `[]` — both are entirely absent from the corpus under any number or title.

- **p.854** (`SECTION M16 — SIGNS AND SIGN SUPPORTS`): raw text contains `M16.04.7 Parking Sign,
  Mile Marker, and Delineator Posts.` — this time number and title share one line (the format seen
  everywhere in the numeric parts), yet it is still not captured. `parsed_sections_starting_here` is
  again `[]`.

Both failure examples rule out "it's just page-break timing" — p.807's heading is nowhere near the
page's 1,700-char cutoff, and neither heading appears captured on a neighboring page under a
different page number either (there is no alpha-prefixed section anywhere in the 20-sample set).
The most likely mechanism: the section-boundary regex assumes a purely numeric section number
(`\d{3}\.\d{2}`) and never matches the `M07.11` / `M16.04.7` / presumably `L07.xx` / `T20.xx`
patterns, so every heading in Parts L, M, and T is invisible to the parser — its body text is either
dropped or silently absorbed into whatever numeric section preceded it in the document stream.

This is corroborated at the corpus level: RI parses to only **887 sections over 951 pages**
(0.93 sections/page) versus DE's 1.68/page and CO's 1.12/page on similarly-structured AASHTO specs
— a shortfall consistent with three entire book parts (L, M, T — which in a typical state materials
appendix run 150–250 pages combined) parsing at or near zero section granularity.

This is **not** a benign formatting quirk like DE's zero-text container headers or CO's title/body
line-wrap split — it is real section content (materials specs for pile points, closure plates, sign
posts, and by extension the rest of Parts L/M/T) that is missing from the parsed corpus under any
section number, and therefore unsearchable/uncitable in the downstream tool.

## Verdict rationale

Per the pass bar (samples correct ≥ 19/20 AND absorbed-title rate low/explained AND **no real
section text dropped — a confirmed real text loss is FAIL regardless of the count**): this sample
fails on both counts. 18/20 pages are correct, one below the 19/20 bar, and — more importantly —
p.807 and p.854 each show a directly confirmed, unambiguous numbered heading with real body text
that the parser produced zero output for. Per the stated rule, a confirmed real text loss is an
automatic FAIL independent of how small the sample count is. The likely root cause (alpha-prefixed
Part L/M/T section numbers not matching the `aashto_decimal` heading regex) appears to affect three
entire book parts, not just the two pages directly verified here, based on the total-sections/page
shortfall and the complete absence of any L/M/T section number anywhere in the 20-sample set.

**Verdict: FAIL.** Recommend: extend the `aashto_decimal` section-boundary pattern to match
alpha-prefixed section numbers (`M07.11`, `M16.04.7`, `L07.03`, `T20.02`, …) before re-running QA on
RI, and re-probe with a sample weighted toward Parts L/M/T to size the actual content loss.
