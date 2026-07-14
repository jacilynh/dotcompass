# Contributing

Two kinds of contribution are equally welcome: improving this tool, and **taking it somewhere else.** The second is the point.

## Standards

The code is meant to be read by people learning from it, so the bar is higher than "it works."

- **Tests first.** New behavior arrives with a failing test that describes it. `make test` must stay green and fast (no network, no PDFs).
- **Comments explain *why*, never *what*.** The code already says what it does. A comment earns its place by recording a constraint the code cannot show — usually something that was learned the hard way. Compare:

  ```python
  # BAD — restates the code
  # Take the longest non-decreasing subsequence.

  # GOOD — records why the obvious approach is wrong
  # Greedy fails here: one stray table cell citing 9-35 from inside Division 1 is
  # accepted (it increases), and every real heading below 9-35 is then rejected —
  # which is the entire rest of the book.
  ```

- **Report accuracy honestly.** If extraction is 85% accurate, the docs say 85%. This project's entire premise is that it doesn't bluff. Silent truncation, unreported caps, and "should be fine" are bugs.
- `make lint` clean. `make fmt` will fix most of it.

## Running it

```bash
make test      # fast unit suite; no downloads
make history   # fetch 17 editions, parse, build the timeline
make test-all  # + the ~5min suite against the real PDFs
```

The PDFs are not vendored — they're WSDOT's to publish. Integration tests self-skip without them, so a fresh clone is green on `make test`.

## Pointing this at another agency's specs

Most public agencies publish a spec book the same way: a pile of annual PDFs, no history, no usable search, no way to know what changed between editions. If that's yours, most of this transfers.

**Start here:** [`pipeline/parse_any_edition.py`](pipeline/parse_any_edition.py). It is deliberately written to *infer* a document's layout rather than assume it, because WSDOT changed page size, heading font, and heading layout several times across 26 years. Read its docstring before changing anything — the traps it survives are not guessable from the code alone.

What you will likely need to change:

1. **`HEAD`** — the section-number pattern. WSDOT uses `1-07.1(2)A`. Yours won't.
2. **`sort_key`** — how those numbers order. This is load-bearing: heading detection rejects out-of-order numbers, so a wrong ordering silently discards real headings as if they were table cells. Test it first (see `tests/test_section_numbers.py`).
3. **The corpus list** in the `Makefile` — your editions and their URLs.

What you probably won't need to change, because it's already layout-agnostic: body-font inference, header/footer band detection, the body-start search, and the monotonic-order filter.

**If your PDFs are scanned images rather than born-digital, none of this works** — you need OCR first, and that's a different (harder) project. Check with `pymupdf`: if `page.get_text()` returns roughly nothing, you have images.

If you do fork it for another agency, open an issue and say so. A list of these would be worth more than any single one of them.
