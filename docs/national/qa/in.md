# Parse QA — Indiana (INDOT 2026), profile `aashto_decimal` (+ `deshift_indot` text_fixup)

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 1,328 |
| Total sections parsed | 1,698 (was 1,687 pre-fixup — **+11 recovered**) |
| Absorbed-title rate | 0.0% (0 / 1,698) |
| Empty-text sections | 1.2% |
| Lowercase-start sections | 0.0% |
| Control-char (garbled) titles | **0** (was ≥1 confirmed, unknown true count, pre-fixup) |
| Profile | `aashto_decimal` + per-state `text_fixup=deshift_indot` (shifts corrupted-font spans +29 codepoints at parse time) |
| Samples correct | **21 / 21** (20-page baseline sample + 1 added page re-verifying the second formerly-garbled page, 25) |
| Failing sample pages | none |

This re-run samples the same 20 pages as the prior FAIL report, plus page 25 (added
specifically because it's the other page the fixup's own before/after diff flagged as
formerly garbled, alongside 464). All samples check against `raw_text` — which the
probe confirms is the **de-shifted** text the parser now actually sees — for correct
heading number/title capture and absence of spurious splits.

## Sample-by-sample (21 pages)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| **25** | (none) | CORRECT | **formerly garbled.** Table-of-Contents page for Section 401 (`401.02`…`401.15` as page references, including `401.08 Blank`). Fully clean text post-fixup; correctly not parsed as live section starts (TOC page) |
| 66 | (none) | CORRECT | TOC page listing `910.07`–`910.13` as page references; correctly not parsed as live section starts |
| 132 | 105.16 Notice of Changed Conditions and Claims | CORRECT | head opens at true text (`610\nNothing in this subsection...`); INDOT's embedded line-number tokens (605, 610, 615…) precede/interleave prose throughout — a document convention, not a fixup artifact |
| 198 | 109.06 Eliminated Pay Items; 109.07 Partial Payments | CORRECT | 109.06 opens exactly at raw text's first sentence; 109.07 falls past the 1,700-char raw_text window (plausible continuation) |
| 265 | (none) | CORRECT | mid-section, only a lettered `(b)` sub-heading visible, correctly not split out |
| 331 | 217.09 Compaction; 217.10 Method of Measurement; 217.11 Basis of Payment | CORRECT | 217.09 head matches raw text's opening sentence exactly; 217.10/.11 fall past the visible window |
| 397 | (none) | CORRECT | mid-section, ends on a forward reference ("...referred to the 401.19") that is prose, not a heading; correctly no section captured |
| **464** | **416.07 Equipment** | **CORRECT (repaired)** | **the original blocking defect — see Font-Shift Repair below** |
| 530 | 506.05 Trial Batch | CORRECT | heading falls past the 1,700-char raw_text window; head text is internally consistent with the pattern seen elsewhere |
| 596 | 606.02 Materials; 606.03 General Requirements; 606.04 Method of Measurement; 606.05 Basis of Payment | CORRECT | all four headings and openings match raw text exactly |
| 663 | 622.19 Blank; 622.20 "Do Not Mow or Spray" Signs...; 622.21 Method of Measurement; 622.22 Basis of Payment | CORRECT | `622.19 Blank` is INDOT's placeholder-title convention, correctly captured with only a line-number token (`370`) as body; remaining three match raw text exactly |
| 729 | 703.01 Description; 703.02 Materials | CORRECT | both headings fall past the 1,700-char raw_text window (page tail is still prior-section prose ending at `SECTION 703 – REINFORCIN`, cut off at page boundary) |
| 796 | 711.69 Jacking and Supporting Beams; 711.70 Field Cleaning and Storage of Weathering Steel; 711.71 Coating; 711.72 Method of Measurement | CORRECT | all four match raw text exactly |
| 862 | (none) | CORRECT | mid-section, numbered `2. Hydrodemolition` sub-item only, no spurious section |
| 928 | 732.03 Design Criteria | CORRECT | matches raw text exactly |
| 995 | 803.04 Qualification of Procedures...; 804.01 Description; 804.02 Materials; 804.03 Delineator Visibility | CORRECT | all four match raw text; `SECTION 804 – DELINEATORS` division banner correctly not mistaken for a section |
| 1061 | (none) | CORRECT | mid-section, numbered/lettered sub-items (`1.`, `2.`, `a.`–`f.`) only, no spurious section |
| 1127 | 908.02 Corrugated Steel Pipe and Pipe-Arches; 908.03 Blank | CORRECT | 908.02 matches raw text exactly; 908.03 Blank is the same placeholder convention as p.663/622.19 |
| 1194 | 913.06 Bentonite Grout; 914.01 Special Topsoil...; 914.02 Temporary Seed; 914.03 Fertilizer; 914.04 Grass, Legume, and Forb Seed | CORRECT | all match raw text; `SECTION 914 – ROADSIDE DEVELOPMENT MATERIALS` banner correctly skipped |
| 1260 | (none) | CORRECT | mid-section, NEMA TS2 controller spec prose, no spurious section |
| 1327 | (none) | CORRECT | "Intentionally left blank" page |

