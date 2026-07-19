# Parse QA — Rhode Island (RIDOT, Feb 2026 Blue Book), profile `letter_prefix`

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 951 |
| Total sections parsed | 1,407 (was 887 under `aashto_decimal`, +58.6%) |
| Empty-text sections | 2.8% |
| Lowercase-start sections | 3.6% |
| Absorbed-title rate | 0.1% |
| Samples correct | **20 / 20** |
| Profile | `letter_prefix` |

## Sample-by-sample (20 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 47 | 104.09 | CORRECT (caveat) | heading falls outside the 1,700-char raw_text window (page opens mid a lettered `b.`/`c.`/`d.` list); title/head plausible, not contradicted |
| 94 | (none) | CORRECT | mid-section (108.xx CPM-schedule lettered sub-items continuation), no true heading visible |
| 142 | (none) | CORRECT | mid-section (202.xx numbered-note continuation); "Handling, Hauling…" / "Load, Haul…" are unnumbered captions, not headings |
| 189 | 208.01; 208.02; 208.03 | CORRECT (caveat on 208.03) | 208.01, 208.02 verified word-for-word; 208.03 heading past the window but plausible |
| 237 | 402.01; 402.02 | CORRECT | both verified word-for-word |
| 284 | (none) | CORRECT | mid-section (601.xx numbered-note continuation) |
| 332 | 701.05 | CORRECT | verified word-for-word |
| 379 | 804.01 | CORRECT | verified word-for-word |
| 427 | (none) | CORRECT | mid-section (808 concrete-placement prose continuation) |
| 474 | 816.04; 816.05 | CORRECT | both verified word-for-word |
| 522 | (none) | CORRECT | mid-section (825 Paint Application continuation) |
| 569 | 841.04; 841.05 | CORRECT | both verified word-for-word |
| 617 | 903.02; 903.03 | CORRECT | both verified word-for-word, incl. unnumbered "General." caption correctly folded into 903.03 body |
| 664 | 920.05 | CORRECT | verified word-for-word |
| 712 | (none) | CORRECT | mid-section (937 continuation) |
| 759 | (none) | CORRECT | Part L, SECTION L07 page; "Mulching."/"Fertilization."/"Weed Control."/"Pruning." are unnumbered captions, no L07.xx heading in window — correctly no spurious parse |
| **807** | **M07.11; M07.12** | **CORRECT — RECOVERED** | both alpha-prefixed headings now captured, number+title+body verified word-for-word (see below) |
| **854** | **M16.04.7; M16.05; M16.05.1** | **CORRECT — RECOVERED** | M16.04.7 captured with full matching body; M16.05/M16.05.1 also captured (M16.05 shows a minor title/body line-wrap split, see Absorbed-title note below) |
| 902 | (none) | CORRECT | Part T, SECTION T11 continuation; "Foundations." caption with lettered a./b./c. sub-items, no T11.xx heading in window |
| 950 | (none) | CORRECT | Part T, SECTION T20 continuation; "Epoxy Retroreflection Values."/"Temporary Pavement Markings." are unnumbered captions, no T20.xx heading in window |

**20/20 correct.** Both previously-failed pages (807, 854) are now correct, and no new spurious or dropped sections were found elsewhere in the sample.

Note: the probe's `lettered_part` boolean is `true` only for the two pages RIDOT flagged as the known recovery targets (807, 854); pages 759, 902, and 950 are also physically inside Part L/T but are flagged `false` in the probe metadata. This is a labeling quirk in the probe, not a parser defect — all three were still checked and are correct.

## Confirmation: `letter_prefix` recovered Parts L/M/T

The prior `aashto_decimal` profile matched only `\d{3}\.\d{2}`-style numbers and produced **zero** captured sections on both p.807 and p.854, silently dropping real, titled, numbered content. Under `letter_prefix`, both are now fully recovered:

