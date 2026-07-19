"""Florida - Wave 2 state on the new florida_dash profile (FDOT FY2026-27 Standard Specs).

FDOT numbers subsections with a dash ("1-1", "2-2.1", "105-8"); see
parsers/clusters/florida_dash.py. The book prints named groups for each section-number
band - DIVISION I for the single-digit sections, the Division II topic headings for the
100-700 bands, and DIVISION III for the 900s - used verbatim below. Constraints:

  * history=False. Only the FY2026-27 edition is onboarded; FDOT numbers are not stable
    across editions - browse + search only.
  * reuse=UNSTATED. FDOT grants no redistribution license, so the reuse gate blocks a
    publishing build from emitting Florida's text; local-only via --allow-uncleared.

Parse quirks (Stage 2 QA, PASS 20/20 after the engine header-band fix):
  * 13.8% of sections are empty - benign container subsections (a bare "NNN-N" label whose
    prose lives in its "NNN-N.K" children, like Delaware's X.3 containers).
  * FDOT prints no spatially-separated footer, so page-footer boilerplate ("Return to Table
    of Contents") can leak into a section that spans a page break - cosmetic, no content lost.
"""

from states.base import REUSE_UNSTATED, Division, StateDescriptor

# Section-number bands as named in the book (Division I / II topic groups / Division III).
_DIVISIONS = (
    Division(0, "General Requirements and Covenants"),
    Division(100, "General Construction Operations"),
    Division(200, "Base Courses"),
    Division(300, "Bituminous Treatments, Surface Courses, and Concrete Pavement"),
    Division(400, "Structures"),
    Division(500, "Incidental Construction"),
    Division(600, "Traffic Control Signals and Devices"),
    Division(700, "Signing, Pavement Marking, and Lighting"),
    Division(900, "Materials"),
)

FLORIDA = StateDescriptor(
    slug="fl",
    state="Florida",
    dot="FDOT",
    profile="florida_dash",
    edition_model="annual",
    editions=((2026, "current.pdf"),),
    history=False,
    reuse=REUSE_UNSTATED,
    divisions=_DIVISIONS,
    source_url=(
        "https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/"
        "specifications/by-year/fy-2026-27/ebook/fy-2026-27-ebook-compressed.pdf"
    ),
    source_note=(
        "Florida DOT Standard Specifications for Road and Bridge Construction (FY 2026-27). "
        "Unofficial copy; reuse terms unstated by FDOT. Not affiliated with or endorsed "
        "by FDOT."
    ),
    corpus_label="FDOT Standard Specifications for Road and Bridge Construction",
    # requirements / ask / semantic default False - browse + search only.
)
