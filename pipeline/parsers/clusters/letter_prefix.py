"""Letter-prefixed section numbers, alongside AASHTO-decimal numeric ones (mixed books).

Some DOTs number whole parts of the book with a letter prefix. RIDOT keeps a numeric main
body ("101.01") but numbers its Landscaping / Materials / Traffic parts with a single-letter
prefix and no dash ("L02.03.7", "M02.09.2", "T13"). This one profile matches an optional
"LETTERS[-]" prefix in front of the shared AASHTO-decimal number, so a mixed book drives the
same engine.

Book order (RIDOT) is the numeric parts first, then the lettered parts alphabetically
(L, M, T). `division_of` keeps division ids as plain integers so the app needs no change: a
numeric section maps to its hundred-series band (100..900), and a lettered section to a
synthetic band above them (1000 + the sum of its letters' alphabet positions), which sorts
the lettered parts after the numeric ones and alphabetically among themselves. `order_key`
uses that same band as its most-significant element. Numbers are not stable across editions.

This serves the numeric+trailing-letters shape (RIDOT). A book that puts its lettered parts
FIRST and a numeric body second (MDOT SHA: GP/TC before the numeric sections) needs the
reverse ordering and is not handled here - see the note in docs/national/status.json.
"""

import re

from parsers.profiles import SpecProfile

# An optional "LETTERS" or "LETTERS-" prefix, then an AASHTO-decimal number, then the title.
SECTION = re.compile(r"^((?:[A-Z]{1,3}-?)?\d{1,4}(?:\.\d+)*)(?:\s+(.*))?$", re.S)
_PARTS = re.compile(r"^([A-Z]*)-?(\d+(?:\.\d+)*)$")


def _band(num):
    """Division band as an int: a numeric section -> its hundred (100..900); a lettered one ->
    1000 + the sum of its letters' alphabet positions, so lettered parts sort after numeric
    ones and alphabetically among themselves (L=1012, M=1013, T=1020)."""
    letters, digits = _PARTS.match(num).groups()
    if not letters:
        return int(digits.split(".")[0]) // 100 * 100
    return 1000 + sum(ord(c) - 64 for c in letters)


def order_key(num):
    """Book order: the division band is most significant (numeric bands, then lettered), then
    the decimal number within it."""
    digits = _PARTS.match(num).group(2)
    return (_band(num), *(int(part) for part in digits.split(".")))


def division_of(num):
    """Integer division id: the hundred band for a numeric section, the synthetic letter
    band otherwise."""
    return _band(num)


LETTER_PREFIX = SpecProfile(
    cluster="letter_prefix",
    section_re=SECTION,
    order_key=order_key,
    division_of=division_of,
    first_section="101.01",  # RIDOT opens numerically
    stable_numbers=False,
)
