"""Section numbers must sort the way the printed book reads.

This is the foundation the whole parser rests on: heading detection rejects any
section number that goes backwards, so if the ordering is wrong, real headings get
discarded as if they were table cells. Every case below is a shape that actually
occurs in M 41-10.
"""

import pytest
from parse_any_edition import sort_key


def test_orders_a_full_section_ladder():
    """The canonical progression, deepest level included."""
    book_order = [
        "1-01",
        "1-01.1",
        "1-01.2",
        "1-01.2(1)",
        "1-01.2(2)",
        "1-02",
        "1-02.1",
        "9-03",
        "9-03.8",
        "9-03.8(2)",
        "9-35",
    ]
    assert sorted(book_order, key=sort_key) == book_order


def test_parent_sorts_before_its_own_children():
    """1-01 opens before 1-01.1 — a parent is not "greater" than its subsections.

    This is why the decimal component defaults to -1 rather than 0: a bare 1-01 must
    sort below 1-01.1, and 0 would collide with a hypothetical 1-01.0.
    """
    assert sort_key("1-01") < sort_key("1-01.1")
    assert sort_key("9-03") < sort_key("9-03.8")


def test_numeric_subparts_sort_numerically_not_lexically():
    """(2) precedes (10). String comparison would get this backwards."""
    assert sort_key("1-07.15(2)") < sort_key("1-07.15(10)")


def test_lettered_subparts_sort_after_numeric_ones():
    """The book runs (1), (2) … then A, B — so letters rank above digits."""
    assert sort_key("8-21.3(9)") < sort_key("8-21.3(9)A")
    assert sort_key("8-21.3(9)A") < sort_key("8-21.3(9)B")


def test_differing_depths_stay_comparable():
    """A key is padded to a fixed shape, so shallow and deep numbers never raise.

    Before padding, comparing 1-01 against 1-01.2(3) compared an int against a tuple
    and crashed with a TypeError. That bug is what this test exists to prevent.
    """
    shallow, deep = sort_key("1-01"), sort_key("1-01.2(3)")
    assert shallow < deep  # must not raise
    assert len(shallow) == len(deep)


@pytest.mark.parametrize("num", ["1-01", "9-03.8(2)A", "1-07.15(10)", "6-02.3(2)"])
def test_key_is_totally_ordered_against_itself(num):
    assert sort_key(num) == sort_key(num)
