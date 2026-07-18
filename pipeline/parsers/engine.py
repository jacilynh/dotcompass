#!/usr/bin/env python3
"""
The scheme-independent parsing engine.

Given a spec PDF and a `SpecProfile`, derive the section tree from typography and
ordering alone — no table of contents, nothing about any one state hardcoded. This is
the machinery that was proven across all 17 WSDOT editions (2000-2026); Phase A lifted
it out of `parse_any_edition.py` unchanged so that other states, whose only real
difference is the numbering scheme, can drive it through a different `SpecProfile`.

`parse_specs.py` (the older, WSDOT-only parser) anchors headings to the PDF's embedded
table of contents. That works on recent editions but not across an archive: older books
ship a 2-entry TOC and mid-era ones only division-level entries. Every edition does have
a clean text layer, so this engine measures the document instead of trusting a TOC:

  1. BODY FONT is the modal (font, size) across all lines. A heading is any line that
     opens with a section number in a font that is NOT the body font. This survives every
     typographic era (heading weight is even unnamed in the newest books — "Lato-Heavy" —
     so weight is learned by contrast, not matched by name).
  2. HEADER/FOOTER bands are the y-coordinates shared by nearly every page's first and
     last line. The running header reprints the section heading verbatim, so it is
     stripped by position — and its position moves between editions.
  3. BODY START is chosen by trying every occurrence of the profile's first section and
     keeping whichever yields the most headings that actually have prose under them. This
     self-corrects for two traps: a front-matter contents listing (a full section run with
     no text under its entries) and supplements that RESTART numbering partway through.
  4. MONOTONIC ORDER: section numbers only ever increase through the body, so anything out
     of order is a cross-reference table cell, not a heading. Taken as a longest
     non-decreasing subsequence, so one spurious HIGH number can't reject the rest of the
     book.

Nothing here knows what a WSDOT number looks like; that is the `SpecProfile`'s job.
"""

import re
from collections import Counter

import fitz  # pymupdf

DOT_LEADER = re.compile(r"\.{4,}")  # contents lines: "1-99 APWA SUPPLEMENT......1-119"
WEIGHT = re.compile(r"bold|heavy|black|semibold", re.I)  # the era-specific weight words

BAND_TOLERANCE = 3.0
SUBSTANTIVE = 40  # chars of prose under a heading for it to count as a real section


def detect_bands(doc):
    """The y-coordinates of the running header and footer, measured not assumed."""
    firsts, lasts = Counter(), Counter()
    for pno in range(10, min(doc.page_count, 210)):
        ys = [
            line["spans"][0]["bbox"][1]
            for block in doc[pno].get_text("dict")["blocks"]
            for line in block.get("lines", [])
            if line.get("spans") and line["spans"][0]["text"].strip()
        ]
        if ys:
            firsts[round(min(ys))] += 1
            lasts[round(max(ys))] += 1

    return (
        firsts.most_common(1)[0][0] if firsts else -99,
        lasts.most_common(1)[0][0] if lasts else 99999,
    )


def read_lines(doc, header_y, footer_y):
    """Body lines in reading order, carrying the typography needed to spot a heading."""
    lines = []
    for pno in range(doc.page_count):
        page = []
        for block in doc[pno].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                y = spans[0]["bbox"][1]
                if abs(y - header_y) < BAND_TOLERANCE or abs(y - footer_y) < BAND_TOLERANCE:
                    continue
                first = spans[0]
                page.append(
                    {
                        "page": pno + 1,
                        "y": y,
                        "first": first["text"].strip().rstrip("\t"),
                        "rest": " ".join(s["text"].strip() for s in spans[1:]).strip(),
                        "full": " ".join(s["text"].strip() for s in spans).strip(),
                        "style": (first["font"], round(first["size"])),
                    }
                )
        lines.extend(sorted(page, key=lambda ln: ln["y"]))
    return lines


def is_heading_style(style, body_style):
    """Is this line's typography a heading's, given what this edition's body looks like?

    The weight word differs by era — Times-Bold, TimesNewRomanPS-BoldMT, Lato-Heavy —
    so match any of them, and fall back to a clear size jump above body text.
    """
    font, size = style
    if WEIGHT.search(font):
        return True
    return size >= body_style[1] + 2


def find_headings(lines, body_style, section_re):
    """Lines that open a section: a section number (per `section_re`) set in heading type."""
    marks = []
    for i, line in enumerate(lines):
        if not is_heading_style(line["style"], body_style):
            continue
        if DOT_LEADER.search(line["full"]):
            continue  # contents listing, not a heading
        match = section_re.match(line["first"])
        if match:
            marks.append((i, match.group(1), (match.group(2) or "").strip()))
    return marks


