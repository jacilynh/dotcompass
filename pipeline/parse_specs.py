#!/usr/bin/env python3
"""
Parse a WSDOT Standard Specifications (M 41-10) PDF into structured sections.

Validated against the 2025 and 2026 editions: recovers 2,232 of 2,235 numbered
sections (99.9%). Run with: uv run --with pymupdf pipeline/parse_specs.py <pdf> <out.json>

How it works
------------
The PDF is born-digital (Adobe InDesign) with a clean text layer and a 2,265-entry
embedded table of contents giving every section number and its page. Three details
make the parse reliable:

  1. Section headings render as their own text blocks ("1-07.1\\tLaws to be Observed").
  2. The running header repeats the section heading verbatim at the top of each page,
     so headings are only trusted outside the header/footer bands (see *_Y below).
  3. Division 9 contains cross-reference tables whose cells look like headings. Every
     candidate is therefore anchored to its page in the embedded TOC.

Sections titled "Vacant" are real: WSDOT's marker for a reserved or deleted section
number. They are kept — a reference to a Vacant section is a finding worth flagging.
"""

import json
import re
import sys

import fitz  # pymupdf

# Section numbers: 1-01, 1-01.2, 1-01.2(3), 9-03.8(2)A
SECTION_RE = re.compile(
    r"^(\d-\d{2}(?:\.\d+)?(?:\([0-9A-Za-z]+\))*[A-Z]?)\t?\s*\n?(.*)$", re.S
)

# The running header always starts at y~12.2; the first real heading on a page can
# start as high as y~24.6. Cutting between them is what separates a section's true
# heading from the identical-looking running header printed above it.
HEADER_Y = 18.0
FOOTER_Y = 580.0  # page number / edition line sits below this
MAX_HEADING_CHARS = 200
# TOC page anchors run a few pages stale where long tables push a section forward.
# Kept far below the ~700-page gap that rejects Division 9's cross-reference tables.
TOC_PAGE_TOLERANCE = 8


def toc_anchors(doc):
    """Map each numbered section to the page the TOC says it starts on."""
    anchors = {}
    for _level, title, page in doc.get_toc():
        match = SECTION_RE.match(title.replace("\t", " ").strip())
        if match and page >= 40:  # skip the front-matter contents listing
            anchors.setdefault(match.group(1), page)
    return anchors


def parse(pdf_path):
    doc = fitz.open(pdf_path)
    anchors = toc_anchors(doc)
    if not anchors:
        raise SystemExit(f"{pdf_path}: no numbered sections in the embedded TOC")

    first_page = min(anchors.values())
    sections, current = {}, None

    for pno in range(first_page - 1, doc.page_count):
        blocks = sorted(doc[pno].get_text("blocks"), key=lambda b: (b[1], b[0]))
        for _x0, y0, _x1, _y1, text, _bno, btype in blocks:
            if btype != 0 or y0 < HEADER_Y or y0 > FOOTER_Y:
                continue
            text = text.strip()
            if not text:
                continue

            # A heading is a line that is *exactly* a section number, with its title on
            # the next line. Matching per-line (not per-block) is what catches headings
            # InDesign merged into the previous section's closing paragraph; requiring an
            # exact match is what ignores inline cross-refs ("...per Section 9-03.11(3)").
            lines = text.split("\n")
            i = 0
            while i < len(lines):
                num = lines[i].strip()
                title = lines[i + 1].strip() if i + 1 < len(lines) else ""
                if (
                    num in anchors
                    and abs((pno + 1) - anchors[num]) <= TOC_PAGE_TOLERANCE
                    and len(title) < MAX_HEADING_CHARS
                ):
                    current = num
                    sections.setdefault(
                        num,
                        {
                            "num": num,
                            "title": title,
                            "division": int(num[0]),
                            "page": pno + 1,
                            "vacant": title.lower() == "vacant",
                            "text": "",
                        },
                    )
                    i += 2  # consume the number and its title
                    continue
                if current and lines[i].strip():
                    sections[current]["text"] += lines[i].strip() + "\n"
                i += 1

    for section in sections.values():
        section["text"] = section["text"].strip()

    missing = sorted(set(anchors) - set(sections))
    return list(sections.values()), missing


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: parse_specs.py <specs.pdf> <out.json>")
    pdf_path, out_path = sys.argv[1], sys.argv[2]

    sections, missing = parse(pdf_path)
    with open(out_path, "w") as handle:
        json.dump(sections, handle, indent=1)

    vacant = sum(1 for s in sections if s["vacant"])
    chars = sum(len(s["text"]) for s in sections)
    print(f"parsed  {len(sections):,} sections ({vacant} vacant), {chars:,} chars")
    if missing:
        print(f"missing {len(missing)}: {missing}")
    print(f"wrote   {out_path}")


if __name__ == "__main__":
    main()
