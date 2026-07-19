# Parse QA — Ohio (ODOT 2023 Construction & Material Specifications), profile `aashto_decimal`

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 892 |
| Total sections parsed | 1,544 |
| Empty-text sections | 3.4% |
| Lowercase-start sections | 62.2% — investigated below; **benign**, not text loss |
| Absorbed-title rate | 2.2% |
| Samples correct | **20 / 20** |
| Profile | `aashto_decimal` |

## Sample-by-sample (20 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 44 | (none) | CORRECT | mid-section lettered A–D list (Clean Air Act cert.) continuing into stream-crossing prose, no heading visible |
| 88 | 202.09; 202.10; 202.11 | CORRECT | 202.09 verified word-for-word (title+head concatenation is an exact match to raw_text); 202.10/202.11 fall beyond the 1,700-char window, no contradicting evidence |
| 133 | (none) | CORRECT | Item/Unit/Description reference table (254 Pavement Planing), not prose headings |
| 177 | (none) | CORRECT | mid-section QC sampling/testing prose (403-series), no heading visible |
| 222 | 422.13; 422.14 | CORRECT | both verified word-for-word — title+head concatenation reproduces raw_text exactly, including the mid-sentence 422.14 split ("...labor to / make corrections.") |
| 266 | (none) | CORRECT | mid-section dowel-bar-inserter (DBI) prose, no heading visible |
| 311 | 506.01; 506.02; 506.03 | CORRECT | 506.01/506.02 verified word-for-word; 506.03 beyond window, plausible continuation |
| 356 | 512.08 | CORRECT (caveat) | heading not visible within the 1,700-char window — the page shows unrelated epoxy-crack-injection repair prose throughout; title "Waterproofing" and head ("apply an even and uniform coating of asphalt materials using brushes, squeegees, or spray equipment") are thematically consistent with ODOT's real Item 512 structure (epoxy-injection repair subsection followed by a Waterproofing subsection), and the large textlen (7,332) matches a genuine multi-page section beginning later on the same page, past the excerpt cutoff. No contradicting evidence found — flagged for transparency, not a confirmed defect. |
| 400 | 515.06; 515.07; 515.08 | CORRECT | 515.06 verified word-for-word; 515.07/08 beyond window, no contradiction |
| 445 | 601.07; 601.08; 601.09; 601.10 | CORRECT | 601.07/601.08 verified word-for-word; 601.09/601.10 beyond window |
| 489 | (none) | CORRECT | Item/Unit/Description pipe-schedule table (Item 611), not prose headings |
| 534 | 624.01; 624.02; 624.03; 624.04 | CORRECT | all four verified word-for-word, including the short 624.03 (textlen 21, "acceptably performed.") |
| 578 | 633.01; 633.02; 633.03; 633.04; 633.05; 633.08 | CORRECT | 633.01–633.03 verified word-for-word; 633.04 (textlen 0) is a plausible single-line section past the visible cutoff; 633.05/633.08 beyond window, no contradiction; numbering gap at .06/.07 unconfirmed but not contradicted |
| 623 | 657.01…657.08 | CORRECT | 657.01–657.04 verified word-for-word; 657.05–657.08 beyond window |
| 668 | (none) | CORRECT | QC/QA material-acceptance reference table (Item 707 pipe materials) — tabular "Spec No." rows are not prose section headings; correctly not parsed |
| 712 | (none) | CORRECT | test-method reference list + mid-section "E. Steel Slag Aggregate" prose, no true ODOT heading present |
| 757 | (none) | CORRECT | quoted ASTM sub-clause numbering (11.3.1, 11.4, 11.9, 11.10, 14) embedded in a reproduced pipe spec — correctly not parsed as ODOT `NNN.NN` sections |
| 801 | 710.12 | CORRECT | verified word-for-word; preceding AASHTO M168 sub-clause numbers (5.5.1, 6.2, 7.1, 7.2) correctly not parsed as sections |
| 846 | 731.06; 731.07; 731.08; 731.10 | CORRECT | 731.06 verified word-for-word; 731.07/08/10 beyond window, no contradiction |
| 891 | 748.11; 748.12; 748.13; 748.14; 748.15 | CORRECT | 748.11–748.13 verified word-for-word; 748.14/748.15 beyond window |

**20/20 correct.**

## The 62.2% lowercase rate: investigated and BENIGN, not the PennDOT text-drop bug

ODOT's C&MS uses a consistent per-subsection format: `NNN.NN \n<Caption>. <run-on body prose starting on the same physical line>`, then the PDF line wraps and body prose continues. The parser's `title` field grabs the caption plus however much of the first body sentence fits before the physical line break; `head` continues from the exact next word. Concatenating `title` + `head` reproduces the source text exactly, letter for letter, in every page checked:

- **422.14** (p.222): raw reads "...for materials, equipment, or labor to / make corrections." `title` ends "...or labor to"; `head` begins "make corrections." — exact, lossless continuation across the line wrap.
- **506.01** (p.311): raw reads "...applying a static load to a driven pile and furnishing / instruments and facilities to obtain load-displacement data..." `title` ends "...and furnishing"; `head` begins "instruments and facilities..." — nothing dropped.
- **601.07 / 601.08** (p.445): both split mid-sentence at the physical line break ("...6 inches (150 mm) thick, / extending over the embankment..." and "...conforming to 703.19. Dump larger pieces at the / outer face and smaller pieces..."), and both reassemble to the exact raw_text with concatenation.
- **624.01 / 624.04** (p.534): "...operations including, but / not limited to, those necessary..." and "...according to 109.09 and / as modified by the following schedule:" — same pattern, no loss.
- **633.01–633.03** (p.578) and **657.02–657.04** (p.623): same mechanism repeated across five more sections, all verified word-for-word against raw_text.

This is the opposite failure mode from the PennDOT em-dash bug (where the parser discarded the entire first physical line and body text began mid-sentence with the opening clause **gone**, unrecoverable from either field). Here the caption line legitimately runs into body prose within a single PDF text line before the layout engine wraps, `title` absorbs that whole first line, and `head` simply resumes at the next physical line with whatever word happens to be there — frequently lowercase because it's the tail of a sentence that started in `title`. No section's opening sentence is lost anywhere in the sample; it is always fully present across `title`+`head`.

One related, non-blocking note: because `title` routinely absorbs a chunk of body prose beyond the caption (e.g. 624.01's "title" is "Description. This work consists of the preparatory work and operations including, but" — a full clause, not just a caption), any downstream UI rendering `title` as a bolded heading will show an overlong, sentence-fragment "title" for the majority of sections. This is a display/labeling nuance for future polish, not a text-fidelity defect — the full text is captured and recoverable by concatenation, exactly as in Colorado's `aashto_decimal` corpus.

## Verdict rationale

Per the pass bar (samples correct ≥ 19/20 AND absorbed-title rate low or fully explained AND no real section text dropped): **20/20** sampled pages check out (one caveat at p.356/512.08, where the heading falls outside the 1,700-char raw_text window with no contradicting evidence and strong thematic/structural plausibility — not a confirmed text-loss defect). Absorbed-title rate is 2.2%, low. The headline 62.2% lowercase-start rate was directly investigated against raw_text on eight-plus sections across six pages and confirmed **benign**: it is an artifact of ODOT's caption+body-prose-on-one-line format splitting at the PDF's physical line-wrap boundary, not the PennDOT-style text-drop bug — `title` + `head` concatenation reproduces the full source sentence in every case checked, with no opening clause lost. **Verdict: PASS.**
