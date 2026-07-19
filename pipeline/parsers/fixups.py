"""Per-state text fix-ups for broken PDF text layers, applied span-by-span during parsing.

A fix-up is a `str -> str` that a state descriptor hands to the engine via
`parse(..., text_fixup=)` to repair extracted text before the parser sees it. Most states
need none; this is for the occasional PDF whose embedded font ships a broken ToUnicode map.
"""


def deshift_indot(text):
    """INDOT's 2026 spec book has a scattered subset of spans (~0.2%) whose embedded font
    maps glyphs 29 codepoints too low, so the extracted text is control-char gibberish -
    "416.07 Equipment" comes out as "\\x17\\x14\\x19\\x11\\x13\\x1a\\x03(TXLSPHQW". Those runs
    are recognizable because normal text never contains a control character (ord 1-31); when
    one does, the whole run is shifted, so shift its ASCII back up by 29. Non-ASCII symbols
    (a genuine "less than or equal" glyph, ord >= 128) are left as-is - they are not part of
    the offset subset. A span with no control character is returned unchanged.
    """
    if not any(0 < ord(char) < 32 and char not in "\t\n\r" for char in text):
        return text
    return "".join(chr(ord(char) + 29) if ord(char) < 128 else char for char in text)
