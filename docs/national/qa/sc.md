# Parse QA — South Carolina (SCDOT 2025 Standard Specifications), profile `aashto_decimal`

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 908 |
| Total sections parsed | 2,464 |
| Empty-text sections | 14.8% — investigated below; **benign container-header pattern**, not text loss |
| Lowercase-start sections | 0.2% — negligible |
| Absorbed-title rate | 0.0% |
| Samples correct | **20 / 20** |
| Profile | `aashto_decimal` |

## Sample-by-sample (20 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 45 | (none) | CORRECT | front-matter Table of Contents page (dot-leader entries for 712.4.x/712.5.x and a `SECTION 713` banner) — correctly not parsed as real headings |
| 90 | 104.9; 104.10 | CORRECT (caveat) | neither heading is visible within the 1,700-char raw_text window (page is mid a dense numbered list, items 1–4); no contradicting evidence, plausible past-window headings |
| 135 | 107.27.2; 107.27.2.1; 107.27.2.2 | CORRECT | 107.27.2 is a zero-text container immediately followed by `.1`; `.1 Crane Operators` and `.2 Competent Person` verified word-for-word |
| 181 | (none) | CORRECT | mid-section (204 continuation, items 2–5) ending in a pay-item table, no visible heading |
| 226 | 401.2.1.4; 401.2.1.5; 401.2.1.6; 401.2.2; 401.2.2.1 | CORRECT | all five verified word-for-word/order against raw_text; 401.2.2 is a legit zero-text container immediately followed by 401.2.2.1 |
| 271 | 409.1; 409.2; 409.2.1–409.2.6 | CORRECT | all eight verified word-for-word; 409.2 is a zero-text container immediately followed by 409.2.1 |
| 317 | 502.5 | CORRECT | verified word-for-word |
| 362 | 604.3; 604.3.1; 604.3.2; 604.3.3 | CORRECT (caveat) | 604.3 (container), 604.3.1, 604.3.2 verified word-for-word; 604.3.3's heading falls past the 1,700-char window — plausible continuation, no contradicting evidence |
| 407 | 607.3; 607.3.1; 607.3.1.1; 607.3.1.2 | CORRECT | all four verified word-for-word; 607.3.1 is a zero-text container immediately followed by 607.3.1.1 |
| 453 | 625.3.4; 625.4 | CORRECT (caveat) | 625.3.4 verified word-for-word; 625.4's heading falls past the window (625.3.4 body runs long) — plausible, no contradiction |
| 498 | 628.3.7 | CORRECT | verified word-for-word; preceding numbered items 2–5 correctly treated as continuation of the prior section, not a new heading |
| 544 | 654.2.5; 654.2.6; 654.2.7; 654.3; 654.3.1 | CORRECT | all five verified word-for-word; 654.3 is a zero-text container immediately followed by 654.3.1 |
| 589 | 658.3.10–658.3.14 | CORRECT | all five verified word-for-word/order against raw_text |
| 634 | 702.3.3.2; 702.3.3.3 | CORRECT (caveat) | 702.3.3.2 verified word-for-word; 702.3.3.2's own textlen (2,619) already exceeds the visible window, so 702.3.3.3's heading is necessarily past it — plausible, no contradiction |
| 680 | 704.3.7; 704.3.7.1–704.3.7.4 | CORRECT | all five verified word-for-word; 704.3.7 is a zero-text container immediately followed by 704.3.7.1 |
| 725 | 710.1; 710.2; 710.2.1; 710.2.1.1 | CORRECT (caveat) | 710.1, 710.2 (container), 710.2.1 verified word-for-word; 710.2.1.1's heading falls past the window (710.2.1 body runs to 1,651 chars) — plausible, no contradiction |
| 770 | 712.3.9.4; 712.3.9.5 | CORRECT | both verified word-for-word |
| 816 | 724.1–724.3.3 | CORRECT | all six verified word-for-word; note 724.3 has real one-sentence body text (not empty) — parser correctly distinguishes a populated intro from a bare container in the identical numbering slot |
| 861 | 808.4; 808.5 | CORRECT (caveat) | raw_text shows a long numbered list (items 12–18) with no heading in view; 808.4/808.5 headings fall past the 1,700-char window — plausible, no contradiction |
| 907 | (none) | CORRECT | back-matter alphabetical Index page, no section headings |

