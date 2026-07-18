#!/usr/bin/env python3
"""
Emit the JSON the web app consumes, from the parsed editions and the history file.

    uv run --with pymupdf pipeline/build_app_data.py \\
        pipeline/out pipeline/history.json app/public/data

The app is a static site, so all of its data is baked here at build time. The shapes
are chosen so the browser fetches little and lazily:

    index.json            headline stats, division names, and a lightweight list of
                          every current section (num + title + flags) — enough to draw
                          the whole navigation tree and run keyword search, ~250 KB.

    sections/<d>.json     the current (latest-edition) full text of every section in
                          division <d>. Fetched only when that division is opened.

    history/<d>.json      each section's timeline for division <d>: introduced /
                          revised / vacated / removed, and for every revision a
                          precomputed word-level diff against the prior edition, so
                          "what changed in 2008" is a lookup rather than a client-side
                          re-diff of two full texts.

Splitting sections and history by division (9 files each) keeps any single fetch small
and lets the reader page through the book without ever loading all of it.
"""

import json
import os
import re
import sys
from collections import Counter
from difflib import SequenceMatcher

# build_history is a sibling script, not an installed module, so its directory is put
# on the path before importing the one helper shared between the two build steps.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_history import clean_title
from manuals import STANDARD_SPECS

# The nine divisions are part of the spec's structure, not something to infer.
DIVISION_TITLES = {
    1: "General Requirements",
    2: "Temporary Features",
    3: "Earthwork",
    4: "Aggregates and Bases",
    5: "Surface Treatments and Pavements",
    6: "Structures",
    7: "Drainage Structures, Storm Sewers, Sanitary Sewers, Water Mains, and Conduits",
    8: "Miscellaneous Construction",
    9: "Materials",
}

MAX_DIFF_SPAN = 600  # cap each side of a stored diff op; full text lives in sections/


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def word_diff(before, after):
    """Word-level changes between two edition texts, compact enough to ship per event."""
    old, new = normalize(before).split(), normalize(after).split()
    ops = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, old, new).get_opcodes():
        if tag == "equal":
            continue
        ops.append(
            {
                "op": tag,
                "old": " ".join(old[i1:i2])[:MAX_DIFF_SPAN],
                "new": " ".join(new[j1:j2])[:MAX_DIFF_SPAN],
            }
        )
    return ops


def load_editions(out_dir):
    editions = {}
    for name in sorted(os.listdir(out_dir)):
        match = re.fullmatch(r"e(\d{4})\.json", name)
        if match:
            with open(os.path.join(out_dir, name)) as handle:
                editions[int(match.group(1))] = {s["num"]: s for s in json.load(handle)}
    return dict(sorted(editions.items()))


def timeline_with_diffs(num, record, editions, years):
    """The section's events, with a word-level diff attached to each revision."""
    out = []
    for event in record["events"]:
        entry = {"year": event["year"], "event": event["event"]}
        if event["event"] == "revised":
            entry["churn"] = event["churn"]
            # Diff against the most recent earlier edition that carried this section.
            prior = max(
                (y for y in years if y < event["year"] and num in editions[y]), default=None
            )
            if prior is not None and num in editions[event["year"]]:
                entry["diff"] = word_diff(
                    editions[prior][num]["text"], editions[event["year"]][num]["text"]
                )
        elif event["event"] == "vacated" and event.get("was"):
            entry["was"] = event["was"]
        out.append(entry)
    return out


CHUNK_MAX = 800  # chars; keeps retrieval granular and the model's context bounded
DOT_LEADER_RUN = re.compile(r"(?:\.\s){4,}")  # contents-listing artifact, not prose


def is_prose(text):
    """A retrieval chunk should be readable prose, not a contents-listing fragment."""
    if DOT_LEADER_RUN.search(text):
        return False
    letters = sum(c.isalpha() for c in text)
    return letters >= 0.5 * len(text)


def chunk_text(text, limit=CHUNK_MAX):
    """Split section text into retrieval-sized pieces, breaking on line boundaries.

    Section-level chunks would be too coarse for long structural sections and would send
    the model more context than it needs; splitting on the parser's line breaks keeps each
    piece focused without cutting mid-line.
    """
    chunks, buf = [], ""
    for line in text.split("\n"):
        if buf and len(buf) + len(line) + 1 > limit:
            chunks.append(buf.strip())
            buf = line
        else:
            buf = f"{buf} {line}".strip() if buf else line
    if buf.strip():
        chunks.append(buf.strip())
    return chunks


def emit_ask_corpus(current, out_dir):
    """The Standard Specifications' contribution to the Ask retrieval corpus.

    Emits source-tagged chunks (see pipeline/manuals.py for the shape) for every non-vacant
    current-edition section, so an Ask answer can cite "Standard Specifications 1-09.7" and
    link straight to that section in the app. This is the base corpus; build_ask_corpus.py
    merges in the other manuals' chunks. The Worker fetches the corpus once and never sees
    anything but public specification text.
    """
    ss = STANDARD_SPECS
    corpus = []
    for num, section in current.items():
        if section.get("vacant") or len(section["text"]) < 40:
            continue
        for piece in chunk_text(section["text"]):
            if len(piece) >= 40 and is_prose(piece):
                corpus.append(
                    {
                        "text": piece,
                        "source": ss.title,
                        "sourceId": ss.m_number,
                        "cite": num,  # the section number; the model cites it, the UI links it
                        "ref": num,
                        "page": section["page"],
                        "url": ss.url,
                        "inApp": True,  # links to /section/<num> in the app, not an external PDF
                    }
                )
    _write(os.path.join(out_dir, "ask-corpus.json"), corpus)
    return len(corpus)


