"""Requirement extraction: sentence splitting, obligation detection, party, topics.

The requirements are verbatim, so the risk isn't wrong text — it's wrong *classification*
(attributing a duty to the wrong party) or bad sentence boundaries. These cases pin the
behavior on real WSDOT phrasings, including the passive constructions that make party
attribution ambiguous.
"""

import pytest
from extract_requirements import (
    classify_party,
    extract_from_section,
    is_requirement,
    split_sentences,
    tag_topics,
)


class TestSplitSentences:
    def test_splits_on_sentence_boundaries(self):
        text = "The Contractor shall comply. The Engineer will inspect the Work."
        assert split_sentences(text) == [
            "The Contractor shall comply.",
            "The Engineer will inspect the Work.",
        ]

    def test_does_not_split_inside_a_section_reference(self):
        # The period in 1-07.1 is followed by a digit, not a new sentence.
        text = "Comply with Section 1-07.1 as directed by the Engineer."
        assert split_sentences(text) == [
            "Comply with Section 1-07.1 as directed by the Engineer."
        ]

    def test_does_not_split_after_a_known_abbreviation(self):
        text = "Material retained on the No. 4 sieve shall be discarded."
        assert split_sentences(text) == [
            "Material retained on the No. 4 sieve shall be discarded."
        ]

    def test_collapses_the_line_wrapping_from_the_pdf(self):
        assert split_sentences("shall be\nplaced in\nlifts.") == ["shall be placed in lifts."]


class TestIsRequirement:
    @pytest.mark.parametrize(
        ("sentence", "modal"),
        [
            ("The Contractor shall submit a plan.", "shall"),
            ("Backfill must be compacted.", "must"),
            ("A bid bond is required for all proposals.", "required"),
        ],
    )
    def test_detects_obligation_words(self, sentence, modal):
        assert is_requirement(sentence) == modal

    def test_ignores_a_sentence_with_no_obligation(self):
        # "will" is the Agency's own action, deliberately not treated as an obligation.
        assert is_requirement("The Contracting Agency will provide the form.") is None


class TestClassifyParty:
    def test_attributes_a_duty_to_the_named_actor(self):
        assert classify_party("The Contractor shall submit a plan.") == "Contractor"
        assert classify_party("The Engineer shall determine the quantity.") == "Engineer"
        assert (
            classify_party("The Contracting Agency shall provide access.")
            == "Contracting Agency"
        )

    def test_matches_contracting_agency_before_the_bare_engineer(self):
        # "Contracting Agency" must not be mis-split or lose to a later "Engineer".
        s = "The Contracting Agency shall notify the Engineer of the change."
        assert classify_party(s) == "Contracting Agency"

    def test_takes_the_actor_nearest_the_obligation(self):
        s = "After the Engineer reviews it, the Contractor shall proceed."
        assert classify_party(s) == "Contractor"

    def test_a_passive_requirement_has_no_named_party(self):
        assert classify_party("Backfill shall be compacted to 95 percent.") == "Work/Material"

    def test_a_possessive_actor_is_not_the_bound_party(self):
        # "At the Contractor's options, the posts shall be treated" is a spec on the
        # posts, not a Contractor duty — the possessive must not claim it.
        s = "At the Contractor\u2019s option, timber posts shall be treated Douglas Fir."
        assert classify_party(s) == "Work/Material"
        assert (
            classify_party("Follow the Engineer's orders as posted shall apply.")
            == "Work/Material"
        )


class TestTagTopics:
    def test_tags_multiple_topics(self):
        tags = tag_topics("The Contractor shall submit test results for the concrete.")
        assert "Submittals" in tags
        assert "Testing & Inspection" in tags
        assert "Materials" in tags

    def test_untagged_when_nothing_matches(self):
        assert tag_topics("The Contractor shall be responsible for the Work.") == []


class TestExtractFromSection:
    def test_pulls_only_obligation_sentences_and_attaches_metadata(self):
        text = (
            "This section covers mobilization. "
            "The Contractor shall submit a schedule within 10 days. "
            "Payment will be made at the lump sum price."  # "will" -> not an obligation
        )
        found = extract_from_section("1-09.7", text)
        assert len(found) == 1
        req = found[0]
        assert req["section"] == "1-09.7"
        assert req["division"] == 1
        assert req["party"] == "Contractor"
        assert req["modal"] == "shall"
        assert "Submittals" in req["topics"]

    def test_skips_headings_and_stubs(self):
        assert extract_from_section("2-01", "Vacant") == []
