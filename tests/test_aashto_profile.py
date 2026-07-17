"""The AASHTO-decimal profile's ordering and division mapping.

This profile drives the shared engine for the ~36 states on the national "Section
105 -> 105.01" scheme. Ordering is the foundation the parser rests on (heading detection
rejects any section number that goes backwards), so the pure logic is pinned here — no
PDF required. The engine itself is proven against a real out-of-state book by parsing
North Dakota's 2025 edition; that book is not vendored (it is the state's to publish, and
its reuse terms are unstated), so the integration proof lives in the commit history rather
than as a corpus test.
"""

from parsers.clusters.aashto_decimal import AASHTO, division_of, order_key


def test_orders_a_full_aashto_ladder():
    """The canonical progression: section, its subsections, next section."""
    book_order = [
        "101",
        "101.01",
        "101.02",
        "105",
        "105.01",
        "105.02",
        "105.15",
        "106.02",
        "421.04",
        "896.17",
    ]
    assert sorted(book_order, key=order_key) == book_order


def test_parent_sorts_before_its_own_subsections():
    """105 opens before 105.01 — the shorter (parent) number sorts first."""
    assert order_key("105") < order_key("105.01")
    assert order_key("105.01") < order_key("105.01.1")


def test_subsections_sort_numerically_not_lexically():
    """.02 precedes .10, and .09 precedes .15 — string comparison gets these wrong."""
    assert order_key("105.02") < order_key("105.10")
    assert order_key("105.09") < order_key("105.15")


def test_deep_subclauses_stay_comparable():
    """Missouri-style 105.15.2.1 compares cleanly against a shallower number."""
    assert order_key("105.15") < order_key("105.15.2.1")
    assert order_key("105.15.2.1") < order_key("106")


def test_division_is_the_hundred_series():
    """A section maps to its hundred-series division."""
    assert division_of("101.02") == 100
    assert division_of("105.01") == 100
    assert division_of("421.04") == 400
    assert division_of("896.17") == 800
    assert division_of("1042") == 1000  # four-digit materials sections (e.g. MoDOT)


def test_profile_is_wired_to_its_functions():
    """The profile exposes the same ordering/division logic tested above."""
    assert AASHTO.order_key("105.01") == order_key("105.01")
    assert AASHTO.division_of("105.01") == division_of("105.01")
    assert AASHTO.stable_numbers is False  # AASHTO states renumber across editions
    assert AASHTO.section_re.match("105.01 GENERAL").group(1) == "105.01"
