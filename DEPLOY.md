# Deploying DOTcompass

The site is a static bundle (the app plus its generated JSON), so it deploys to
**Cloudflare Pages** by direct upload: build locally, upload `app/dist`. The optional
"Ask the Specs" feature is a separate **Cloudflare Worker** (see `worker/`). The domain
`dotcompass.dev` is registered on Cloudflare, so attaching it wires up DNS automatically.

## The reuse gate applies at publish time

`make publish` removes any locally-built **uncleared** state's data before bundling, so a
published site can only ever contain states whose text is cleared for redistribution
(currently WSDOT only). Uncleared states (North Dakota) are also excluded from a production
build's jurisdiction switcher automatically. They remain available in the **local** two-state
demo (`npm run dev`) after rebuilding them with `build_state.py --allow-uncleared`.

## One-time setup

```bash
cd app && npx wrangler login        # authenticates wrangler with your Cloudflare account
```

## Build and deploy the site

```bash
# From the repo root. Requires the parsed corpus (make corpus && make parse) the first time.
make embeddings     # optional: builds the semantic-search model/embeddings for parity
make deploy         # = make publish (build app/dist, cleared states only) + wrangler upload
```

`make deploy` runs `wrangler pages deploy dist --project-name=dotcompass`. The first run
offers to create the `dotcompass` Pages project; accept it. Each later run publishes a new
version to the same project.

Without `make embeddings`, the site still works — search falls back to keyword-only, which
is the app's designed graceful degradation.

## Attach the custom domain (one time)

In the Cloudflare dashboard: **Workers & Pages → dotcompass → Custom domains → Set up a
custom domain →** `dotcompass.dev` (repeat for `www.dotcompass.dev` if wanted). Because the
domain is already on Cloudflare, the required DNS record is created for you; HTTPS is
automatic.

## Optional: the "Ask the Specs" AI feature

The site works fully without this; Ask degrades to keyword search. To enable it:

```bash
cd worker
npx wrangler kv namespace create SPEND        # paste the id into wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY      # your Anthropic API key (never committed)
npx wrangler deploy                            # deploys the Worker; note its URL
```

`worker/wrangler.toml` already sets `ALLOWED_ORIGIN` and `CORPUS_URL` to `dotcompass.dev`.
Then rebuild the site with the Worker URL and redeploy:

```bash
cd app && VITE_ASK_URL="https://wsdot-ask-the-specs.<you>.workers.dev" npm run build
cd .. && make deploy      # or: cd app && npx wrangler pages deploy dist --project-name=dotcompass
```

The Worker has a hard monthly spend cap (`MONTHLY_CAP_USD` in `wrangler.toml`); past it, Ask
returns `capped` and the site falls back to keyword search until the next month.

## Redeploying

Re-run `make deploy`. To pick up new WSDOT editions first: `make corpus && make app-data`
(and `make embeddings` for semantic search), then `make deploy`.
