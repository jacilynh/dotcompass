"""End-to-end checks against the real PDFs.

These are the tests that would actually have caught the parser's real failures, so they
assert on ground truth rather than on shapes. They need the 17 source PDFs, which are
WSDOT's to publish and not ours to vendor into a git repo — so they self-skip on a
fresh clone. `make corpus` fetches them.
"""

import pytest
from parse_any_edition import parse

pytestmark = pytest.mark.corpus

# The 2026 edition ships a complete embedded table of contents listing 2,235 numbered
# sections. It is the only edition with trustworthy ground truth, which makes it the
# yardstick for a parser that deliberately ignores the TOC entirely.
TOC_LISTED_2026 = 2235


@pytest.fixture(scope="module")
def parsed_2026(corpus_dir):
    sections, _, _ = parse(str(corpus_dir / "SS2026.pdf"))
    return {s["num"]: s for s in sections}


def test_recovers_every_section_the_2026_toc_lists(parsed_2026, corpus_dir):
    """Zero misses against ground truth. The parser never reads the TOC to get here."""
    import fitz
    from parse_any_edition import HEAD

    doc = fitz.open(str(corpus_dir / "SS2026.pdf"))
    listed = {
        m.group(1)
        for _, title, page in doc.get_toc()
        if page >= 40 and (m := HEAD.match(title.replace("\t", " ").strip()))
    }

    assert len(listed) == TOC_LISTED_2026
    assert not listed - set(parsed_2026), "sections in the TOC that the parser missed"


def test_finds_sections_the_toc_omits(parsed_2026):
    """WSDOT's own TOC stops short of the deepest level, e.g. 1-04.4(2)A.

    Finding *more* than the TOC is the expected outcome, not a false-positive smell.
    """
    assert len(parsed_2026) > TOC_LISTED_2026
    assert "1-04.4(2)A" in parsed_2026


def test_vacant_sections_are_read_as_data_not_dropped(parsed_2026):
    """A draft citing a struck section is a real finding — so Vacant must survive."""
    assert parsed_2026["1-09.7"]["vacant"] is True
    assert sum(1 for s in parsed_2026.values() if s["vacant"]) > 100


def test_body_text_is_attached_to_the_right_section(parsed_2026):
    text = parsed_2026["1-07.1(1)"]["text"]
    assert text.startswith("The Contractor shall always comply")
    assert "1-07.1(2)" not in text, "next section's heading leaked into this one"


def test_the_running_header_is_not_mistaken_for_a_heading(parsed_2026):
    """Every page reprints its section heading at the top; only position tells them
    apart. If the band stripping regressed, body text would be full of header noise."""
    assert "2026 Standard Specifications" not in parsed_2026["1-07.1(1)"]["text"]


@pytest.mark.parametrize(
    ("year", "minimum"),
    [(2000, 2000), (2004, 2000), (2008, 2200), (2012, 2600), (2020, 2800), (2026, 3200)],
)
def test_every_typographic_era_parses(corpus_dir, year, minimum):
    """One case per era: Times (2000-08), TimesNewRoman (2010-18), Lato (2020-26).

    2004 is here because it is the hardest: its headings share a span with their titles
    AND it carries an APWA Supplement that restarts numbering at 1-01 mid-book. It once
    parsed to 1,182 sections instead of ~2,200.
    """
    pdf = corpus_dir / f"SS{year}.pdf"
    if not pdf.exists():
        pytest.skip(f"{pdf.name} not downloaded")

    sections, _, _ = parse(str(pdf))
    assert len(sections) >= minimum
