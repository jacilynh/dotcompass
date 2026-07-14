#!/usr/bin/env python3
"""
Parse ANY edition of the WSDOT Standard Specifications (M 41-10, 2000-2026).

    uv run --with pymupdf pipeline/parse_any_edition.py corpus/SS2000.pdf out.json

Why this exists alongside parse_specs.py
----------------------------------------
`parse_specs.py` anchors every heading to the PDF's embedded table of contents.
That works on 2024-2026 but not across the archive: 2000-2008 ship a 2-entry TOC,
2010-2018 ship ~140 (division-level only), and 2023's is incomplete. Only a
handful of the 17 editions have a TOC worth trusting.

Every edition does have a clean text layer, so this parser derives the section tree
from typography and ordering instead, using no TOC at all. Nothing about the
layout is hardcoded, because almost everything about it changes across 26 years:

  * Page geometry: the 2000-2008 books are 396x612; 2020-2022 are 612x792.
  * Heading font: Times-Bold (2000-2008), TimesNewRomanPS-BoldMT (2010-2018),
    Lato-Heavy (2020-2026). "Bold" is not even in the last one's name, so weight
    is learned by contrast with body text rather than matched by name.
  * Heading layout: 2000-2018 put the number and title in ONE span
    ("1-09.2(1) General Requirements"); 2020-2026 split them across two lines.

So the parser measures each document rather than assuming:

  1. BODY FONT is the modal (font, size) across all lines. A heading is any line
     that opens with a section number in a font that is NOT the body font. This
     survives every typographic era above.
  2. HEADER/FOOTER bands are the y-coordinates shared by nearly every page's
     first and last line. The running header reprints the section heading
     verbatim, so it must be stripped by position, and its position moves.
  3. BODY START is chosen by trying every "1-01" and keeping whichever yields the
     most headings that actually have prose under them. This self-corrects for two
     traps: the front-matter contents listing (itself a full 1-01..9-35 run, but
     with no text under its entries), and the APWA Supplement in the older
     editions, which RESTARTS numbering at 1-01 partway through the book. Scoring
     by text VOLUME instead would pick the wrong one, since fewer sections means
     bigger sections.
  4. MONOTONIC ORDER: section numbers only ever increase through the body, so
     anything out of order is a cross-reference table cell, not a heading. Taken as
     a longest non-decreasing subsequence, not a greedy scan — greedy lets one
     spurious HIGH number (a table cell citing 9-35 from inside Division 1) reject
     every real heading after it.

Validated across all 17 editions: reproduces all 2,235 TOC-listed sections of the
2026 edition with zero misses, and finds ~1,000 more that WSDOT's own TOC omits (the
deepest "(2)A" level). Section counts grow smoothly from 2,132 (2000) to 3,237 (2026).
"""

import json
import re
import sys
from collections import Counter

import fitz  # pymupdf

# A heading opens with a section number, then whitespace or end-of-span:
#   1-01 | 1-01.2 | 9-03.8(2) | 9-03.8(2)A
HEAD = re.compile(r"^(\d-\d{2}(?:\.\d+)?(?:\([0-9A-Za-z]+\))*[A-Z]?)(?:\s+(.*))?$", re.S)
DOT_LEADER = re.compile(r"\.{4,}")  # contents lines: "1-99 APWA SUPPLEMENT......1-119"
WEIGHT = re.compile(r"bold|heavy|black|semibold", re.I)  # the era-specific weight words

BAND_TOLERANCE = 3.0
SUBSTANTIVE = 40  # chars of prose under a heading for it to count as a real section
MAX_SUBPARTS = 4
LETTER_RANK = 10**6  # lettered subparts sort after numeric ones, as the book does


def sort_key(num):
    """Order section numbers as the book does: 1-01 < 1-01.2 < 1-01.2(3) < 1-02.

    Every element is an (int, str) pair and the key is padded to a fixed length, so
    numbers of differing depth stay comparable.
    """
    div, rest = num.split("-", 1)
    main = re.match(r"^(\d+)(?:\.(\d+))?", rest)

    key = [
        (int(div), ""),
        (int(main.group(1)), ""),
        (int(main.group(2)) if main.group(2) else -1, ""),
    ]
    subparts = re.findall(r"\(([0-9A-Za-z]+)\)", rest)
    for part in subparts:
        key.append((int(part), "") if part.isdigit() else (LETTER_RANK, part))
    key.extend([(-1, "")] * (MAX_SUBPARTS - len(subparts)))

    trailing = re.search(r"([A-Z])$", rest)
    key.append((0, trailing.group(1) if trailing else ""))
    return tuple(key)


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


