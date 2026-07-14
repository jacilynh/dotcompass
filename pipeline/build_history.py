#!/usr/bin/env python3
"""
Build the 26-year life story of every section of the WSDOT Standard Specifications.

    uv run --with pymupdf pipeline/build_history.py pipeline/out pipeline/history.json

Reads the per-edition JSON emitted by parse_any_edition.py (e2000.json ... e2026.json)
and produces, for each section number, a timeline of what happened to it and when:

    introduced  first edition the section appears in
    revised     its text changed from the previous edition
    vacated     it was struck — retitled "Vacant", text removed, number retained
    restored    it came back after being vacant
    removed     the number disappeared from the book entirely
    reinstated  the number reappeared after being removed

The point of the tool is that a spec section is not a fact, it is a decision with a
history. "1-09.7 Mobilization was vacated in 2026" is a much more useful thing to be
able to say than "1-09.7 does not exist."

Text is compared on a whitespace-normalized basis, so reflowing across a page break
is not reported as a revision. Revisions also carry a coarse magnitude (the fraction
of words that changed) so the UI can distinguish a typo fix from a rewrite.
"""

import json
import os
import re
import sys
from difflib import SequenceMatcher

DOT_LEADER_TAIL = re.compile(r"[\s.]*(?:\.\s*){3,}$")  # "Definitions and Terms . . . ."


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def clean_title(title):
    return DOT_LEADER_TAIL.sub("", title).strip(" .")


def load_editions(out_dir):
    editions = {}
    for name in sorted(os.listdir(out_dir)):
        match = re.fullmatch(r"e(\d{4})\.json", name)
        if match:
            year = int(match.group(1))
            with open(os.path.join(out_dir, name)) as handle:
                sections = json.load(handle)
            for section in sections:
                section["title"] = clean_title(section["title"])
            editions[year] = {s["num"]: s for s in sections}
    return dict(sorted(editions.items()))


def heal_single_edition_gaps(editions):
    """Treat a one-edition disappearance as a parse miss, not a removal.

    215 of 228 removed->reinstated pairs in the raw parse are gaps of exactly one
    edition, clustered in the editions this parser handles least well (2004 above
    all). WSDOT does not strike a section and reinstate it two years later 215
    times; the parser missed the heading. Carrying the previous edition's text
    across the gap keeps a real "removed" event meaningful instead of drowning it
    in noise, and each healed cell is marked `inferred` so the UI can be honest
    about it. A genuine multi-edition absence is left alone and still reports as
    removed.
    """
    years = list(editions)
    healed = 0
    for i in range(1, len(years) - 1):
        before, gap, after = years[i - 1], years[i], years[i + 1]
        for num, section in editions[before].items():
            if num not in editions[gap] and num in editions[after]:
                editions[gap][num] = dict(section, inferred=True)
                healed += 1
    return healed


def churn(before, after):
    """Fraction of words that changed — lets the UI tell a typo from a rewrite."""
    old, new = normalize(before).split(), normalize(after).split()
    if not old and not new:
        return 0.0
    same = sum(block.size for block in SequenceMatcher(None, old, new).get_matching_blocks())
    return round(1 - (2 * same) / (len(old) + len(new) or 1), 3)


def build(editions):
    years = list(editions)
    every_num = sorted({num for ed in editions.values() for num in ed})

    history = {}
    for num in every_num:
        events, prev = [], None
        for year in years:
            cur = editions[year].get(num)

            if cur and not prev:
                kind = "reinstated" if events else "introduced"
                events.append({"year": year, "event": kind, "title": cur["title"]})
                if cur["vacant"]:
                    events.append({"year": year, "event": "vacated", "title": cur["title"]})

            elif prev and not cur:
                events.append({"year": year, "event": "removed"})

            elif cur and prev:
                if cur["vacant"] and not prev["vacant"]:
                    events.append(
                        {"year": year, "event": "vacated", "was": prev["text"][:400]}
                    )
                elif prev["vacant"] and not cur["vacant"]:
                    events.append({"year": year, "event": "restored", "title": cur["title"]})
                elif normalize(cur["text"]) != normalize(prev["text"]):
                    events.append(
                        {
                            "year": year,
                            "event": "revised",
                            "churn": churn(prev["text"], cur["text"]),
                        }
                    )

            prev = cur

        live = editions[years[-1]].get(num)
        history[num] = {
            "num": num,
            "division": int(num[0]),
            "title": live["title"] if live else _last_title(editions, years, num),
            "current": bool(live) and not live["vacant"],
            "vacant_now": bool(live) and live["vacant"],
            "first_seen": next(e["year"] for e in events),
            "last_seen": max(y for y in years if num in editions[y]),
            "events": events,
        }
    return history


def _last_title(editions, years, num):
    for year in reversed(years):
        if num in editions[year]:
            return editions[year][num]["title"]
    return ""


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_history.py <editions_dir> <out.json>")
    out_dir, out_path = sys.argv[1], sys.argv[2]

    editions = load_editions(out_dir)
    if len(editions) < 2:
        raise SystemExit(f"{out_dir}: need at least two parsed editions")

    healed = heal_single_edition_gaps(editions)
    history = build(editions)
    with open(out_path, "w") as handle:
        json.dump({"editions": list(editions), "sections": history}, handle, indent=1)

    counts = {}
    for record in history.values():
        for event in record["events"]:
            counts[event["event"]] = counts.get(event["event"], 0) + 1

    latest = max(editions)
    live = sum(1 for r in history.values() if r["current"])
    vacant = sum(1 for r in history.values() if r["vacant_now"])

    print(f"editions: {list(editions)}")
    print(f"single-edition gaps healed as parse misses: {healed:,}")
    print(f"sections ever published: {len(history):,}")
    print(f"  live in {latest}:   {live:,}")
    print(f"  vacant in {latest}: {vacant:,}")
    print("events:", {k: counts[k] for k in sorted(counts, key=lambda k: -counts[k])})
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
