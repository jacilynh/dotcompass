#!/usr/bin/env python3
"""
Ingest the WSDOT Standard Plans (M 21-01) as a title-index into the Ask corpus.

    uv run python3 pipeline/ingest_standard_plans.py pipeline/manuals-out/SP.json

The Standard Plans are engineering DRAWINGS, not prose — there is no text to read and answer
from. But each plan has a number (e.g. B-5.20-03) and a title (e.g. "Catch Basin Type 1"),
and WSDOT lists them all in a table on the Standard Plans page with a per-plan PDF link. This
ingests that table: one short, source-tagged corpus entry per plan, so Ask can answer "which
standard plan shows a Type 1 catch basin?" by pointing to the plan number and linking its
drawing — without pretending to read the drawing.

Emits the canonical Ask-corpus chunk shape (see pipeline/manuals.py); the citation links to
the individual plan's PDF.
"""

import html
import json
import re
import sys
import urllib.request

INDEX_URL = "https://wsdot.wa.gov/engineering-standards/all-manuals-and-standards/standard-plans"
PDF_BASE = "https://wsdot.wa.gov"
# The per-plan sheet PDF (english), the link we cite. Distinguishes plan sheets from the
# comment/hydraulics PDFs that also appear in a row.
PLAN_PDF = re.compile(r'href="(/publications/fulltext/Standards/english/PDF/[a-z0-9.\-]+_e\.pdf)"')
# A plan number like "A-10.10-00", "B-5.20-03", "F-10.12-04".
PLAN_NUM = re.compile(r"^([A-M]-?\d[\w.\-]*)")


def strip_tags(cell):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cell))).strip()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_plans(page):
    plans = []
    for row in re.findall(r"<tr[^>]*>.*?</tr>", page, re.S):
        pdf = PLAN_PDF.search(row)
        if not pdf:
            continue
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 2:
            continue
        num_match = PLAN_NUM.match(cells[0])
        title = cells[1].strip()
        if not num_match or not title:
            continue
        plans.append((num_match.group(1), title, PDF_BASE + pdf.group(1)))
    return plans


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: ingest_standard_plans.py <out.json>")
    out_path = sys.argv[1]

    plans = parse_plans(fetch(INDEX_URL))
    if len(plans) < 100:
        raise SystemExit(f"only parsed {len(plans)} plans — the page layout may have changed")

    chunks = [
        {
            "text": f"WSDOT Standard Plan {num}: {title}",
            "source": "Standard Plans",
            "sourceId": "M 21-01",
            "cite": num,  # the plan number, e.g. "B-5.20-03"
            "ref": title,
            "page": 1,
            "url": url,  # the individual plan-sheet PDF
            "inApp": False,
        }
        for num, title, url in plans
    ]
    with open(out_path, "w") as handle:
        json.dump(chunks, handle, separators=(",", ":"))
    print(f"Standard Plans (M 21-01): {len(chunks)} plans indexed -> {out_path}")


if __name__ == "__main__":
    main()