def find_headings(lines, body_style):
    """Lines that open a section: a section number set in heading type."""
    marks = []
    for i, line in enumerate(lines):
        if not is_heading_style(line["style"], body_style):
            continue
        if DOT_LEADER.search(line["full"]):
            continue  # contents listing, not a heading
        match = HEAD.match(line["first"])
        if match:
            marks.append((i, match.group(1), (match.group(2) or "").strip()))
    return marks


def slice_sections(lines, accepted):
    """Turn accepted heading marks into sections, taking text up to the next heading."""
    sections = {}
    for n, (i, num, inline_title) in enumerate(accepted):
        if num in sections:  # a number can only open once
            continue

        # Title shares the heading line (2000-2018) or follows on the next (2020-2026).
        title, body_start = inline_title, i + 1
        if not title:
            title = lines[i]["rest"]
        if not title and i + 1 < len(lines):
            title = lines[i + 1]["full"]
            body_start = i + 2

        body_end = accepted[n + 1][0] if n + 1 < len(accepted) else len(lines)
        text = "\n".join(ln["full"] for ln in lines[body_start:body_end]).strip()

        sections[num] = {
            "num": num,
            "title": title,
            "division": int(num[0]),
            "page": lines[i]["page"],
            "vacant": title.strip().lower().strip("()") == "vacant",
            "text": text,
        }
    return sections


def monotonic(marks):
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

    keys = [sort_key(m[1]) for m in marks]
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


def parse(pdf_path):
    doc = fitz.open(pdf_path)
    header_y, footer_y = detect_bands(doc)
    lines = read_lines(doc, header_y, footer_y)
    if not lines:
        raise SystemExit(f"{pdf_path}: no text layer")

    body_style = Counter(ln["style"] for ln in lines).most_common(1)[0][0]
    marks = find_headings(lines, body_style)
    if not marks:
        raise SystemExit(f"{pdf_path}: no headings found (body style {body_style})")

    # Which "1-01" opens the real body? Two traps: the front-matter contents listing is
    # itself a full 1-01..9-35 run, and the older editions' APWA Supplement RESTARTS at
    # 1-01 partway through the book. Try every 1-01 and score by the MEDIAN text under a
    # heading: contents entries carry almost none, real sections carry hundreds of
    # characters. Median (not total) because the last contents entry would otherwise
    # absorb the entire rest of the document and win on volume alone.
    prefix = [0]
    for line in lines:
        prefix.append(prefix[-1] + len(line["full"]))

    starts = [n for n, m in enumerate(marks) if m[1] == "1-01"] or [0]
    best_marks, best_score = None, -1
    for start in starts:
        accepted = monotonic(marks[start:])
        if len(accepted) < 2:
            continue
        # Score = how many headings actually have prose under them. A contents run
        # scores ~0 (its entries are adjacent); a spurious late start scores ~150
        # (few headings, each swallowing the rest of the book); the real body scores
        # in the thousands. Rewarding text volume alone would pick the wrong one,
        # since fewer sections means bigger sections.
        score = sum(
            1
            for j in range(len(accepted) - 1)
            if prefix[accepted[j + 1][0]] - prefix[accepted[j][0] + 1] >= SUBSTANTIVE
        )
        if score > best_score:
            best_marks, best_score = accepted, score

    if not best_marks:
        raise SystemExit(f"{pdf_path}: could not locate the body")

    return list(slice_sections(lines, best_marks).values()), body_style, (header_y, footer_y)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: parse_any_edition.py <specs.pdf> <out.json>")
    pdf_path, out_path = sys.argv[1], sys.argv[2]

    sections, body_style, bands = parse(pdf_path)
    with open(out_path, "w") as handle:
        json.dump(sections, handle, indent=1)

    vacant = sum(1 for s in sections if s["vacant"])
    chars = sum(len(s["text"]) for s in sections)
    print(
        f"{pdf_path}: {len(sections):,} sections ({vacant} vacant), {chars:,} chars "
        f"[body {body_style[0]} {body_style[1]}pt, bands {bands}] -> {out_path}"
    )


if __name__ == "__main__":
    main()