def slice_sections(lines, accepted, division_of):
    """Turn accepted heading marks into sections, taking text up to the next heading."""
    sections = {}
    for n, (i, num, inline_title) in enumerate(accepted):
        if num in sections:  # a number can only open once
            continue

        # Title shares the heading line (2000-2018) or follows on the next (2020-2026).
        title, body_start = inline_title, i + 1
        head_body = ""
        if title:
            # The number and title were in the heading line's first span, so anything else on
            # that physical line (lines[i]["rest"]) is the section's OPENING BODY, not the
            # title — e.g. PennDOT sets "1017.1  DESCRIPTION" in one span and "—This work is…"
            # in the next, on the same line. Without this it is silently dropped (leaving the
            # section empty or starting mid-sentence). WSDOT and the other states put no body
            # in `rest`, so this adds nothing for them.
            head_body = lines[i]["rest"]
        else:
            title = lines[i]["rest"]
            if not title and i + 1 < len(lines):
                title = lines[i + 1]["full"]
                body_start = i + 2

        body_end = accepted[n + 1][0] if n + 1 < len(accepted) else len(lines)
        parts = ([head_body] if head_body else []) + [
            ln["full"] for ln in lines[body_start:body_end]
        ]
        text = "\n".join(parts).strip()

        sections[num] = {
            "num": num,
            "title": title,
            "division": division_of(num),
            "page": lines[i]["page"],
            "vacant": title.strip().lower().strip("()") == "vacant",
            "text": text,
        }
    return sections


def monotonic(marks, order_key):
    """Keep the longest run of headings whose numbers never go backwards.

    Section numbers only ever increase through the body, so anything that breaks the
    order is a cross-reference table cell, not a heading. This is a longest
    non-decreasing subsequence rather than a greedy scan: greedy lets a single
    spurious HIGH number early in the book (a table cell citing 9-35 from inside
    Division 1) reject every legitimate heading after it. The LIS drops the outlier
    instead of the rest of the book.
    """
    if not marks:
        return []

    keys = [order_key(m[1]) for m in marks]
    tails, tail_idx, back = [], [], [-1] * len(marks)

    for i, key in enumerate(keys):
        # rightmost position whose tail is still <= key (non-decreasing allowed)
        lo, hi = 0, len(tails)
        while lo < hi:
            mid = (lo + hi) // 2
            if tails[mid] <= key:
                lo = mid + 1
            else:
                hi = mid
        if lo > 0:
            back[i] = tail_idx[lo - 1]
        if lo == len(tails):
            tails.append(key)
            tail_idx.append(i)
        else:
            tails[lo] = key
            tail_idx[lo] = i

    chain, i = [], tail_idx[-1]
    while i != -1:
        chain.append(marks[i])
        i = back[i]
    return chain[::-1]


def parse(pdf_path, profile):
    """Parse one edition into a list of sections, driven by `profile`'s numbering scheme."""
    doc = fitz.open(pdf_path)
    header_y, footer_y = detect_bands(doc)
    lines = read_lines(doc, header_y, footer_y)
    if not lines:
        raise SystemExit(f"{pdf_path}: no text layer")

    body_style = Counter(ln["style"] for ln in lines).most_common(1)[0][0]
    marks = find_headings(lines, body_style, profile.section_re)
    if not marks:
        raise SystemExit(f"{pdf_path}: no headings found (body style {body_style})")

    # Which occurrence of the first section opens the real body? Two traps: the front-matter
    # contents listing is itself a full section run, and older editions' supplements RESTART
    # numbering partway through. Try every occurrence and score by how many headings actually
    # have prose under them: a contents run scores ~0 (its entries are adjacent); a spurious
    # late start scores low (few headings, each swallowing the rest of the book); the real
    # body scores in the thousands. Rewarding text volume alone would pick the wrong one,
    # since fewer sections means bigger sections.
    prefix = [0]
    for line in lines:
        prefix.append(prefix[-1] + len(line["full"]))

    starts = [n for n, m in enumerate(marks) if m[1] == profile.first_section] or [0]
    best_marks, best_score = None, -1
    for start in starts:
        accepted = monotonic(marks[start:], profile.order_key)
        if len(accepted) < 2:
            continue
        score = sum(
            1
            for j in range(len(accepted) - 1)
            if prefix[accepted[j + 1][0]] - prefix[accepted[j][0] + 1] >= SUBSTANTIVE
        )
        if score > best_score:
            best_marks, best_score = accepted, score

    if not best_marks:
        raise SystemExit(f"{pdf_path}: could not locate the body")

    sections = slice_sections(lines, best_marks, profile.division_of)
    return list(sections.values()), body_style, (header_y, footer_y)
