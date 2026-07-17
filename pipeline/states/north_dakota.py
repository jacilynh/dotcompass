"""North Dakota — the first out-of-state pilot, on the shared AASHTO-decimal profile.

Onboarded as a proof that the cluster model produces a working state, not just a parse.
Two deliberate constraints, both honest to the source document:

  * history=False. Only the current (2025) edition is onboarded; there is no processed
    multi-edition archive yet, and AASHTO numbers are not stable across editions anyway, so
    the section-history feature stays off for North Dakota (it is browse + search).
  * reuse=UNSTATED. NDDOT publishes the book with an "as-is" liability disclaimer and no
    license grant, so the text is NOT cleared for redistribution. The reuse gate therefore
    blocks a publishing build from emitting North Dakota's text; it can only be built
    locally with build_state.py --allow-uncleared until the terms are cleared.

NDDOT prints no division names — sections are grouped only by hundred-series number — so the
divisions below carry honest numeric-band labels rather than invented AASHTO titles.
"""

from states.base import REUSE_UNSTATED, Division, StateDescriptor

# Hundred-series bands actually present in the 2025 book (verified by parsing it).
_DIVISIONS = tuple(
    Division(hundred, f"{hundred}-{hundred + 99} Series")
    for hundred in (100, 200, 300, 400, 500, 600, 700, 800)
)

NORTH_DAKOTA = StateDescriptor(
    slug="nd",
    state="North Dakota",
    dot="NDDOT",
    profile="aashto_decimal",
    edition_model="periodic",
    editions=((2025, "2025.pdf"),),
    history=False,
    reuse=REUSE_UNSTATED,
    divisions=_DIVISIONS,
    source_url=(
        "https://www.dot.nd.gov/sites/www/files/documents/Standard%20Specifications/"
        "2025%20NDDOT%20Standard%20Specifications%20for%20Road%20and%20Bridge%20Construction.pdf"
    ),
    source_note=(
        "North Dakota DOT Standard Specifications for Road and Bridge Construction (2025). "
        "Unofficial copy; reuse terms unstated by NDDOT. Not affiliated with or endorsed "
        "by NDDOT."
    ),
)
