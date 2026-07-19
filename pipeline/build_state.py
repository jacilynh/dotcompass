#!/usr/bin/env python3
"""
Build one state's web-app data from its descriptor — the general, multi-state path.

    uv run --with pymupdf pipeline/build_state.py <slug> <out_root> [--allow-uncleared]

Where build_app_data.py is the WSDOT-specific builder (nine fixed divisions, 26 years of
history, requirements), this is the general orchestrator the architecture calls for: given
a StateDescriptor, parse its edition with that state's SpecProfile and emit the app JSON
under <out_root>/<slug>/. For a single-edition state with the history feature off, it emits
the browse + keyword-search foundation:

    <slug>/index.json          headline stats, division list, and every current section
                               (num + title + flags) in book order — the whole tree.
    <slug>/sections/<d>.json   full text of the sections in division <d>, fetched lazily.

History, requirements, and the retrieval corpus are omitted here; they attach in later
phases (multi-edition history needs the cross-edition alignment layer, which is not built
yet). This keeps the pilot honest about what a single onboarded edition can support.

The reuse gate
--------------
Full specification text is emitted only for a state whose reuse terms are cleared
(descriptor.reuse == "public"). For any other state the build REFUSES unless
--allow-uncleared is passed, which is for LOCAL development only and must never be set in a
publishing build. Together with corpus/ being git-ignored, this makes it impossible to ship
an uncleared state's text by accident.
"""

import argparse
import importlib
import json
import os
import re
import sys

# The pipeline scripts are executable tools, not an installed package, so put this
# directory on the path before importing sibling modules and the parsers/states packages.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parsers.engine import parse as parse_pdf

# The descriptor for each onboarded state, "module:NAME".
STATES = {
    "wa": "states.washington:WASHINGTON",
    "nd": "states.north_dakota:NORTH_DAKOTA",
    "de": "states.delaware:DELAWARE",
    "id": "states.idaho:IDAHO",
    "mo": "states.missouri:MISSOURI",
    "pa": "states.pennsylvania:PENNSYLVANIA",
    "co": "states.colorado:COLORADO",
    "tn": "states.tennessee:TENNESSEE",
    "va": "states.virginia:VIRGINIA",
    "fl": "states.florida:FLORIDA",
    "me": "states.maine:MAINE",
}

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DOT_LEADER_RUN = re.compile(r"\s*(?:\.\s*){3,}.*$")  # "General ....... 1-119" contents leader


def clean_title(title):
    """Drop a trailing dot-leader run, matching build_history so titles read the same."""
    return _DOT_LEADER_RUN.sub("", title).strip()


def load_descriptor(slug):
    if slug not in STATES:
        raise SystemExit(f"unknown state {slug!r}; known: {', '.join(sorted(STATES))}")
    module_name, attr = STATES[slug].split(":")
    return getattr(importlib.import_module(module_name), attr)


def build(slug, out_root, allow_uncleared):
    descriptor = load_descriptor(slug)

    # The reuse gate: refuse to emit an uncleared state's text unless explicitly overridden
    # for local development. A publishing build never passes --allow-uncleared.
    if not descriptor.may_publish_text and not allow_uncleared:
        raise SystemExit(
            f"{slug}: reuse={descriptor.reuse!r} is not cleared for redistribution — refusing "
            f"to emit text. Pass --allow-uncleared for LOCAL development only; never in a "
            f"publishing build. Clear the state's reuse terms to publish."
        )

    profile = descriptor.spec_profile
    year, filename = max(descriptor.editions)
    pdf_path = os.path.join(_ROOT, "corpus", slug, filename)
    if not os.path.exists(pdf_path):
        raise SystemExit(
            f"{slug}: source not found at {pdf_path} (fetch it into corpus/{slug}/)"
        )

    sections, _, _ = parse_pdf(pdf_path, profile)
    sections.sort(key=lambda section: profile.order_key(section["num"]))

    out_dir = os.path.join(out_root, slug)
    os.makedirs(os.path.join(out_dir, "sections"), exist_ok=True)

    live = len(sections)
    vacant = sum(1 for section in sections if section["vacant"])
    index = {
        # Everything the app needs to brand the site and gate features per state.
        "meta": {
            "slug": descriptor.slug,
            "state": descriptor.state,
            "dot": descriptor.dot,
            "historyEnabled": descriptor.history,
            "reuse": descriptor.reuse,
            "uncleared": not descriptor.may_publish_text,
            "sourceUrl": descriptor.source_url,
            "sourceNote": descriptor.source_note,
        },
        # Single-edition stats: no revisions, everything is current and new-to-this-edition.
        "stats": {
            "everPublished": live,
            "live": live,
            "vacant": vacant,
            "sinceStart": live,
            "newInLatest": 0,
            "revisions": 0,
            "editions": [year],
            "latest": year,
            "earliest": year,
        },
        "divisions": [{"n": d.id, "title": d.title} for d in descriptor.divisions],
        # Already in book order (sorted above), so the app preserves array order.
        "sections": [
            {
                "num": s["num"],
                "division": s["division"],
                "title": clean_title(s["title"]),
                "vacant": s["vacant"],
            }
            for s in sections
        ],
        # No processed archive yet, so nothing is known-removed.
        "removed": {},
    }
    _write(os.path.join(out_dir, "index.json"), index)

    by_division = {}
    for s in sections:
        by_division.setdefault(s["division"], {})[s["num"]] = {
            "title": clean_title(s["title"]),
            "text": s["text"],
            "vacant": s["vacant"],
            "page": s["page"],
        }
    for division, div_sections in by_division.items():
        _write(os.path.join(out_dir, "sections", f"{division}.json"), div_sections)

    total = sum(
        os.path.getsize(os.path.join(root, f))
        for root, _, files in os.walk(out_dir)
        for f in files
    )
    gate = " [UNCLEARED — local only]" if not descriptor.may_publish_text else ""
    print(
        f"wrote {out_dir} ({total / 1e6:.1f} MB){gate}\n"
        f"  {descriptor.state} {year}: {live:,} sections ({vacant} vacant) across "
        f"{len(by_division)} divisions; history={descriptor.history}"
    )


def _write(path, obj):
    with open(path, "w") as handle:
        json.dump(obj, handle, separators=(",", ":"))


def main():
    parser = argparse.ArgumentParser(description="Build one state's web-app data.")
    parser.add_argument("slug", help="state slug, e.g. wa or nd")
    parser.add_argument("out_root", help="output root; data goes to <out_root>/<slug>/")
    parser.add_argument(
        "--allow-uncleared",
        action="store_true",
        help="LOCAL DEV ONLY: emit text for a state whose reuse terms are not cleared",
    )
    args = parser.parse_args()
    build(args.slug, args.out_root, args.allow_uncleared)


if __name__ == "__main__":
    main()
