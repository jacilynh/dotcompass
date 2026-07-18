"""A state's documents and the terms on which we may use them.

Where a `SpecProfile` (parsers/) says HOW to read a numbering scheme, a `StateDescriptor`
says WHICH documents a state publishes, which scheme they use, whether the section-history
feature applies, and — the load-bearing part — whether the text may be redistributed.

The reuse status is a build gate, not a label. `may_publish_text` is False for any state
whose terms are not cleared, and `build_state.py` refuses to emit body text in that case
unless an explicit local-development override is passed. Combined with `corpus/` being
git-ignored, an uncleared state's text can neither be committed nor published by accident.
"""

from dataclasses import dataclass

# Reuse status, taken from the per-state survey (docs/national/catalog.json). Only PUBLIC
# clears a state's full text for redistribution; everything else is treated as not-cleared.
REUSE_PUBLIC = "public"
REUSE_UNSTATED = "unstated"
REUSE_RESERVED = "all_rights_reserved"
_REUSE_VALUES = (REUSE_PUBLIC, REUSE_UNSTATED, REUSE_RESERVED)


@dataclass(frozen=True)
class Division:
    """A top-level grouping in a state's book.

    `title` must be what the book itself calls the division. When a book groups sections by
    hundred-series number but prints no division names (NDDOT does this), use an honest
    numeric label rather than inventing an AASHTO title the book never published.
    """

    id: int
    title: str


@dataclass(frozen=True)
class StateDescriptor:
    slug: str  # short url-safe id, e.g. "wa", "nd"
    state: str  # "Washington"
    dot: str  # "WSDOT"
    profile: str  # SpecProfile cluster id, resolved via parsers.registry
    edition_model: str  # "annual" | "biennial" | "periodic" | "overlay" | "current_only"
    editions: tuple  # ((year, filename-under-corpus/<slug>/), ...)
    history: bool  # does the section-history feature apply to this state?
    reuse: str  # one of the REUSE_* values
    divisions: tuple  # (Division, ...)
    source_url: str  # where the book was obtained (attribution / re-verification)
    source_note: str  # short provenance line shown in the UI
    # App-facing display + feature flags. These drive the generated app registry
    # (pipeline/build_app_states.py -> app/src/states.generated.ts), so the app never
    # hand-maintains a per-state list — a state is added by writing this descriptor.
    requirements: bool = False  # requirements explorer (needs requirements/*.json)
    ask: bool = False  # Ask-the-Specs (needs an ask corpus + the Worker)
    semantic: bool = False  # semantic search (needs precomputed embeddings)
    corpus_label: str = ""  # Home eyebrow; falls back to "<DOT> Standard Specifications"
    demo_section: str | None = None  # worked-example section on Home (history states only)

    def __post_init__(self):
        if self.reuse not in _REUSE_VALUES:
            raise ValueError(f"{self.slug}: unknown reuse status {self.reuse!r}")
        if not self.editions:
            raise ValueError(f"{self.slug}: at least one edition is required")

    @property
    def latest(self):
        """The most recent edition year."""
        return max(year for year, _ in self.editions)

    @property
    def spec_profile(self):
        """The SpecProfile for this state's numbering scheme."""
        from parsers.registry import get_profile

        return get_profile(self.profile)

    @property
    def may_publish_text(self):
        """Whether this state's full text is cleared for redistribution — the reuse gate.

        A publishing build must refuse to emit body text when this is False. Local
        development can override it explicitly (`build_state.py --allow-uncleared`).
        """
        return self.reuse == REUSE_PUBLIC

    def division_title(self, division_id):
        """The published title for a division id, or its number if the state names none."""
        for division in self.divisions:
            if division.id == division_id:
                return division.title
        return str(division_id)
