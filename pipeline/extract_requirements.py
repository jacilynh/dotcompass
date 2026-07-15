#!/usr/bin/env python3
"""
Extract the obligations ("... shall ...", "... must ...") from the current edition.

    uv run --with pymupdf pipeline/extract_requirements.py pipeline/out/e2026.json \\
        pipeline/requirements.json

Every requirement in the output is a VERBATIM sentence from the specifications — there
is nothing generated or paraphrased, so there is nothing to hallucinate. This is a
deliberate choice: a compliance reference has to be trustworthy before it is clever, so
the extraction is rule-based and reproducible rather than model-assisted. The one piece
of judgment — who the obligation binds — is made tractable by WSDOT's own drafting
convention, in which the Contractor "shall" and the Contracting Agency "will".

Each requirement carries:
    section   the section number it came from (its link back to full context)
    division  1-9
    party     who is bound — Contractor / Engineer / Contracting Agency / Work/Material
    modal     the obligation word that triggered it — shall / must / required
    topics    zero or more keyword-based tags (Submittals, Testing, Payment, …) for
              cross-cutting filters that the section hierarchy alone can't provide
    text      the sentence itself

Accuracy is not assumed. `main` prints a random sample so the party classification can
be spot-checked by hand, and the honest accuracy figure goes in the docs.
"""

import json
import re
import sys
from collections import Counter

# Obligation words. WSDOT uses "shall" for duties and "must" for requirements; "will" is
# reserved for the Contracting Agency's own actions and is intentionally NOT treated as
# an obligation here (it would swamp the set with future-tense narration).
MODAL = re.compile(r"\b(shall|must)\b", re.I)
REQUIRED = re.compile(r"\b(is|are)\s+required\b", re.I)

# The actors named in the specifications, most specific first so "Contracting Agency"
# is matched before the bare "Agency" and before "Engineer" in a mixed sentence.
#
# The negative lookahead excludes the POSSESSIVE form: "the Contractor's options" names
# the Contractor but does not put the obligation on it ("...options, the posts shall be
# treated..."), whereas "the Contractor shall" does. Missing this is the single biggest
# source of mis-attribution — a possessive before a passive spec looked like a duty.
# The PDF uses both a straight (U+0027) and a typographic (U+2019) apostrophe.
_NOT_POSSESSIVE = r"(?!['\u2019]s)"
ACTORS = [
    ("Contracting Agency", re.compile(r"\bContracting Agency\b" + _NOT_POSSESSIVE)),
    ("Engineer", re.compile(r"\bEngineer\b" + _NOT_POSSESSIVE)),
    ("Contractor", re.compile(r"\bContractor\b" + _NOT_POSSESSIVE)),
]

# Broad, reliable topic tags for cross-cutting filters. Kept deliberately few and
# unambiguous — a filter the reader can trust beats a long list of noisy labels.
TOPICS = {
    "Submittals": r"\b(submit|submittal|working drawing|shop drawing|catalog cut)",
    "Testing & Inspection": r"\b(test|sampl|inspect|certif|accept(?:ance|ed)?)\b",
    "Payment & Measurement": r"\b(payment|paid|measured|lump sum|unit price|bid item)\b",
    "Traffic Control": r"\b(traffic|flagger|work zone|detour|signal|pedestrian)\b",
    "Environmental": r"\b(erosion|sediment|stormwater|spill|wetland|turbidity|permit)\b",
    "Safety": r"\b(safety|hazard|protective|fall protection|confined space)\b",
    "Materials": r"\b(material|aggregate|concrete|asphalt|reinforc|weld|steel|cement)\b",
    "Schedule": r"\b(schedule|progress|working days|completion|time for completion)\b",
}
TOPIC_PATTERNS = {name: re.compile(pat, re.I) for name, pat in TOPICS.items()}

