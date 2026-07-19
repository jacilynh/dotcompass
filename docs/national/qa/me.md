# Parse QA — Maine (MaineDOT, March 2026), profile `section_prefix`

**Verdict: PASS**

Re-score after the shared-engine header-band fix. Prior run (see git history /
prior report content) failed at 19/20 on a confirmed real-content miss at
page 612 (`SECTION 613 - EROSION CONTROL BLANKETS` not captured, a symptom of
the engine's header-band filter stripping headings that open at the top of a
page). That engine bug is fixed; this re-probe confirms the fix and finds no
new defects.

## Headline numbers

| Metric | Value |
|---|---|
| Total pages | 944 |
| Total sections parsed | 164 (up from 146 pre-fix) |
| Empty-text sections | 22.6% (~37 / 164) |
| Lowercase-start sections | 0.0% |
| Absorbed-title rate | 0.0% |
| Samples correct | **20 / 20** |
| Profile | `section_prefix` (SECTION-level granularity only — clause numbers like `103.3.3`, `401.17`, `502.041` are body text, not separately addressable sections) |

## Sample-by-sample (20 pages, same set as prior run)

| Page | Sections claimed to start here | Verdict | Note |
|---|---|---|---|
| 47 | (none) | CORRECT | mid-clause (103.3.3 Appeal), no SECTION heading on page |
| 94 | (none) | CORRECT | mid-clause (105.10.2), no SECTION heading on page |
| 141 | (none) | CORRECT | mid-section item/price table, no heading |
| 188 | (none) | CORRECT (quirk) | `SECTION 3 - OTHER FEDERAL REQUIREMENTS` visible in raw text but correctly absent — restarted low-numbered federal-provisions series, dropped by the monotonic section-number filter. See quirk section below. |
| 235 | (none) | CORRECT | mid-clause (202.xx removal payment), no heading |
| 282 | (none) | CORRECT | mid-clause (308.04), no heading |
| 329 | (none) | CORRECT | mid-clause (401.17–401.18), no heading |
| 377 | (none) | CORRECT | mid-clause (502.041), no heading |
| 424 | (none) | CORRECT | mid-clause (503.06), no heading |
| 471 | 508 WATERPROOFING MEMBRANE | CORRECT (limited visibility) | `SECTION 508` heading falls just past the 1700-char raw-text truncation (page tail shown is still 507's method-of-measurement/pay-item content); captured `head` opens cleanly at "508.01 Description – This work shall consist of…", consistent with well-formed openings seen elsewhere on the page. Same situation as pre-fix run; unaffected by the header-band fix (this heading is mid-page, not top-of-page). |
| 518 | (none) | CORRECT | mid-clause (bearing pot/piston spec), no heading |
| 565 | (none) | CORRECT | mid-clause (gabion assembly; `601.05` is a body clause number, not a SECTION heading), no heading |
| **612** | **613 EROSION CONTROL BLANKETS (textlen 2142)** | **CORRECT — FIX CONFIRMED** | `SECTION 613 - EROSION CONTROL BLANKETS` is the first content on the page (immediately after the "6-49" folio header). Previously dropped entirely; now captured with correct number, correct title, and a head (`613.01 Description - This work shall consist of furnishing and installing erosion control blankets...`) that matches the raw text verbatim. See fix-confirmation section below. |
| 660 | (none) | CORRECT | mid-clause (foundation grading/sealer spec), no heading |
| 707 | (none) | CORRECT | mid-clause (sign support fatigue factors), no heading |
| 754 | 659 MOBILIZATION; 660 ON-THE-JOB TRAINING | CORRECT | both `SECTION 659` and `SECTION 660` appear mid-page (after 658's pay-item table) and are captured cleanly, openings and titles intact |
| 801 | (none) | CORRECT | mid-clause (677.11 backfill placement), no heading |
| 848 | 708 PAINTS AND PRESERVATIVES; 709 REINFORCING STEEL AND WELDED STEEL WIRE FABRIC | CORRECT | both mid-page SECTION headers captured cleanly, openings and titles intact |
| 895 | (none) | CORRECT | mid-page bolded subheading "Cabinet Testing Requirements" has no `SECTION NNN` number — not a section boundary, correctly not captured |
| 943 | (none) | CORRECT | back-matter index page, no heading |

**20 / 20 correct.** No missed headings, no spurious sections, no title/number mismatches, no boundary errors.

## Engine-fix confirmation: page 612 / SECTION 613 recovered

Page 612's raw text is unchanged from the prior probe — `SECTION 613 -
EROSION CONTROL BLANKETS` still opens immediately at the top of the page
(right after the "6-49" folio line), followed by populated `613.01`–`613.05`
(and `613.08`) subsections. In the pre-fix run this heading was silently
dropped from `parsed_sections_starting_here` — the exact symptom described in
the review brief (header-band filter stripping top-of-page headings).

In this re-probe, page 612 now yields:

```
num='613' title='EROSION CONTROL BLANKETS' textlen=2142
head: '613.01\nDescription - This work shall consist of furnishing and installing erosion control\nblankets on previously prepare...'
```

Number, title, and opening body text all match the source exactly. This is a
direct, page-level confirmation that the engine fix resolved the specific
defect that failed ME's first Stage 2 QA. Corpus-wide, total sections rose
146 → 164 (+18), consistent with recovering a batch of similar top-of-page
SECTION headings beyond just page 612 (not all directly sampled, but the
mechanism and the section-count delta are consistent with the fix's stated
scope).

## Characterizing the 22.6% empty-section rate

Total sections rose 146 → 164 while the empty count improved from 36/146
(24.7%) to ~37/164 (22.6%) — a lower *rate* despite the corpus recovering 18
additional sections, which is consistent with (not proof of) the fix also
repairing some previously-truncated bodies rather than only recovering bare
headings.

As with the prior run, **none of the 20 sampled pages lands directly on a
section with `textlen: 0`** — every section actually captured in this sample
(508, 613, 659, 660, 708, 709) has substantial non-zero body text, including
the previously-missing 613 (2142 chars, clearly not a stub). This sample
therefore still cannot directly confirm, page-by-page, that the remaining
~37 empty sections are benign (e.g., a bare `SECTION NNN` header immediately
followed by another header/divider) versus a residual, narrower text-loss
defect distinct from the one that's now fixed.

What this sample *does* establish, per the review brief's standard: no
sampled page shows a **confirmed real loss**. The one previously confirmed
loss (page 612) is now recovered, and no new loss was found anywhere in the
20-page spread — including on pages adjacent to Division boundaries (565,
612, 660) and pages with multiple mid-page SECTION headings (754, 848),
which are exactly the pattern classes most likely to expose a boundary bug.
Per the review brief's instruction — treat a confirmed real loss as FAIL,
but do not fail for an unresolved-but-unconfirmed risk or for documented
structural quirks — the empty-rate is logged as an **open item for
corpus-level spot-checking outside this sample**, not a blocking defect.

## The documented quirk: restarted federal-provisions SECTION series (unchanged, expected)

Maine's book embeds a "Federal Contract Provisions Supplement" (Appendix A,
printed folio `A-13` on page 188) that **restarts its own SECTION numbering
at 1**, independent of the main document's SECTION 100s/500s/600s/700s/800s
sequence. Page 188's raw text shows this directly:

```
SECTION 3 - OTHER FEDERAL REQUIREMENTS
Unless expressly otherwise provided in the Bid Documents, the provisions contained in
this Section 3 of this "Federal Contract Provisions Supplement" are hereby incorporated
into the Bid Documents and Contract.
```

By this point the main document has already emitted sections in the 100s
(e.g., 103, 105) and goes on to emit 200s–900s later in the book. Because the
parser's `section_prefix` extraction enforces a monotonically increasing
SECTION number, `SECTION 3` (and the preceding `SECTION 1`/`SECTION 2` of the
same restarted federal series) falls below the running high-water mark and
is correctly excluded from `parsed_sections_starting_here`. This is a
legitimate, structural characteristic of MaineDOT's federal-provisions
appendix, not a parser defect, and is **not** counted against this state's
score, per the review brief's explicit instruction.

## Verdict rationale

Per the pass bar (≥19/20 samples correct AND no real section text dropped):
this re-probe scores **20/20**, an improvement on the pre-fix 19/20, and the
one previously confirmed blocking defect — page 612 / SECTION 613 — is
directly verified as recovered with faithful number, title, and body text.
No new defects were found anywhere in the 20-page spread: no missed
headings, no spurious sections, no boundary errors, absorbed-title rate
0.0%, lowercase-start rate 0.0%. The corpus's 22.6% empty-section rate could
not be fully bounded from 20 pages (none of the samples landed on a
`textlen: 0` section), but per the review brief's standard this is an open
item, not a confirmed defect, and does not override an otherwise clean
sample. The restarted federal-provisions series (page 188) remains a
documented, expected quirk and is excluded from scoring.

**Verdict: PASS.**
