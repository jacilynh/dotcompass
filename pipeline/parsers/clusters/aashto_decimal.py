"""The AASHTO decimal scheme: "105", "105.01", "105.15.2.1" — the national pattern.

Roughly 36 state DOTs organize their standard specifications this way (see
`docs/national/EXPANSION.md`): three-digit Section numbers grouped into hundred-series
divisions (100 = General Provisions, 200 = Earthwork, ...), with dot-delimited decimal
subsections. One profile drives the shared engine for the entire cluster; a state joins
it by pointing its descriptor here, not by adding code.

Unlike WSDOT, section numbers are NOT guaranteed stable across editions here, so the
history build must fall back to content alignment (`stable_numbers=False`).

Heading depth stops at the decimal subsection (`105.01`) on purpose. WSDOT prints the full
number at its deepest level ("9-03.8(2)A"), so a regex reaches it — but the AASHTO books
don't all behave that way. PennDOT (Pub 408) was checked directly: its lettered sub-level
appears in the body only as a bare "(a) Slurry Management." lead-in, and the full
"104.06(a)" is printed *solely in the running page header* (51 header occurrences vs 3 in
the body across the sample). Extending this pattern to "(letter)" therefore captured no
real subsections there — only a stray header that slipped the band filter. Reaching that
level needs a header-context step (read the running header to learn the current section,
then attach the body's "(a)" lead-ins to it), which is a per-state parser feature, not a
change to this shared profile. So the cluster profile deliberately stops at the level the
body actually numbers.
"""

import re

from parsers.profiles import SpecProfile

# A heading opens with a hundred-series section number and optional decimal subsections:
#   105 | 105.01 | 421.04 | 105.15.2.1
SECTION = re.compile(r"^(\d{3,4}(?:\.\d+)*)(?:\s+(.*))?$", re.S)


def order_key(num):
    """Book order for a decimal number: 105 < 105.01 < 105.02 < 106. Shorter sorts first."""
    return tuple(int(part) for part in num.split("."))


def division_of(num):
    """Hundred-series division a section belongs to: 105 -> 100, 421 -> 400, 1042 -> 1000."""
    return int(num.split(".")[0]) // 100 * 100


AASHTO = SpecProfile(
    cluster="aashto_decimal",
    section_re=SECTION,
    order_key=order_key,
    division_of=division_of,
    first_section="101",  # Division 100 opens at Section 101 in the AASHTO layout
    stable_numbers=False,
)