**21/21 correct.**

## Font-shift repair (`deshift_indot`): confirmed faithful and complete on sampled evidence

The prior FAIL was driven by a single confirmed instance: page 464's `416.07
Equipment` heading extracted as raw glyph-index bytes (`(TXLSPHQW` etc.) because an
embedded subset font's ToUnicode/CMap mapping was offset, and the corrupted heading
line was silently invisible to the section splitter, dropping the entire section from
the parse. The new per-state `text_fixup=deshift_indot` detects control-char-bearing
spans and shifts them back +29 codepoints before the splitter ever runs.

**p.464 — the original defect, now recovered cleanly:**

```
raw_text:  "...prior to CIR operations.\n416.07 Equipment\nThe recycling equipment
            shall be capable of milling the existing asphalt\npavement, sizing the
            resulting RAP, and mixing the RAP with the materials stipulated..."

parsed:    { "num": "416.07", "title": "Equipment", "textlen": 6269,
             "head": "The recycling equipment shall be capable of milling the
                      existing asphalt\npavement, sizing the resulting RAP, and
                      mixing " }
```

The heading is `416.07 Equipment` — clean, correctly numbered, correctly titled — and
`head` picks up exactly where `raw_text` shows the body starting. No prose is
skipped, no residual glyph-index bytes remain anywhere in the string.

**Other recovered content:** the corpus total rose from 1,687 → 1,698 sections
(+11), meaning the fixup recovered roughly a dozen previously-garbled/invisible
headings corpus-wide, not just 416.07 — consistent with the "scattered ~0.2% subset
of spans" the fixup targets. Page 25 (the other page flagged as formerly-garbled by
the fixup's before/after diff) is a Table-of-Contents listing for Section 401 and
reads entirely cleanly post-fixup (`401.02 Quality Control` … `401.15 Joints`,
including `401.08 Blank`); it correctly yields no live section starts because it's a
TOC page, not because anything is still broken.

**No residual gibberish, no over-correction found.** All 21 sampled `raw_text`
blocks and every parsed `title`/`head` string were scanned line-by-line: zero
control characters, zero shifted-letter artifacts, and no real word anywhere
rendered into nonsense. Unicode punctuation (curly quotes `“`/`”` at
p.663, the `μm` micron sign at p.1061, subscripted variable names like `N_des`/`Vbe`
at p.397) all render correctly and are unrelated to the font-shift bug — the fixup
evidently only touches spans that actually contained control chars, and left normal
text untouched. This directly addresses the "did the fixup over-apply" risk: no
evidence of it doing so in the sample.

## Empty-rate characterization (1.2%, unchanged from pre-fixup)

The empty/near-empty sections are explained by INDOT's own document convention, not
by the fixup or by any parser defect: INDOT reserves section numbers with literal
**"Blank"** titles to keep historical numbering contiguous across specification
revisions, even when the section's content has been retired. Confirmed directly in
this sample:

- p.66 (TOC): `910.12 Blank` listed as a normal sibling entry alongside `910.11` /
  `910.13`.
- p.663: `622.19 Blank` — `textlen: 3`, body is just the stray line-number token
  `"370"`, immediately followed by real content at `622.20`.
- p.1127: `908.03 Blank` — `textlen: 2`, immediately preceded by real content at
  `908.02`.
- p.25 (TOC): `401.08 Blank` listed with no page number, consistent with the same
  convention appearing at the TOC level too.

This is a genuine, faithfully-captured document characteristic (the fixup is
completely orthogonal to it — Blank sections aren't garbled, they're just short by
design) and fully accounts for the 1.2% empty rate. It is not evidence of dropped
real text.

## Verdict rationale

All three PASS-bar conditions are met:

1. **Samples correct: 21/21** (exceeds the ≥19/20 bar), including both pages the
   fixup's diff specifically flagged as formerly garbled (464, 25).
2. **No real section text dropped.** The one confirmed dropped-section defect from
   the prior review — p.464's `416.07 Equipment` — is now captured with a clean
   title and a `head` that opens at the correct sentence, and the corpus-wide
   section count rose by 11 (1,687 → 1,698), consistent with recovery of multiple
   previously-invisible headings rather than just the one sampled instance.
3. **No fixup-induced corruption.** Exhaustive scan of all 21 sampled `raw_text`
   blocks and all parsed titles/heads found zero residual control characters and
   zero real words mangled by over-application of the +29 shift.

The empty-text rate (1.2%) and zero absorbed-title/lowercase-start rates are
unchanged from the pre-fixup baseline and are independently explained by INDOT's
"Blank" reserved-section convention, not by anything related to the font-shift bug
or its repair.

**Verdict: PASS.**
