"""State descriptors and the reuse gate.

The reuse gate is the mechanism that keeps an uncleared state's text from ever being
published. These tests pin its behavior — Washington is cleared and publishable, North
Dakota is not — and check that a descriptor resolves to the right numbering profile.
"""

import pytest
from parsers.clusters.aashto_decimal import AASHTO
from parsers.clusters.wsdot_hyphen import WSDOT
from states.base import REUSE_PUBLIC, REUSE_UNSTATED, Division, StateDescriptor
from states.north_dakota import NORTH_DAKOTA
from states.washington import WASHINGTON


def test_washington_is_cleared_and_publishable():
    assert WASHINGTON.reuse == REUSE_PUBLIC
    assert WASHINGTON.may_publish_text is True
    assert WASHINGTON.history is True
    assert WASHINGTON.spec_profile is WSDOT
    assert WASHINGTON.latest == 2026


def test_north_dakota_is_not_cleared():
    """The pilot state's text must NOT be publishable — the reuse gate's whole point."""
    assert NORTH_DAKOTA.reuse == REUSE_UNSTATED
    assert NORTH_DAKOTA.may_publish_text is False
    assert NORTH_DAKOTA.history is False  # single edition, no archive
    assert NORTH_DAKOTA.spec_profile is AASHTO
    assert NORTH_DAKOTA.latest == 2025


def test_unknown_reuse_status_is_rejected():
    with pytest.raises(ValueError, match="unknown reuse status"):
        _descriptor(reuse="totally-fine-trust-me")


def test_a_descriptor_needs_at_least_one_edition():
    with pytest.raises(ValueError, match="at least one edition"):
        _descriptor(editions=())


def test_division_title_falls_back_to_the_number():
    """A state that names its divisions returns the name; a lookup miss returns the id."""
    assert WASHINGTON.division_title(9) == "Materials"
    assert WASHINGTON.division_title(99) == "99"  # not a real division


def test_north_dakota_uses_honest_numeric_band_labels():
    """NDDOT prints no division names, so labels are numeric bands, not invented titles."""
    assert NORTH_DAKOTA.division_title(100) == "100-199 Series"


def _descriptor(**overrides):
    fields = {
        "slug": "xx",
        "state": "Example",
        "dot": "XDOT",
        "profile": "aashto_decimal",
        "edition_model": "annual",
        "editions": ((2025, "2025.pdf"),),
        "history": False,
        "reuse": REUSE_PUBLIC,
        "divisions": (Division(100, "100-199 Series"),),
        "source_url": "https://example.gov/spec.pdf",
        "source_note": "Example.",
    }
    fields.update(overrides)
    return StateDescriptor(**fields)
