#!/usr/bin/env python3
"""
Generic manual ingester: a WSDOT manual PDF -> source-tagged retrieval chunks for Ask/Search.

Unlike parse_any_edition.py (which recovers the Standard Specifications' full section tree for
the Browse and 26-year History features), this makes NO assumption about a manual's structure.
WSDOT publishes ~80 manuals with wildly different layouts — chaptered design manuals, procedure
guides, spec supplements — and deeply parsing each is neither tractable nor needed for Ask. What
Ask needs is good retrieval chunks that each know where they came from, so an answer can cite
"Construction Manual (M 41-01), p. 5-3" with a link.

So this extracts text page by page, splits it into retrieval-sized prose chunks, tags each with
the manual's source metadata + page + a best-effort nearest heading, and emits the canonical
chunk shape the Ask corpus uses (see pipeline/manuals.py). Browse and History stay Standard-
Specs-only; this feeds Ask and Search across every text manual.

    uv run --with pymupdf pipeline/ingest_manual.py <code> <out.json>

`code` selects a manual from the registry in pipeline/manuals.py; its PDF is read from
corpus/manuals/<filename> (download it first — see `make manuals`).
"""

import json
import os
import re
import sys

import fitz  # pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manuals import MANUALS_BY_CODE, cite_label  # noqa: E402

CHUNK_MAX = 800  # chars per chunk; matches the Standard Specs ask-corpus for uniform retrieval
MIN_CHUNK = 60  # drop slivers — headers, page numbers, stray fragments
DOT_LEADER_RUN = re.compile(r"(?:\.\s){4,}")  # table-of-contents leader, not prose

# A heading-like line: short, no terminal period, not a bare page number. Best-effort — used
# only to give a citation a human anchor ("5-3.2 Preconstruction Conference") beyond the page.
_HEADING = re.compile(r"^\s*(\d+[-.]\d+[\w.()-]*)?\s*([A-Z][A-Za-z0-9 ,/&'()-]{3,60})\s*$")
_PAGEISH = re.compile(r"^\s*(page\s+)?[\divxlc-]+\s*$", re.I)


def is_prose(text):
    """A retrieval chunk should be readable prose, not a contents-listing or figure caption."""
    if DOT_LEADER_RUN.search(text):
        return False
    letters = sum(c.isalpha() for c in text)
    return len(text) >= MIN_CHUNK and letters >= 0.5 * len(text)


def looks_like_heading(line):
    line = line.strip()
    if not line or len(line) > 70 or _PAGEISH.match(line):
        return False
    if line.endswith((".", ";", ",")):
        return False
    return bool(_HEADING.match(line))


def chunk_lines(lines, limit=CHUNK_MAX):
    """Group consecutive lines into <=limit-char chunks, tracking the nearest heading above."""
    chunks, buf, heading = [], "", ""
    current_heading = ""
    for line in lines:
        if looks_like_heading(line):
            current_heading = line.strip()
        if buf and len(buf) + len(line) + 1 > limit:
            chunks.append((buf.strip(), heading))
            buf, heading = line, current_heading
        else:
            if not buf:
                heading = current_heading
            buf = f"{buf} {line}".strip() if buf else line
    if buf.strip():
        chunks.append((buf.strip(), heading))
    return chunks


def ingest(manual, pdf_path):
    """Yield canonical Ask-corpus chunks for one manual PDF."""
    doc = fitz.open(pdf_path)
    for pno in range(doc.page_count):
        text = doc[pno].get_text()
        lines = [ln for ln in text.split("\n") if ln.strip()]
        for piece, heading in chunk_lines(lines):
            if not is_prose(piece):
                continue
            page = pno + 1
            ref = heading or ""
            yield {
                "text": piece,
                "source": manual.title,
                "sourceId": manual.m_number,
                "cite": cite_label(manual, ref, page),
                "ref": ref,
                "page": page,
                "url": manual.url,
                "inApp": False,  # links to the source PDF, not an in-app section page
            }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: ingest_manual.py <manual-code> <out.json>")
    code, out_path = sys.argv[1], sys.argv[2]
    manual = MANUALS_BY_CODE.get(code)
    if not manual:
        raise SystemExit(f"unknown manual code {code!r}; known: {', '.join(MANUALS_BY_CODE)}")

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pdf_path = os.path.join(root, "corpus", "manuals", manual.filename)
    if not os.path.exists(pdf_path):
        raise SystemExit(f"{code}: PDF not found at {pdf_path} (run `make manuals` to fetch it)")

    chunks = list(ingest(manual, pdf_path))
    with open(out_path, "w") as handle:
        json.dump(chunks, handle, separators=(",", ":"))
    pages = max((c["page"] for c in chunks), default=0)
    print(f"{manual.title} ({manual.m_number}): {len(chunks):,} chunks over {pages} pages -> {out_path}")


if __name__ == "__main__":
    main()
