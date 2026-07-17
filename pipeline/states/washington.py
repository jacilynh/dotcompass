"""Washington — state #1, and the reference implementation.

WSDOT publishes an edition on a stable annual-ish cadence with section numbers that persist
across editions, which is exactly what makes the 26-year section-history feature possible.
Its Standard Specifications are a public government publication, redistributed here as an
explicitly unofficial copy.
"""

from states.base import REUSE_PUBLIC, Division, StateDescriptor

# The nine divisions are part of the spec's published structure (M 41-10).
_DIVISIONS = (
    Division(1, "General Requirements"),
    Division(2, "Temporary Features"),
    Division(3, "Earthwork"),
    Division(4, "Aggregates and Bases"),
    Division(5, "Surface Treatments and Pavements"),
    Division(6, "Structures"),
    Division(7, "Drainage Structures, Storm Sewers, Sanitary Sewers, Water Mains, and Conduits"),  # noqa: E501
    Division(8, "Miscellaneous Construction"),
    Division(9, "Materials"),
)

# The 17 editions held in corpus/ (files named SS<year>.pdf).
_YEARS = (
    2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016,
    2018, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
)

WASHINGTON = StateDescriptor(
    slug="wa",
    state="Washington",
    dot="WSDOT",
    profile="wsdot_hyphen",
    edition_model="annual",
    editions=tuple((year, f"SS{year}.pdf") for year in _YEARS),
    history=True,
    reuse=REUSE_PUBLIC,
    divisions=_DIVISIONS,
    source_url="https://wsdot.wa.gov/engineering-standards/all-manuals-and-standards/manuals",
    source_note=(
        "Washington State DOT Standard Specifications for Road, Bridge, and Municipal "
        "Construction (M 41-10). Unofficial copy; not affiliated with or endorsed by WSDOT."
    ),
)
