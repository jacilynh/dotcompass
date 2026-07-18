#!/usr/bin/env python3
"""
Download and ingest the registry's manuals into pipeline/manuals-out/ for the Ask corpus.

    uv run --with pymupdf python3 pipeline/build_manuals.py

Downloads each manual's PDF (skipping ones already present in corpus/manuals/, which is
git-ignored — these are WSDOT's to publish, not ours to vendor), then runs the generic
ingester on it. Set the MANUALS env var to a space/comma-separated list of codes to ingest a
subset, e.g. `MANUALS="CM TM HM" make manuals` — useful because a few manuals (Geotechnical,
Highway Runoff) are enormous downloads.

After this, run build_ask_corpus.py to merge the results into ask-corpus.json.
"""

import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_manual import ingest  # noqa: E402
from manuals import MANUALS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS_DIR = os.path.join(ROOT, "corpus", "manuals")
OUT_DIR = os.path.join(ROOT, "pipeline", "manuals-out")


def selected():
    raw = os.environ.get("MANUALS", "").replace(",", " ").split()
    codes = set(raw)
    manuals = [m for m in MANUALS if m.url]
    return [m for m in manuals if not codes or m.code in codes]


def download(manual, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    print(f"  fetching {manual.m_number} {os.path.basename(dest)} ...", flush=True)
    subprocess.run(
        ["curl", "-sSfL", "-A", "Mozilla/5.0", "-o", dest, manual.url],
        check=True,
    )


def main():
    os.makedirs(CORPUS_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    import fitz  # imported here so `--with pymupdf` is only needed when actually ingesting
    import json

    for manual in selected():
        pdf = os.path.join(CORPUS_DIR, manual.filename)
        try:
            download(manual, pdf)
        except subprocess.CalledProcessError as err:
            print(f"  SKIP {manual.code} — download failed: {err}")
            continue
        chunks = list(ingest(manual, pdf))
        out = os.path.join(OUT_DIR, f"{manual.code}.json")
        with open(out, "w") as handle:
            json.dump(chunks, handle, separators=(",", ":"))
        pages = fitz.open(pdf).page_count
        print(f"  {manual.code:4} {manual.title} ({manual.m_number}): {len(chunks):,} chunks / {pages} pages")


if __name__ == "__main__":
    main()
