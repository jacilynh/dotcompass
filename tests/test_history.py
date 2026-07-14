"""Building each section's 26-year timeline.

The interesting logic here is not the diffing — it is deciding what counts as a real
event. A section that vanishes for one edition and returns almost certainly wasn't
struck and reinstated by WSDOT; the parser missed it. Reporting those as history would
bury the ~17 genuine reinstatements under ~215 fabrications.
"""

from build_history import build, churn, clean_title, heal_single_edition_gaps, normalize


def section(num, text, *, title="Title", vacant=False):
    return {
        "num": num,
        "title": "Vacant" if vacant else title,
        "division": int(num[0]),
        "page": 1,
        "vacant": vacant,
        "text": text,
    }


def editions(**by_year):
    """Keyword years (`y2000=...`) into the {2000: {"1-01": section}} shape, in order."""
    return {int(year[1:]): sections for year, sections in sorted(by_year.items())}


def events_for(history, num):
    return [(e["year"], e["event"]) for e in history[num]["events"]]


class TestTextComparison:
    def test_reflowing_across_a_page_break_is_not_a_revision(self):
        """PDF text wraps differently between editions; that is not a spec change."""
        assert normalize("shall be\nplaced") == normalize("shall  be placed")

    def test_churn_separates_a_typo_from_a_rewrite(self):
        typo = churn(
            "the Contractor shall place the concrete", "the Contractor shall pour the concrete"
        )
        rewrite = churn(
            "the Contractor shall place the concrete", "entirely different language here now"
        )
        assert typo < 0.25 < rewrite

    def test_identical_text_has_no_churn(self):
        assert churn("same words", "same words") == 0.0

    def test_churn_handles_an_empty_side(self):
        assert churn("", "") == 0.0
        assert churn("", "new text") > 0


class TestTitles:
    def test_strips_contents_dot_leaders(self):
        assert clean_title("Definitions and Terms .  .  .  .  .") == "Definitions and Terms"

    def test_leaves_an_ordinary_title_alone(self):
        assert clean_title("Laws to be Observed") == "Laws to be Observed"


class TestGapHealing:
    def test_a_one_edition_disappearance_is_treated_as_a_parse_miss(self):
        """215 of 228 raw removed->reinstated pairs were gaps of exactly one edition,
        clustered in 2004 — the edition this parser handles least well. WSDOT does not
        strike and reinstate 215 sections two years apart."""
        eds = editions(
            y2000={"1-01": section("1-01", "text")},
            y2004={},  # parser missed it
            y2006={"1-01": section("1-01", "text")},
        )
        healed = heal_single_edition_gaps(eds)

        assert healed == 1
        assert "1-01" in eds[2004]
        assert eds[2004]["1-01"]["inferred"] is True  # never silently invented

    def test_healed_gaps_produce_no_removed_or_reinstated_events(self):
        eds = editions(
            y2000={"1-01": section("1-01", "text")},
            y2004={},
            y2006={"1-01": section("1-01", "text")},
        )
        heal_single_edition_gaps(eds)
        history = build(eds)

        assert events_for(history, "1-01") == [(2000, "introduced")]

    def test_a_genuine_multi_edition_absence_is_left_alone(self):
        """Healing must not erase real removals — only single-edition flicker."""
        eds = editions(
            y2000={"1-01": section("1-01", "text")},
            y2004={},
            y2006={},
            y2008={"1-01": section("1-01", "text")},
        )
        healed = heal_single_edition_gaps(eds)

        assert healed == 0
        assert events_for(history := build(eds), "1-01") == [
            (2000, "introduced"),
            (2004, "removed"),
            (2008, "reinstated"),
        ]
        assert history["1-01"]["current"] is True


class TestTimeline:
    def test_vacating_records_what_the_section_used_to_say(self):
        """The whole point of 1-09.7: knowing what Mobilization *was* before it was
        struck is what makes a stale citation actionable."""
        eds = editions(
            y2025={
                "1-09.7": section(
                    "1-09.7", "Mobilization consists of preconstruction expenses"
                )
            },
            y2026={"1-09.7": section("1-09.7", "", vacant=True)},
        )
        history = build(eds)
        vacated = next(e for e in history["1-09.7"]["events"] if e["event"] == "vacated")

        assert vacated["year"] == 2026
        assert "Mobilization consists of" in vacated["was"]
        assert history["1-09.7"]["vacant_now"] is True
        assert history["1-09.7"]["current"] is False

    def test_a_section_can_come_back_from_vacant(self):
        eds = editions(
            y2000={"2-01": section("2-01", "", vacant=True)},
            y2002={"2-01": section("2-01", "real text again")},
        )
        assert events_for(build(eds), "2-01") == [
            (2000, "introduced"),
            (2000, "vacated"),
            (2002, "restored"),
        ]

    def test_reports_a_revision_only_when_the_words_actually_change(self):
        eds = editions(
            y2000={"1-01": section("1-01", "the Contractor shall comply")},
            y2002={"1-01": section("1-01", "the  Contractor\nshall comply")},  # reflow only
            y2004={"1-01": section("1-01", "the Contractor must comply")},
        )
        assert events_for(build(eds), "1-01") == [(2000, "introduced"), (2004, "revised")]

    def test_a_new_section_is_introduced_not_reinstated(self):
        eds = editions(
            y2000={"1-01": section("1-01", "a")},
            y2026={"1-01": section("1-01", "a"), "1-05.7(2)": section("1-05.7(2)", "new")},
        )
        history = build(eds)
        assert events_for(history, "1-05.7(2)") == [(2026, "introduced")]
        assert history["1-05.7(2)"]["first_seen"] == 2026
