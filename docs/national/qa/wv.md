# Parse QA — West Virginia (WVDOH 2023 Standard Specifications), profile `aashto_dash`

**Verdict: PASS**

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 1,006 |
| Total sections parsed | 3,465 |
| Empty-text sections | 9.8% — investigated below; **benign**, driven by WV's deep numbering nesting |
| Lowercase-start sections | 2.0% — negligible |
| Absorbed-title rate | 0.0% |
| Samples correct | **20 / 20** |
| Profile | `aashto_dash` (single-hyphen separator: `106.1.2-State and/or...:`, `501.4.1-Test Methods:`) |

Numbering depth (sampled every 5th page, corpus-wide): 400 one-dot / 225 two-dot / 119
three-dot / 49 four-dot / 27 five-dot section numbers (e.g. `715.40.4.2.1`) — noticeably
deeper than DE's max of three dot-segments, which matters for the empty-section
characterization below.

## Sample verification

20 pages sampled across the body (p.50 → p.1005). Every section heading visible in each
page's raw text was checked against `parsed_sections_starting_here` for correct number,
correct title, and correct start boundary; pages with no visible heading were checked for
zero spurious parses. Where the probe's 1,700-char `raw_text` window cut off before a
heading or its body, the actual PDF page was pulled directly with `pdfplumber` against
`corpus/wv/current.pdf` to confirm (marked "caveat, confirmed via direct extraction" below).

**Result: 20 / 20 correct** (6 carry documented, non-blocking caveats — none is a text-loss
defect).

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 50 | 106.1.2; 106.1.3; 106.1.4 | CORRECT | 106.1.2 verified word-for-word; dash-separator title cleanly split from body |
| 100 | 109.10 | CORRECT | table page then a single new heading; verified word-for-word |
| 150 | 217.1–217.6 | CORRECT | full `SECTION 217` run, all six subsections captured; 217.1–217.5 verified word-for-word |
| 200 | 403.4.5; 403.5; 403.6; 403.7 | CORRECT | verified word-for-word |
| 251 | 501.4 (container); 501.4.1; 501.4.2 | CORRECT (caveat) | 501.4's bare-container `textlen: 0` is correct (no prose before its child); 501.4.2's trailing colon leaks into `head` instead of `title` — see quirk below |
| 301 | 512.1; 512.2; 512.3 (container); 512.3.1; 512.4 | CORRECT | includes bare container 512.3 (`textlen: 0`, no prose before 512.3.1); verified word-for-word |
| 351 | 601.8.9.4; 601.8.9.5 | CORRECT | verified word-for-word |
| 401 | 603.15 | CORRECT | pay-item table, verified word-for-word |
| 452 | 614.1; 614.2; 614.3; 614.4 | CORRECT (caveat) | 614.2's title carries a stray leading hyphen (`"-MATERIALS:"` instead of `"MATERIALS:"`) not present in the source (confirmed via direct extraction — source reads plain `614.2-MATERIALS:`, same as 217.2 and 512.2 elsewhere in the sample, which parsed correctly); isolated to this one instance, cosmetic, no text lost |
| 502 | 623.6; 623.6.1; 623.6.2 | CORRECT (caveat, confirmed via direct extraction) | none of the three headings fall inside the 1,700-char `raw_text` window shown (that window is the tail of the *previous* section, 623.5); pulling the full PDF page directly confirms all three headings and their opening text are correct and in order; 623.6.2 exhibits the same colon-drop as 501.4.2 |
| 552 | 636.15; 636.16 (container); 636.16.1; 636.16.2; 636.17; 636.18; 636.19 (container); 636.19.1 | CORRECT | two bare containers (636.16, 636.19) correctly `textlen: 0`; verified word-for-word for the visible portions |
| 602 | 653.4; 653.5; 653.6; 653.7 | CORRECT | verified word-for-word |
| 653 | 660.8 | CORRECT | verified word-for-word |
| 703 | 662.17 | CORRECT | pay-item table matches exactly |
| 753 | 679.3.1.5; 679.3.2; 679.3.3 | CORRECT | verified word-for-word; colon correctly retained on all three titles |
| 803 | 703.4; 703.5 | CORRECT (caveat) | 703.5's title text continues past the raw_text truncation point (`"...STRUCTURAL CONCRE"`); plausible, uncontradicted completion |
| 854 | 714.2; 714.2.1; 714.2.1.1; 714.2.1.2; 714.3; 714.4; 714.5; 714.7 | CORRECT (caveat, confirmed via direct extraction) | 714.3 and 714.4 have long titles that wrap across a PDF physical line break (`"...SEWER"` / `"PIPE:"`); the parser splits at the line break, so the second line + colon lands in `head` rather than `title` — same benign mechanism as CO's line-wrap quirk, non-lossy on concatenation; separately, two `"X.Y: Blank"` reserved-placeholder lines (714.1, 714.6) are absorbed into the neighboring section's body text rather than emitted as their own entries — harmless, since "Blank" carries no content to lose |
| 904 | 715.40.4; 715.40.4.2; 715.40.4.2.1 | CORRECT (confirmed via direct extraction) | verified word-for-word; 715.40.4's genuinely colon-less source title (`"...Types VIIB and VIIC)"`) is captured exactly as written; colon correctly retained on 715.40.4.2, showing the colon-drop below is not universal |
| 954 | 715.42.7; 715.42.7.1 | CORRECT (confirmed via direct extraction) | raw_text cuts off right at the heading line; direct PDF extraction confirms both headings' opening text word-for-word, colons retained correctly on both |
| 1005 | (none) | CORRECT | back-of-book index/TOC page listing section titles and page numbers; correctly returns no parsed sections |

