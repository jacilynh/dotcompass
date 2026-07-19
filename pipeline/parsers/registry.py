"""Resolve a numbering-scheme cluster id to its SpecProfile.

A state descriptor names its scheme as a string ("aashto_decimal") so it stays decoupled
from the profile objects; this is the one place that maps the string to the profile. Add a
new cluster by importing its profile here.
"""

from parsers.clusters.aashto_dash import AASHTO_DASH
from parsers.clusters.aashto_decimal import AASHTO
from parsers.clusters.florida_dash import FLORIDA
from parsers.clusters.letter_prefix import LETTER_PREFIX
from parsers.clusters.section_prefix import SECTION_PREFIX
from parsers.clusters.wsdot_hyphen import WSDOT

PROFILES = {
    profile.cluster: profile
    for profile in (WSDOT, AASHTO, FLORIDA, SECTION_PREFIX, AASHTO_DASH, LETTER_PREFIX)
}


def get_profile(cluster):
    try:
        return PROFILES[cluster]
    except KeyError:
        known = ", ".join(sorted(PROFILES))
        raise KeyError(
            f"unknown parser cluster {cluster!r}; known clusters: {known}"
        ) from None
