"""Indiana - AASHTO-decimal state (INDOT 2026 Standard Specifications).

INDOT's numbering is ordinary aashto_decimal; the reason it was deferred is a broken PDF
text layer. A scattered ~0.2% subset of spans - including some section headings - ships an
embedded font whose glyphs are offset 29 codepoints too low, so the text extracts as
control-char gibberish ("416.07 Equipment" -> "\\x17\\x14...(TXLSPHQW"). `text_fixup`
(deshift_indot) repairs those runs span-by-span at parse time; see parsers/fixups.py.
Constraints:

  * history=False. Only the 2026 edition (single combined PDF, despite the catalog's
    per-division label) is onboarded; browse + search only.
  * reuse=ALL_RIGHTS_RESERVED - build-only under --allow-uncleared, never emitted by a
    publishing build until cleared.

Hundred-series divisions with no printed divider names on the section pages -> honest
numeric band labels (the North Dakota rule).
"""

from parsers.fixups import deshift_indot

from states.base import REUSE_RESERVED, Division, StateDescriptor

_DIVISIONS = tuple(
    Division(hundred, f"{hundred}-{hundred + 99} Series")
    for hundred in (100, 200, 300, 400, 500, 600, 700, 800, 900)
)

INDIANA = StateDescriptor(
    slug="in",
    state="Indiana",
    dot="INDOT",
    profile="aashto_decimal",
    edition_model="biennial",
    editions=((2026, "current.pdf"),),
    history=False,
    reuse=REUSE_RESERVED,
    divisions=_DIVISIONS,
    source_url=(
        "https://www.in.gov/dot/div/contracts/standards/book/sep25/"
        "2026%20Standard%20Specifications.pdf"
    ),
    source_note=(
        "Indiana DOT Standard Specifications (2026). Unofficial copy; INDOT reserves rights "
        "- not cleared for redistribution. Not affiliated with or endorsed by INDOT."
    ),
    corpus_label="INDOT Standard Specifications",
    text_fixup=deshift_indot,
    # requirements / ask / semantic default False - browse + search only.
)
