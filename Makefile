.PHONY: help corpus parse history requirements app-data manuals index-ask embeddings test test-all lint fmt clean publish deploy eval
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

parse: corpus  ## Parse every edition into pipeline/out/eYYYY.json (skips ones already parsed)
	@mkdir -p pipeline/out
	@for y in $(EDITIONS); do \
		test -f pipeline/out/e$$y.json && continue; \
		$(PY) pipeline/parse_any_edition.py corpus/SS$$y.pdf pipeline/out/e$$y.json; \
	done
	@# Re-parse after WSDOT republishes an edition (or to pick up parser changes) with:
	@#   make clean && make parse   — clean removes pipeline/out so all editions re-parse.

history: parse  ## Build pipeline/history.json — every section's 26-year timeline
	$(PY) pipeline/build_history.py pipeline/out pipeline/history.json

requirements: parse  ## Extract every "shall/must" requirement from the current edition
	$(PY) pipeline/extract_requirements.py pipeline/out/e2026.json pipeline/requirements.json

app-data: history requirements  ## Emit the web app's data (app/public/data/) from the pipeline
	$(PY) pipeline/build_app_data.py pipeline/out pipeline/history.json pipeline/requirements.json app/public/data

manuals: app-data  ## Download + ingest the extra WSDOT manuals into the Ask corpus (MANUALS="CM TM" to subset)
	$(PY) pipeline/build_manuals.py
	$(PY) pipeline/build_ask_corpus.py app/public/data pipeline/manuals-out

index-ask:  ## Embed the Ask corpus into Vectorize for semantic retrieval (needs: wrangler login). Re-run after the corpus changes.
	CF_ACCOUNT_ID="$$(cd worker && npx wrangler whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1)" \
	CF_API_TOKEN="$$(grep oauth_token $$HOME/Library/Preferences/.wrangler/config/default.toml | head -1 | sed 's/.*=[[:space:]]*\"//; s/\".*//')" \
	node pipeline/embed_corpus.mjs app/public/data/ask-corpus.json pipeline/ask-vectors.ndjson
	cd worker && npx wrangler vectorize insert dotcompass-ask --file=../pipeline/ask-vectors.ndjson

embeddings: app-data  ## Semantic-search embeddings + self-hosted model (needs: cd app && npm install)
	cd app && npm run embed

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

eval:  ## Measure Ask quality against worker/eval/cases.ts (ARGS=--rerank or --answer for more)
	cd worker && npm run --silent eval -- $(ARGS)

publish:  ## Build the deployable site (app/dist) — CLEARED states only, never uncleared text
	@# The reuse gate at publish time: remove any locally-built uncleared-state data so it
	@# can never end up in dist/. (Rebuild it for the local demo with build_state --allow-uncleared.)
	rm -rf app/public/data/nd
	$(MAKE) app-data
	@# Merge any already-ingested manuals (pipeline/manuals-out/) back into the Ask corpus that
	@# app-data just rewrote with Standard Specs only. No re-download; run `make manuals` to add more.
	$(PY) pipeline/build_ask_corpus.py app/public/data pipeline/manuals-out
	@# For semantic search parity, run `make embeddings` before this; it degrades to keyword
	@# search otherwise. build_state.py refuses uncleared states, so only public data is bundled.
	cd app && npm run build
	@echo "==> app/dist ready (cleared states only). Deploy with: make deploy"

deploy: publish  ## Publish app/dist to Cloudflare Pages production (needs: cd app && npx wrangler login)
	cd app && npx wrangler pages deploy dist --project-name=dotcompass --branch=main --commit-dirty=true

clean:  ## Remove generated artifacts (keeps the downloaded corpus)
	rm -rf pipeline/out pipeline/history.json .pytest_cache **/__pycache__
