.PHONY: help corpus parse history test test-all lint fmt clean
.DEFAULT_GOAL := help

PY := uv run --quiet --with pymupdf --with pytest --with ruff python3
EDITIONS := 2000 2002 2004 2006 2008 2010 2012 2014 2016 2018 2020 2021 2022 2023 2024 2025 2026
BASE := https://www.wsdot.wa.gov/publications/manuals/fulltext/M41-10

help:  ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

corpus:  ## Download all 17 editions of M 41-10 (~90 MB, public, not vendored into git)
	@mkdir -p corpus
	@for y in $(EDITIONS); do \
		test -f corpus/SS$$y.pdf && continue; \
		printf 'fetching %s ... ' "$$y"; \
		curl -sfL -o corpus/SS$$y.pdf "$(BASE)/SS$$y.pdf" && echo ok || echo FAILED; \
	done

parse: corpus  ## Parse every edition into pipeline/out/eYYYY.json
	@mkdir -p pipeline/out
	@for y in $(EDITIONS); do \
		$(PY) pipeline/parse_any_edition.py corpus/SS$$y.pdf pipeline/out/e$$y.json; \
	done

history: parse  ## Build pipeline/history.json — every section's 26-year timeline
	$(PY) pipeline/build_history.py pipeline/out pipeline/history.json

test:  ## Run the fast unit suite (no PDFs needed)
	$(PY) -m pytest tests/ -m "not corpus"

test-all: corpus  ## Run everything, including the ~5min integration suite
	$(PY) -m pytest tests/

lint:  ## Check formatting and lint
	$(PY) -m ruff check .
	$(PY) -m ruff format --check .

fmt:  ## Auto-format
	$(PY) -m ruff format .
	$(PY) -m ruff check --fix .

clean:  ## Remove generated artifacts (keeps the downloaded corpus)
	rm -rf pipeline/out pipeline/history.json .pytest_cache **/__pycache__