def emit_requirements(requirements_path, out_dir, index):
    """Split the extracted requirements by division and record filter metadata.

    Each requirement carries its section, so a per-division split lets the app load only
    the divisions in view. The index gains the party/topic vocabularies and totals so the
    filter UI and the headline counts need no extra fetch.
    """
    with open(requirements_path) as handle:
        requirements = json.load(handle)

    os.makedirs(os.path.join(out_dir, "requirements"), exist_ok=True)
    by_division = {}
    for req in requirements:
        by_division.setdefault(req["division"], []).append(req)
    for division, reqs in by_division.items():
        _write(os.path.join(out_dir, "requirements", f"{division}.json"), reqs)

    parties = Counter(r["party"] for r in requirements)
    topics = Counter(t for r in requirements for t in r["topics"])
    per_division = Counter(r["division"] for r in requirements)
    index["requirements"] = {
        "total": len(requirements),
        # Ordered so named parties lead and Work/Material (the passive majority) trails.
        "parties": [p for p, _ in parties.most_common() if p != "Work/Material"]
        + (["Work/Material"] if "Work/Material" in parties else []),
        "partyCounts": dict(parties),
        "topics": [t for t, _ in topics.most_common()],
        "topicCounts": dict(topics),
        "perDivision": {str(d): per_division.get(d, 0) for d in DIVISION_TITLES},
    }
    return len(requirements)


def main():
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: build_app_data.py <editions_dir> <history> <requirements> <out_dir>"
        )
    editions_dir, history_path, requirements_path, out_dir = sys.argv[1:5]

    editions = load_editions(editions_dir)
    with open(history_path) as handle:
        history = json.load(handle)
    years = history["editions"]
    latest = max(years)
    sections = history["sections"]

    os.makedirs(os.path.join(out_dir, "sections"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "history"), exist_ok=True)

    # index.json — everything needed to draw the tree and search titles.
    current = editions[latest]
    live = sum(1 for r in sections.values() if r["current"])
    vacant = sum(1 for r in sections.values() if r["vacant_now"])
    since_start = sum(
        1 for r in sections.values() if r["current"] and r["first_seen"] == min(years)
    )
    new_latest = sum(1 for r in sections.values() if r["first_seen"] == latest)
    revisions = sum(
        1 for r in sections.values() for e in r["events"] if e["event"] == "revised"
    )

    index = {
        "stats": {
            "everPublished": len(sections),
            "live": live,
            "vacant": vacant,
            "sinceStart": since_start,
            "newInLatest": new_latest,
            "revisions": revisions,
            "editions": years,
            "latest": latest,
            "earliest": min(years),
        },
        "divisions": [{"n": n, "title": t} for n, t in DIVISION_TITLES.items()],
        # Only sections that appear in the latest edition — the current book, in order.
        "sections": _index_sections(current),
        # Numbers that once existed but are gone from the latest edition, mapped to the
        # last year they appeared. This lets the document scanner distinguish a genuinely
        # removed section (a stale citation worth flagging) from a number that never
        # existed (a typo) — instantly, with no extra fetch. Small: a few hundred entries.
        "removed": {
            num: r["last_seen"]
            for num, r in sections.items()
            if not r["current"] and not r["vacant_now"]
        },
    }
    # Requirements augment the index in place (filter vocabularies + totals), so this
    # runs before index.json is written.
    requirement_count = emit_requirements(requirements_path, out_dir, index)
    corpus_count = emit_ask_corpus(current, out_dir)
    _write(os.path.join(out_dir, "index.json"), index)

    # Per-division current text and per-division history with diffs.
    for d in DIVISION_TITLES:
        div_sections = {
            num: {
                "title": clean_title(s["title"]),
                "text": s["text"],
                "vacant": s["vacant"],
                "page": s["page"],
            }
            for num, s in current.items()
            if s["division"] == d
        }
        _write(os.path.join(out_dir, "sections", f"{d}.json"), div_sections)

        div_history = {
            num: {
                "title": r["title"],
                "firstSeen": r["first_seen"],
                "lastSeen": r["last_seen"],
                "current": r["current"],
                "vacantNow": r["vacant_now"],
                "timeline": timeline_with_diffs(num, r, editions, years),
            }
            for num, r in sections.items()
            if r["division"] == d
        }
        _write(os.path.join(out_dir, "history", f"{d}.json"), div_history)

    total = sum(
        os.path.getsize(os.path.join(root, f))
        for root, _, files in os.walk(out_dir)
        for f in files
    )
    print(f"wrote {out_dir} ({total / 1e6:.1f} MB)")
    print(
        f"  {len(index['sections']):,} current sections; {revisions:,} revisions diffed; "
        f"{requirement_count:,} requirements; {corpus_count:,} retrieval chunks"
    )


def _index_sections(current):
    """Current sections in book order, lightweight (titles cleaned of contents leaders)."""
    return [
        {
            "num": num,
            "division": s["division"],
            "title": clean_title(s["title"]),
            "vacant": s["vacant"],
        }
        for num, s in sorted(current.items(), key=lambda kv: _num_key(kv[0]))
    ]


def _num_key(num):
    """Sort key for display — numeric where possible so 1-2 precedes 1-10."""
    div, rest = num.split("-", 1)
    parts = [int(div)]
    for token in re.findall(r"\d+|[A-Za-z]+", rest):
        parts.append((0, int(token)) if token.isdigit() else (1, token))
    return (parts[0], tuple(str(p) for p in parts[1:]))


def _write(path, obj):
    with open(path, "w") as handle:
        json.dump(obj, handle, separators=(",", ":"))


if __name__ == "__main__":
    main()
