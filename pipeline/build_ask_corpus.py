#!/usr/bin/env python3
"""
Merge the Standard Specifications Ask corpus with the ingested manuals into one corpus.

    uv run python3 pipeline/build_ask_corpus.py <app/public/data> <pipeline/manuals-out>

build_app_data.py writes app/public/data/ask-corpus.json with the Standard Specifications'
source-tagged chunks (the base). ingest_manual.py writes one <code>.json of source-tagged
chunks per other manual into the manuals-out directory. This combines them into the single
ask-corpus.json the Worker retrieves over, so Ask answers can span every ingested manual and
cite the one each fact came from.

Idempotent: it rebuilds from the Standard Specifications base (chunks whose sourceId is the
Standard Specs, M 41-10, with inApp=True) plus the manual files, so re-running never
duplicates — you can add a manual and re-run without first rebuilding the base.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manuals import STANDARD_SPECS


def load(path):
    with open(path) as handle:
        return json.load(handle)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_ask_corpus.py <data_dir> <manuals_out_dir>")
    data_dir, manuals_dir = sys.argv[1], sys.argv[2]
    corpus_path = os.path.join(data_dir, "ask-corpus.json")

    existing = load(corpus_path)
    # The Standard Specs base: keep only its chunks, so a previous merge's manual chunks are
    # dropped before we re-add them (idempotency).
    base = [
        c
        for c in existing
        if c.get("sourceId") == STANDARD_SPECS.m_number and c.get("inApp") is True
    ]

    corpus = list(base)
    per_source = {STANDARD_SPECS.title: len(base)}
    if os.path.isdir(manuals_dir):
        for name in sorted(os.listdir(manuals_dir)):
            if not name.endswith(".json"):
                continue
            chunks = load(os.path.join(manuals_dir, name))
            corpus.extend(chunks)
            for c in chunks:
                per_source[c["source"]] = per_source.get(c["source"], 0) + 1

    with open(corpus_path, "w") as handle:
        json.dump(corpus, handle, separators=(",", ":"))

    size_mb = os.path.getsize(corpus_path) / 1e6
    print(f"ask-corpus.json: {len(corpus):,} chunks from {len(per_source)} sources ({size_mb:.1f} MB)")
    for source, n in sorted(per_source.items(), key=lambda kv: -kv[1]):
        print(f"  {n:>7,}  {source}")


if __name__ == "__main__":
    main()
