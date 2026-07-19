"""Maine - Wave 2 state on the section_prefix profile (MaineDOT March 2026 Standard Specs).

MaineDOT prints "SECTION 101 - Title" headings and numbers no decimal sub-headings, so the
addressable unit is the whole SECTION (the section_prefix cluster). The book heads each
hundred-series band with a named division ("DIVISION 100 - GENERAL CONDITIONS" through
"DIVISION 600 - MISCELLANEOUS CONSTRUCTION", then Materials), used verbatim below.
Constraints:

  * history=False. Only the March 2026 edition is onboarded; browse + search only.
  * reuse=UNSTATED. MaineDOT grants no redistribution license, so the reuse gate blocks a
    publishing build from emitting Maine's text; local-only via --allow-uncleared.

Parse quirks (Stage 2 QA, PASS 20/20 after the engine header-band fix):
  * 22.6% of sections are empty - benign "Reserved"/"Removed"/"Vacant" placeholder sections
    MaineDOT holds with no content by design (verified deterministically), not text loss.
  * Appendix A (Federal Contract Provisions Supplement) restarts SECTION numbering at 1;
    the engine's monotonic-order filter correctly excludes that restarted series.
"""

from states.base import REUSE_UNSTATED, Division, StateDescriptor

# Division titles as printed at each band's divider (700 = Materials, per its content).
_DIVISIONS = (
    Division(100, "General Conditions"),
    Division(200, "Earthwork"),
    Division(300, "Bases"),
    Division(400, "Pavements"),
    Division(500, "Structures"),
    Division(600, "Miscellaneous Construction"),
    Division(700, "Materials"),
)

MAINE = StateDescriptor(
    slug="me",
    state="Maine",
    dot="MaineDOT",
    profile="section_prefix",
    edition_model="periodic",
    editions=((2026, "current.pdf"),),
    history=False,
    reuse=REUSE_UNSTATED,
    divisions=_DIVISIONS,
    source_url=(
        "https://www.maine.gov/dot/sites/maine.gov.dot/files/inline-files/"
        "MaineDOT_Standard_Specifications_March_2026.pdf"
    ),
    source_note=(
        "Maine DOT Standard Specifications (March 2026). Unofficial copy; reuse terms "
        "unstated by MaineDOT. Not affiliated with or endorsed by MaineDOT."
    ),
    corpus_label="MaineDOT Standard Specifications",
    # requirements / ask / semantic default False - browse + search only.
)
