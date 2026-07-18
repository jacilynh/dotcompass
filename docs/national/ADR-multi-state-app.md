# ADR: Multi-state app architecture

**Status:** Accepted (July 2026). **Supersedes** the two-option sketch in `ARCHITECTURE.md`
(“50-state switcher vs per-state deploys”).

## Context

The app was built for two states with a header dropdown. The 50-state buildout
(`AGENT_PLAYBOOK.md`) will produce many *built* states (local demos) but an unknown, slowly
growing number of *published* states, because publishing is gated per state on human reuse
clearance and most states assert copyright or are silent. A full-featured state (browse +
history + requirements + semantic) is ~19 MB of static data; a browse-only state ~4 MB. The
self-hosted semantic model (~44 MB) is shared across all states.

The naive readings — "one deploy with all 50 states' data" (~1 GB, impractical for a single
Cloudflare Pages deploy) or "50 subdomains" (50 projects, no unified experience) — both
over-solve the problem.

## Decision

**One app, one production site (dotcompass.dev), client-side state selection. The reuse gate
shards the deploy. The state registry is generated from the descriptors.**

1. **One app, one URL.** Not per-state subdomains or per-state Pages projects. One brand, one
   site, a state picker. Data is lazy-loaded per state from `data/<slug>/` (a visitor fetches
   only the active state's index + the sections they open), so adding states never slows a
   visitor and the model ships once.

2. **The reuse gate shards the deploy — the load-bearing insight.** The production build
   already includes only *cleared* states (`app/src/states.ts`: `import.meta.env.DEV ||
   !uncleared`). Because nearly every state is uncleared, the production live set stays small
   (Washington + whatever clears), so a single Pages deploy is never overloaded. Local/dev
   builds include *all* built states, on local disk, with no deploy limit. The playbook's two
   clocks — engineering vs. clearance — map exactly onto **local vs. production**. The
   feared 50-state monolith deploy never exists because clearance prevents it.

3. **The registry is generated, not hand-maintained.** `pipeline/build_app_states.py` reads
   every `StateDescriptor` and emits `app/src/states.generated.ts`; `states.ts` consumes it and
   applies the reuse filter. A state is added to the app by **writing its descriptor and
   running `make app-states`** — never by editing app code. This is what makes the app scale to
   N states as *configuration*. (Implemented; wired into `make publish`.)

4. **The picker scales by count.** The current dropdown is fine to ~7 states. Above that, swap
   in a searchable/grouped picker (a self-contained component change, no data/registry impact).
   Deferred until the built-and-visible set actually crosses that line — not built speculatively.

5. **Escape hatch, documented not built (YAGNI).** *If* the cleared/live set ever outgrows one
   comfortable Pages deploy (roughly >15–20 full-featured states, ~400 MB), move per-state data
   off the app deploy to Cloudflare **R2** (object storage, no deploy-size limit) or per-state
   deploys, by repointing each state's `dataBase` at a data origin. This is a localized change
   to one field's meaning, not a rewrite. We don't build it now because clearance is slow and
   the trigger may never fire.

6. **Multi-state Ask is a separate track.** The Worker is still WSDOT-corpus-specific. Making
   Ask multi-state (state-parameterized corpus + a Vectorize metadata filter, de-WSDOT-ified
   prompt) is `AGENT_PLAYBOOK.md` §7 track 1 — independent of this app-shell decision. Until it
   lands, non-WSDOT states have `ask=false` and the Ask tab is simply hidden for them.

## Consequences

- **Stage 3 is now config-driven:** write `pipeline/states/<name>.py`, run `build_state.py`
  (local) + `make app-states`, add the app `StateConfig` for free. No per-state app edits.
- **Production stays small and safe** by construction — the gate can't ship an uncleared state,
  and that's also what bounds the deploy.
- **Local demos are unbounded** — the whole 50-state fleet output lives and switches locally.
- **No new infrastructure now** (no R2, no extra Pages projects), with a known, cheap path if
  scale ever demands it.
