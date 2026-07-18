"""Registry of the WSDOT manuals that feed Ask + Search, and how each is cited.

The tool is no longer just the Standard Specifications: Ask retrieves across the core
construction/engineering manuals a contractor or reviewer actually cites, and every answer
names the manual and page it came from. Each manual is a SOURCE; its chunks in the Ask corpus
carry this metadata (see pipeline/ingest_manual.py for the chunk shape).

Browse and the 26-year Section History stay Standard-Specs-only — they depend on that book's
stable numbering and annual editions. The other manuals are ingested as source-tagged retrieval
chunks (text for Ask/Search), not deeply parsed.

Reuse: these are WSDOT government publications, redistributed here as unofficial copies for
reference — the same posture under which the Standard Specifications are already published.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Manual:
    code: str  # short citation code, e.g. "CM"
    title: str  # "Construction Manual"
    m_number: str  # "M 41-01"
    url: str  # current full-document PDF (client appends #page=N)
    filename: str  # local file under corpus/manuals/
    kind: str = "text"  # "text" | "standard-specs" | "drawings-index"


# Source #1. Its Ask chunks are emitted by build_app_data.py from the rich section parse, but it
# shares this source identity so every citation names its manual like the rest.
STANDARD_SPECS = Manual(
    code="SS",
    title="Standard Specifications",
    m_number="M 41-10",
    url="https://www.wsdot.wa.gov/publications/manuals/fulltext/M41-10/SS2026.pdf",
    filename="",
    kind="standard-specs",
)

# The core construction/engineering set (scope confirmed with the owner). URLs are filled from
# the verified discovery pass; a blank url means "not yet located" and the manual is skipped.
_FT = "https://wsdot.wa.gov/publications/manuals/fulltext"

MANUALS = [
    Manual("CM", "Construction Manual", "M 41-01", f"{_FT}/M41-01/Construction.pdf", "M41-01.pdf"),
    Manual("TM", "Traffic Manual", "M 51-02", f"{_FT}/M51-02/traffic.pdf", "M51-02.pdf"),
    Manual("HM", "Hydraulics Manual", "M 23-03", f"{_FT}/M23-03/hydraulicsmanual.pdf", "M23-03.pdf"),
    Manual("MM", "Materials Manual", "M 46-01", f"{_FT}/M46-01/Materials.pdf", "M46-01.pdf"),
    Manual("LAG", "Local Agency Guidelines", "M 36-63", f"{_FT}/M36-63/LAG.pdf", "M36-63.pdf"),
    Manual("DM", "Design Manual", "M 22-01", f"{_FT}/M22-01/M22-0123Complete.pdf", "M22-01.pdf"),
    # Body-only variant — the full Highway Runoff PDF is ~234 MB with appendices.
    Manual("HRM", "Highway Runoff Manual", "M 31-16", f"{_FT}/M31-16/M31-16.05Complete.pdf", "M31-16.pdf"),
    Manual("GDM", "Geotechnical Design Manual", "M 46-03", f"{_FT}/M46-03/Geotech.pdf", "M46-03.pdf"),
    Manual(
        "AMD",
        "Standard Specifications Update Package",
        "M 41-10",
        "https://wsdot.wa.gov/publications/fulltext/projectdev/gspspdf/September2025updatepackage.pdf",
        "amendments.pdf",
    ),
]

MANUALS_BY_CODE = {m.code: m for m in [STANDARD_SPECS, *MANUALS]}

_LEAD_REF = re.compile(r"^\s*(\d+[-.]\d+[\w.()-]*)")


def cite_label(manual, ref, page):
    """The short label the model cites and the UI shows, e.g. "1-09.7" (Standard Specs) or
    "CM 5-3.2" / "DM p.1130" (other manuals — code-prefixed so labels never collide)."""
    if manual.kind == "standard-specs":
        return ref
    match = _LEAD_REF.match(ref or "")
    tail = match.group(1) if match else f"p.{page}"
    return f"{manual.code} {tail}"
