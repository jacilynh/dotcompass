"""Resolve a numbering-scheme cluster id to its SpecProfile.

A state descriptor names its scheme as a string ("aashto_decimal") so it stays decoupled
from the profile objects; this is the one place that maps the string to the profile. Add a
new cluster by importing its profile here.
"""

from parsers.clusters.aashto_decimal import AASHTO
from parsers.clusters.wsdot_hyphen import WSDOT

PROFILES = {profile.cluster: profile for profile in (WSDOT, AASHTO)}


def get_profile(cluster):
    try:
        return PROFILES[cluster]
    except KeyError:
        known = ", ".join(sorted(PROFILES))
        raise KeyError(
            f"unknown parser cluster {cluster!r}; known clusters: {known}"
        ) from None
