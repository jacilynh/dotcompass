"""Shared fixtures.

The pipeline scripts are executable tools rather than an installed package, so the
tests put `pipeline/` on the path instead of requiring an editable install. That keeps
`uv run python3 pipeline/parse_any_edition.py …` working exactly as documented — the
thing a reader will try first should not depend on having run `pip install -e .`.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "corpus"

sys.path.insert(0, str(ROOT / "pipeline"))


def pytest_collection_modifyitems(config, items):
    """Skip corpus-marked tests when the source PDFs aren't present."""
    if CORPUS.exists() and any(CORPUS.glob("SS*.pdf")):
        return
    skip = pytest.mark.skip(reason="no PDFs in corpus/ — run `make corpus`")
    for item in items:
        if "corpus" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def corpus_dir():
    return CORPUS


def line(text, *, font="Lato-Heavy", size=14, page=1, y=100.0):
    """Build one line of the shape `read_lines` produces, for testing in isolation."""
    first, _, rest = text.partition("  ")
    return {
        "page": page,
        "y": y,
        "first": first.strip(),
        "rest": rest.strip(),
        "full": text.strip(),
        "style": (font, size),
    }