- **p.807** (`SECTION M07 — SHEET PILING AND PILES`):
  - `M07.11 PILE POINTS AND DRIVE SHOES.` — captured, textlen 127, body verified word-for-word ("Use pile points and drive shoes that are carbon-steel castings that conform to AASHTO M103 (ASTM A27), Class 70 or Grade 70-36.")
  - `M07.12 CLOSURE PLATES AND CAPS.` — captured, textlen 140, body verified word-for-word ("Use closure plates and caps that are mild carbon steel that conforms to AASHTO M270 (ASTM A709), Grade 36."), with the trailing `SECTION M08 —` banner correctly swept into the tail of this section's body rather than mis-starting a new one — the same "banner text absorbed by preceding section" behavior seen throughout the numeric parts (e.g., p.759's `SECTION L07` banner).

- **p.854** (`SECTION M16 — SIGNS AND SIGN SUPPORTS`):
  - `M16.04.7 Parking Sign, Mile Marker, and Delineator Posts.` — captured, textlen 923, body verified word-for-word ("a. Parking Sign Posts. For posts for parking sign mountings, use a U-channel shape made from steel conforming to ASTM A499…").
  - `M16.05` and `M16.05.1 Requirements.` — also captured, extending recovery past the two originally-cited headings.

At the corpus level, total sections rose from 887 → 1,407 (+520, +58.6%), consistent with recovering three entire alpha-prefixed book parts (L/M/T) that were previously invisible to the parser. No sample page in the numeric parts (100–900) regressed, and no spurious lettered-looking matches appeared inside numeric-part prose (e.g., material callouts like "Subsection M01.09" or "Subsection M10.03.2" embedded in body text on p.189 were correctly left as prose references, not mis-parsed as new section starts).

## Empty (2.8%) and lowercase (3.6%) rate characterization

- **Lowercase-start (3.6%)**: directly evidenced in the sample. `M16.04.7`'s captured body begins `"a. Parking Sign Posts. For posts for parking sign mountings…"` — a lowercase lettered sub-list marker (`a.`, `b.`, `c.`) that RIDOT's own source text uses to open the section's content, rather than a capitalized sentence. This is the same "unnumbered lettered sub-item" convention seen throughout the numeric parts too (e.g., item `(6)`/`(7)`/`(8)` on p.94, `a.`/`b.`/`c.` on p.47, p.902), just landing as the very first character of a captured section instead of mid-body. Faithful capture of a genuine source-document formatting choice, not a parse defect.

- **Empty (2.8%, ~39 sections)**: no `textlen: 0` example landed in this 20-page sample, so this cannot be independently confirmed from the sample alone. The closest analog observed is `M16.05` on p.854 (textlen 13, body `"CONSTRUCTION."`) — a title that wraps across a line break (`"REVIEW AND APPROVAL OF MATERIALS USED IN TRAFFIC SIGN"` / `"CONSTRUCTION."`) and gets split so the second half lands in the body field instead of the title — the same mechanism flagged in the 0.1% absorbed-title rate. By analogy to DE's confirmed pattern (bare container headings like `NNN.3 Construction.` immediately followed by a numbered child with no intervening prose — a legitimate document structure, not a defect), and given RIDOT's Part M is dense with tabular material specs and short definitional headings, the empty rate is plausibly the same benign container/title-split behavior. This is a plausible-but-not-directly-confirmed characterization; a targeted follow-up probe of actual `textlen:0` entries would be needed to rule out real loss with full confidence, but nothing in this sample suggests a content-dropping defect, and the rate (2.8%) is in the same range as DE's confirmed-benign 4.9%.

## Verdict rationale

Per the pass bar (samples correct ≥ 19/20 AND no real section text dropped): this sample **passes both**. 20/20 sampled pages are correct, including both previously-confirmed real losses (p.807, p.854), which are now fully recovered with word-for-word verified body text. The broadened `letter_prefix` regex introduced no observed regressions — no spurious splits inside numeric-part prose, no lost headings in the numeric parts, and no false positives on material/subsection cross-references (e.g., "Subsection M01.09") embedded in body text. The empty/lowercase rates are within the range seen on other AASHTO-derivative states (DE) and are explained, to the extent the sample allows, as faithful document-formatting artifacts (lettered sub-list openers, title line-wrap splits) rather than parse defects; the empty-rate characterization carries a caveat since no zero-length example was directly sampled.

**Verdict: PASS.** RI's `letter_prefix` profile recovers the L/M/T alpha-prefixed parts that `aashto_decimal` silently dropped, with no new defects introduced in the 20-page adversarial sample.