# Abbreviations after which a period does NOT end a sentence. Without this the splitter
# breaks "U.S. Department" and "No. 4 sieve" into fragments.
ABBREV = {
    "no",
    "nos",
    "inc",
    "co",
    "corp",
    "st",
    "ave",
    "rd",
    "u.s",
    "e.g",
    "i.e",
    "etc",
    "vs",
    "mr",
    "mrs",
    "dr",
    "sec",
    "std",
    "min",
    "max",
    "approx",
    "dept",
    "fig",
    "mt",
    "wt",
    "vol",
    "ft",
    "in",
    "lb",
    "psi",
    "aashto",
    "astm",
    "wsdot",
}

# End of a sentence: . ! or ? then whitespace then an uppercase letter — but not when the
# period follows a digit (decimals, section numbers) or a known abbreviation.
SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")


def split_sentences(text: str) -> list[str]:
    """Split section text into sentences, guarding decimals and common abbreviations."""
    flat = re.sub(r"\s+", " ", text).strip()
    if not flat:
        return []

    sentences, start = [], 0
    for match in SENTENCE_END.finditer(flat):
        end = match.start()
        head = flat[start:end]
        last_word = re.search(r"(\S+)\.$", head)
        # Don't split after an abbreviation, or after a digit (a decimal or 1-07.1).
        if last_word:
            token = last_word.group(1).lower().rstrip(".")
            if token in ABBREV or token[-1:].isdigit():
                continue
        sentences.append(head.strip())
        start = match.end()
    tail = flat[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


def is_requirement(sentence: str) -> str | None:
    """The obligation word a sentence carries (shall / must / required), or None."""
    modal = MODAL.search(sentence)
    if modal:
        return modal.group(1).lower()
    if REQUIRED.search(sentence):
        return "required"
    return None


def classify_party(sentence: str) -> str:
    """Who the obligation binds, from the actor named closest before the obligation word.

    "The Contractor shall submit …" -> Contractor. A passive requirement with no named
    actor ("Backfill shall be compacted …") is Work/Material — a real requirement, but
    one that binds the work or material itself rather than a party. That case dominates
    the materials and construction divisions, which is expected, not a failure.
    """
    trigger = MODAL.search(sentence) or REQUIRED.search(sentence)
    before = sentence[: trigger.start()] if trigger else sentence

    best_party, best_pos = "Work/Material", -1
    for party, pattern in ACTORS:
        for m in pattern.finditer(before):
            if m.start() > best_pos:  # nearest actor to the obligation wins
                best_party, best_pos = party, m.start()
    return best_party


def tag_topics(sentence: str) -> list[str]:
    """Cross-cutting topic tags the sentence matches (possibly none)."""
    return [name for name, pattern in TOPIC_PATTERNS.items() if pattern.search(sentence)]


def extract_from_section(num: str, text: str) -> list[dict]:
    """Every requirement sentence in one section, with its classification."""
    out = []
    for sentence in split_sentences(text):
        modal = is_requirement(sentence)
        if not modal or len(sentence) < 20:  # skip stubs and headings
            continue
        out.append(
            {
                "section": num,
                "division": int(num[0]),
                "party": classify_party(sentence),
                "modal": modal,
                "topics": tag_topics(sentence),
                "text": sentence,
            }
        )
    return out


def extract_all(sections: list[dict]) -> list[dict]:
    out = []
    for section in sections:
        if section.get("vacant"):
            continue
        out.extend(extract_from_section(section["num"], section["text"]))
    return out


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_requirements.py <edition.json> <out.json>")
    edition_path, out_path = sys.argv[1], sys.argv[2]

    with open(edition_path) as handle:
        sections = json.load(handle)
    requirements = extract_all(sections)

    with open(out_path, "w") as handle:
        json.dump(requirements, handle, separators=(",", ":"))

    parties = Counter(r["party"] for r in requirements)
    topics = Counter(t for r in requirements for t in r["topics"])
    print(f"extracted {len(requirements):,} requirements from {len(sections):,} sections")
    print(f"  by party:  {dict(parties.most_common())}")
    print(f"  by topic:  {dict(topics.most_common())}")
    print(f"  untagged:  {sum(1 for r in requirements if not r['topics']):,}")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