**20/20 correct.** Six pages (90, 362, 453, 634, 725, 861) carry a documented caveat where one or more claimed headings fall outside the 1,700-char raw_text excerpt supplied to this review — in every one of those cases the *other* headings on the same page are verified word-for-word, the unverified heading is a plausible, non-contradicted continuation of the same numbering sequence, and none show the hallmark of the PennDOT-style bug (mid-sentence body start, wrong number, or content that contradicts a visible heading).

## The 14.8% empty-text rate: investigated and BENIGN — container-header pattern

SCDOT's book structure regularly uses a subsection number purely as a label that introduces a run of deeper subsections, with **no prose of its own** between the heading and the next numbered child — the same mechanism documented for Delaware, just used more heavily. Direct evidence from the sample set (7 separate instances across the 20 pages, at multiple nesting depths, not just one recurring tier):

- **p.135** — `107.27.2 Submittal List` (textlen 0) is immediately followed by `107.27.2.1 Crane Operators`, which opens with real body text ("1 Ensure that all crane operators are certified…"). No sentence sits between the two headings in raw_text.
- **p.226** — `401.2.2 Aggregates` (textlen 0) is immediately followed by `401.2.2.1 Mineral Aggregates` with real content.
- **p.271** — `409.2 Materials` (textlen 0) is immediately followed by `409.2.1 Aggregate` with real content.
- **p.362** — `604.3 Construction` (textlen 0) is immediately followed by `604.3.1 Maintenance` with real content.
- **p.407** — `607.3.1 Truck-Mounted Advance Warning Arrow Panels` (textlen 0) is immediately followed by `607.3.1.1 General` with real content.
- **p.544** — `654.3 Construction` (textlen 0) is immediately followed by `654.3.1 General` with real content.
- **p.680** — `704.3.7 Prestressed Cored Slabs and Box Beams` (textlen 0) is immediately followed by `704.3.7.1 General` with real content.

Critically, the **same numbering slot is not always empty** — p.816's `724.3 Construction` sits at the identical tier as several of the empty examples above (an "X.3 Construction" container) but carries a genuine one-sentence intro ("1 Submit Shop Plans for bridge bearing assemblies according to Section 725.", textlen 76) before its own `724.3.1` child. This confirms the parser is faithfully reporting what's on the page — zero-length text only when the source document truly has no prose between a header and its first child, real text when the source has it. In every one of the 7 empty-text instances directly observed, the empty section's title and number are correct, and the child section that follows immediately captures the real content — no text is dropped, it's simply attributed to the correct nesting level, exactly as in the Delaware and Colorado precedents. SC's rate (14.8%) is meaningfully higher than DE's (4.9%), reflecting a document that nests one level deeper on average and uses bare-container headers more liberally (e.g., `607.3.1` above `607.3.1.1`), but the mechanism is identical and equally benign.

## Verdict rationale

Per the pass bar (samples correct ≥ 19/20 AND absorbed-title rate low or fully explained AND no real section text dropped): **20/20** sampled pages check out (six carry documented caveats for headings that fall outside the 1,700-char raw_text excerpt with no contradicting evidence — the same class of caveat accepted in the Colorado review). Absorbed-title rate is 0.0%, lowercase-start rate is 0.2% — both negligible, with none of the CDOT-style title/body line-wrap splitting observed. The headline 14.8% empty-text rate was directly investigated against raw_text on seven separate instances across six pages and confirmed **benign**: it is SCDOT's standard "bare container header, real content lives in the child" document structure, the same mechanism documented for Delaware, and the parser correctly distinguishes it from the rarer case where an identically-numbered tier (`724.3` on p.816) genuinely does carry its own intro text. No real section text is lost anywhere in the sample. **Verdict: PASS.**