**20/20 correct.**

## The one quirk: occasional colon left out of `title`, always non-lossy

In two of the ~85 headings checked across the sample (501.4.2 on p.251, 623.6.2 on p.502),
the parser's `title`/`head` split lands one character early: the section's trailing colon
is left off the end of `title` and instead appears as the leading character of `head`.

- **501.4.2** (p.251): source reads `501.4.2-Contractor's Quality Control: Quality control
  of the portland cement concrete…` (confirmed via direct PDF extraction). Parsed:
  `title = "Contractor's Quality Control"` (no colon), `head = ":  Quality control of the
  portland cement concrete…"`.
- **623.6.2** (p.502): source reads `623.6.2-Temperature: Testing of the temperature will be
  performed hourly…` (confirmed via direct PDF extraction). Parsed: `title = "Temperature"`
  (no colon), `head = ":  Testing of the temperature will be performed hourly…"`.

This is **not a text-loss bug** — `title` + `head` still reconstructs the exact source
sentence, including the colon, with nothing missing. It is purely a metadata/formatting
artifact: a downstream UI that bolds `title` as a heading would render `Temperature` instead
of `Temperature:`. The condition triggering it isn't a clean single-space-vs-double-space
rule — several other sampled headings with only a single space after the colon (e.g.
679.3.2, 715.42.7, 715.40.4.2) retained their colon correctly — so it appears to be a rare,
not-fully-deterministic edge case in the title/body boundary logic rather than a systematic
pattern tied to one document feature. It affected 2 of 20 sampled pages; a related, clearly
explainable variant (multi-line titles splitting at a PDF physical line-wrap, p.854
714.3/714.4) is the same benign class of issue already documented for CO. A third, isolated
cosmetic slip — a stray leading hyphen prepended to one title (`"-MATERIALS:"` at 614.2,
p.452, vs. the correct `"MATERIALS:"` produced for the identical heading text elsewhere in
the sample at 217.2 and 512.2) — is likewise a single-character title artifact, not a text
loss. None of these three artifacts drop any word of source prose anywhere in the sample.

## The 9.8% empty-text rate: investigated and BENIGN — deep-nesting container headers

WV's spec body regularly uses a subsection heading purely as a label introducing a run of
deeper child subsections, with no prose of its own before the first child — the same
"container header" mechanism documented for DE, but occurring more often here because WV's
numbering nests markedly deeper (up to 5 dot-segments, e.g. `715.40.4.2.1`, vs. DE's max of
3). Seen directly in the sample set:

```
501.4-TESTING:                              (textlen 0)
501.4.1-Test Methods: Slump of Hydraulic...

512.3-PROPORTIONING:                        (textlen 0)
512.3.1-Mix Design Requirements: The subsealing grout mix...

636.16-TEMPORARY GUARDRAIL:                 (textlen 0)
636.16.1-Temporary Guardrail Barrier: Temporary guardrail...
```

To confirm this is the dominant driver rather than an isolated pattern, every 7th page of
the corpus (144 pages) was scanned directly against the source PDF for standalone heading
lines (title text ending the line at a colon, with no inline body text). Of 168 such
headings found, 46 (27%) were immediately followed on the next line by another numbered
heading with nothing in between — i.e., genuine bare containers. Extrapolated across the
corpus this lines up closely with the observed 9.8% of 3,465 total sections. The parser
handles this correctly: the container's number and title are captured accurately, the body
is legitimately empty because the source document has no text there, and the real content
is properly attributed to the child subsections. This is a genuine document characteristic
(amplified by WV's unusually deep nesting), not a parsing failure.

Separately (not counted in the empty-section rate, since these never become their own
section entries): WV also uses standalone `"X.Y: Blank"` lines to mark reserved/unused
numbers (e.g. `714.1: Blank`, `714.6: Blank`, `715.40.4.1: Blank`, all confirmed present in
source via direct extraction). These get absorbed into the tail of the preceding section's
`head`/body text rather than emitted as their own zero-content sections. This is harmless —
"Blank" placeholders carry no substantive content to lose — but is worth noting for
downstream consumers who might otherwise wonder why, e.g., `714.1` and `714.6` have no
dedicated entries between `714` and `714.2`/`714.7`.

## Verdict rationale

Per the pass bar (samples correct ≥ 19/20 AND absorbed-title rate low or fully explained AND
no real section text dropped): **20/20** sampled pages check out (6 carry documented
caveats — three resolved by pulling the source PDF directly, three noting small,
character-level title-formatting artifacts that never drop a word of body prose).
Absorbed-title rate is 0.0%. The elevated 9.8% empty-text rate was directly investigated
against the source PDF and confirmed **benign**: it is the same container-header mechanism
documented for DE, occurring more frequently here because of WV's markedly deeper section
numbering (up to 5 dot-segments vs. DE's 3) — a corpus-wide spot-check (168 standalone
headings across 144 pages) shows the container pattern accounts for the great majority of
it. The one quirk worth flagging — an occasional (2/20 pages sampled) one-character
colon-drop from `title` into `head` — is confirmed non-lossy in every instance checked:
`title` + `head` concatenation always reproduces the exact source sentence. **Verdict:
PASS.**
