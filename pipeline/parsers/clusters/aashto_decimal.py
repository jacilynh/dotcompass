"""The AASHTO decimal scheme: "105", "105.01", "105.15.2.1" — the national pattern.

Roughly 36 state DOTs organize their standard specifications this way (see
`docs/national/EXPANSION.md`): three-digit Section numbers grouped into hundred-series
divisions (100 = General Provisions, 200 = Earthwork, ...), with dot-delimited decimal
subsections. One profile drives the shared engine for the entire cluster; a state joins
it by pointing its descriptor here, not by adding code.

Unlike WSDOT, section numbers are NOT guaranteed stable across editions here, so the
history build must fall back to content alignment (`stable_numbers=False`).
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
