"""Rhode Island - Wave 3 state on the new letter_prefix profile (RIDOT Feb 2026 Blue Book).

RIDOT numbers its main body with AASHTO-decimal numbers ("101.01") and its Landscaping,
Materials, and Traffic parts with a single-letter prefix ("L02.03.7", "M02.09.2", "T13");
see parsers/clusters/letter_prefix.py. The numeric main body first parsed fine on
aashto_decimal but the lettered parts (whole Parts L/M/T) were invisible to it - that
Stage 2 QA failure is what the letter_prefix profile fixes (887 -> 1,407 sections).

The lettered parts get synthetic integer division bands above the numeric ones (L=1012,
M=1013, T=1020) so division ids stay plain integers and the app needs no change. Constraints:

  * history=False. Only the February 2026 edition is onboarded; browse + search only.
  * reuse=ALL_RIGHTS_RESERVED - the strongest gate. RIDOT reserves rights, so it is
    build-only under --allow-uncleared and must never be emitted by a publishing build.
"""

from states.base import REUSE_RESERVED, Division, StateDescriptor

_DIVISIONS = tuple(
    Division(hundred, f"{hundred}-{hundred + 99} Series")
    for hundred in (100, 200, 300, 400, 500, 600, 700, 800, 900)
) + (
    Division(1012, "Part L: Landscaping"),
    Division(1013, "Part M: Materials"),
    Division(1020, "Part T: Traffic"),
)

RHODE_ISLAND = StateDescriptor(
    slug="ri",
    state="Rhode Island",
    dot="RIDOT",
    profile="letter_prefix",
    edition_model="periodic",
    editions=((2026, "current.pdf"),),
    history=False,
    reuse=REUSE_RESERVED,
    divisions=_DIVISIONS,
    source_url="https://www.dot.ri.gov/business/bluebook/docs/Blue_Book_02_2026.pdf",
    source_note=(
        "Rhode Island DOT Standard Specifications (Blue Book, February 2026). Unofficial "
        "copy; RIDOT reserves rights - not cleared for redistribution. Not affiliated with "
        "or endorsed by RIDOT."
    ),
    corpus_label="RIDOT Standard Specifications (Blue Book)",
    # requirements / ask / semantic default False - browse + search only.
)
