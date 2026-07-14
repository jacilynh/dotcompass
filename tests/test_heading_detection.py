"""Heading detection, and the two traps that make it hard.

The parser reads 17 editions spanning 26 years, in which the page size, the heading
font, and even the heading *layout* all change. It cannot hardcode typography, so it
infers it — and then defends against two failure modes that each silently destroyed a
large fraction of the book before being caught:

  1. A cross-reference table cell looks exactly like a heading. Rejecting these by
     order is right, but doing it greedily is a trap (see below).
  2. Section numbers restart at 1-01 more than once per document.
"""

from conftest import line
from parse_any_edition import find_headings, is_heading_style, monotonic

BODY = ("Lato-Regular", 8)


def marks(*nums):
    """Heading marks as `monotonic` consumes them: (line index, number, title)."""
    return [(i, num, "") for i, num in enumerate(nums)]


def numbers(chain):
    return [num for _, num, _ in chain]


class TestHeadingStyle:
    """The weight word changes across eras; the contrast with body text does not."""

    def test_recognizes_each_eras_heading_font(self):
        for font in ("Times-Bold", "TimesNewRomanPS-BoldMT", "Lato-Heavy"):
            assert is_heading_style((font, 9), BODY), font

    def test_lato_heavy_has_no_bold_in_its_name(self):
        """The 2020-2026 editions set headings in Lato-Heavy.

        Matching the literal string "Bold" therefore fails on a third of the corpus —
        it collapsed those editions to ~140 sections before this was caught.
        """
        assert "bold" not in "Lato-Heavy".lower()
        assert is_heading_style(("Lato-Heavy", 14), BODY)

    def test_falls_back_to_a_size_jump_when_the_name_says_nothing(self):
        assert is_heading_style(("Whatever-Regular", 14), BODY)
        assert not is_heading_style(("Whatever-Regular", 8), BODY)

    def test_body_text_is_never_a_heading(self):
        assert not is_heading_style(BODY, BODY)


class TestFindHeadings:
    def test_reads_a_number_only_line(self):
        """2020-2026 put the title on the line after the number."""
        found = find_headings([line("1-07.1", font="Lato-Heavy", size=14)], BODY)
        assert numbers(found) == ["1-07.1"]

    def test_reads_a_number_and_title_sharing_one_line(self):
        """2000-2018 put both in a single span: "1-09.2(1) General Requirements"."""
        found = find_headings(
            [line("1-09.2(1) General Requirements", font="Times-Bold", size=9)], BODY
        )
        assert found[0][1] == "1-09.2(1)"
        assert found[0][2] == "General Requirements"

    def test_ignores_contents_lines_with_dot_leaders(self):
        """The front matter is bold section numbers all the way down."""
        contents = line("1-99 APWA SUPPLEMENT........1-119", font="Times-Bold", size=9)
        assert find_headings([contents], BODY) == []

    def test_ignores_a_section_number_mentioned_inside_body_prose(self):
        prose = line("as required by Section 9-03.11(3)", font="Lato-Regular", size=8)
        assert find_headings([prose], BODY) == []


class TestMonotonicOrder:
    """Section numbers only ever increase through the body."""

    def test_drops_a_backward_reference(self):
        """A Division 9 table cell citing an earlier section is not a heading.

        The surrounding run is made unambiguously longer on purpose: with only one
        heading on each side, both readings are the same length and a
        longest-subsequence algorithm may legitimately return either. Real headings
        outnumber stray cells by orders of magnitude, so this is the honest case.
        """
        chain = monotonic(marks("9-03.2", "9-03.3", "9-03.1", "9-03.4", "9-03.5"))
        assert numbers(chain) == ["9-03.2", "9-03.3", "9-03.4", "9-03.5"]

    def test_one_stray_high_number_does_not_truncate_the_book(self):
        """The bug that a greedy scan cannot survive.

        A table cell citing 9-35 from inside Division 1 is accepted by a greedy scan
        (it increases), and from then on every real heading below 9-35 is rejected —
        which is to say, the entire rest of the book. A longest non-decreasing
        subsequence drops the one outlier instead.
        """
        chain = monotonic(marks("1-01", "9-35", "1-02", "1-03", "1-04"))
        assert numbers(chain) == ["1-01", "1-02", "1-03", "1-04"]

    def test_keeps_the_longer_of_two_competing_runs(self):
        chain = monotonic(marks("5-01", "5-02", "1-01", "1-02", "1-03", "1-04"))
        assert numbers(chain) == ["1-01", "1-02", "1-03", "1-04"]

    def test_allows_equal_neighbours(self):
        """A number can be repeated (continuation headers); it must not be dropped."""
        assert len(monotonic(marks("1-01", "1-01", "1-02"))) == 3

    def test_empty_input(self):
        assert monotonic([]) == []
