#!/usr/bin/env python3
"""
Diff two parsed editions of the Standard Specifications, section by section.

    uv run --with pymupdf pipeline/diff_editions.py out_2025.json out_2026.json diff.json

WSDOT publishes a full new edition annually (2000-2026) rather than mid-cycle
amendment packets, so "what changed this year" is an edition-to-edition diff. Every
section carries a stable number, which makes matching exact rather than fuzzy.

A section is reported as:
  added     - present in the new edition only
  removed   - present in the old edition only
  vacated   - still numbered, but its text was struck and retitled "Vacant"
  changed   - same number, different text (word-level opcodes included)
  unchanged - identical after whitespace normalization
"""

import json
import re
import sys
from difflib import SequenceMatcher


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def word_diff(old_text, new_text):
    """Word-level opcodes, for rendering a side-by-side view in the browser."""
    old_words, new_words = normalize(old_text).split(), normalize(new_text).split()
    ops = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, old_words, new_words).get_opcodes():
        if tag == "equal":
            continue
        ops.append(
            {
                "op": tag,
                "old": " ".join(old_words[i1:i2]),
                "new": " ".join(new_words[j1:j2]),
            }
        )
    return ops


def load(path):
    """A parsed edition, keyed by section number."""
    with open(path) as handle:
        return {section["num"]: section for section in json.load(handle)}


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: diff_editions.py <old.json> <new.json> <out.json>")
    old_path, new_path, out_path = sys.argv[1:4]

    old, new = (load(path) for path in (old_path, new_path))

    result = {"added": [], "removed": [], "vacated": [], "changed": [], "unchanged": 0}

    for num in sorted(set(new) - set(old)):
        result["added"].append({"num": num, "title": new[num]["title"]})

    for num in sorted(set(old) - set(new)):
        result["removed"].append({"num": num, "title": old[num]["title"]})

    for num in sorted(set(old) & set(new)):
        before, after = old[num], new[num]
        if normalize(before["text"]) == normalize(after["text"]):
            result["unchanged"] += 1
            continue

        entry = {
            "num": num,
            "title": after["title"],
            "division": after["division"],
            "old_text": before["text"],
            "new_text": after["text"],
            "ops": word_diff(before["text"], after["text"]),
        }
        # A section struck from the book keeps its number but loses its text — worth
        # calling out separately, since drafts still referencing it are now stale.
        if after["vacant"] and not before["vacant"]:
            result["vacated"].append(entry)
        else:
            result["changed"].append(entry)

    with open(out_path, "w") as handle:
        json.dump(result, handle, indent=1)

    print(f"added     {len(result['added']):4}")
    print(f"removed   {len(result['removed']):4}")
    print(f"vacated   {len(result['vacated']):4}")
    print(f"changed   {len(result['changed']):4}")
    print(f"unchanged {result['unchanged']:4}")
    print(f"wrote     {out_path}")


if __name__ == "__main__":
    main()
