import { createContext, createElement, useContext, useState, type ReactNode } from "react";

/**
 * The states this build can serve, and which features each one supports.
 *
 * A state is a configuration, not a codebase (see docs/national/ARCHITECTURE.md). Each
 * entry says where its static data lives (`dataBase`) and which features its data can
 * back — history needs a multi-edition archive, requirements/ask/semantic need their own
 * generated files. A feature that a state can't support is hidden rather than shown broken.
 *
 * The active state is held in a module variable so the data layer (lib/api.ts) can read it
 * without threading it through every call, and mirrored into React state by StateProvider
 * so the UI re-renders on a switch. It persists in localStorage across reloads.
 */
export interface StateConfig {
  slug: string; // url-safe id and localStorage value
  name: string; // "Washington"
  dot: string; // "WSDOT"
  dataBase: string; // path under BASE_URL where this state's JSON lives, e.g. "data" or "data/nd"
  corpusLabel: string; // the eyebrow shown on Home
  edition: number; // latest edition year
  history: boolean; // section-history feature (needs a processed multi-edition archive)
  requirements: boolean; // requirements explorer (needs requirements/*.json)
  ask: boolean; // Ask-the-Specs (needs an ask corpus + the Worker)
  semantic: boolean; // semantic search (needs precomputed embeddings)
  demoSection?: string; // the worked example on Home, when history makes one meaningful
  uncleared?: boolean; // reuse terms not cleared — local demo only, never published
}

const WASHINGTON: StateConfig = {
  slug: "wa",
  name: "Washington",
  dot: "WSDOT",
  dataBase: "data",
  corpusLabel: "WSDOT Standard Specifications · M 41-10",
  edition: 2026,
  history: true,
  requirements: true,
  ask: true,
  semantic: true,
  demoSection: "1-09.7",
};

const NORTH_DAKOTA: StateConfig = {
  slug: "nd",
  name: "North Dakota",
  dot: "NDDOT",
  dataBase: "data/nd",
  corpusLabel: "NDDOT Standard Specifications for Road and Bridge Construction",
  edition: 2025,
  history: false, // single edition onboarded; AASHTO numbers aren't stable across editions
  requirements: false,
  ask: false,
  semantic: false,
  uncleared: true, // NDDOT reuse terms unstated — this state is a local demo only
};

// Uncleared states (reuse terms not cleared) appear only in a dev build — the local
// two-state demo — never in a production build. This ties the switcher's visibility to the
// reuse gate: a published site can only ever offer states whose text it is allowed to serve,
// so there is no broken "NDDOT" option on dotcompass.dev and no reason for its data to ship.
const ALL_STATES: StateConfig[] = [WASHINGTON, NORTH_DAKOTA];
export const STATES: StateConfig[] = ALL_STATES.filter(
  (s) => import.meta.env.DEV || !s.uncleared,
);

const STORAGE_KEY = "dotcompass.state";

function readInitialSlug(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STATES.some((s) => s.slug === saved)) return saved;
  } catch {
    // localStorage may be unavailable (private mode); fall through to the default.
  }
  return STATES[0]!.slug;
}

let activeSlug = readInitialSlug();

/** The active state — readable outside React (lib/api.ts uses it to pick the data base). */
export function getActiveState(): StateConfig {
  return STATES.find((s) => s.slug === activeSlug) ?? STATES[0]!;
}

interface StateContextValue {
  state: StateConfig;
  setSlug: (slug: string) => void;
}

const StateContext = createContext<StateContextValue | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState(activeSlug);
  // Keep the module variable in sync during render, before the child data layer reads it.
  activeSlug = slug;
  const state = STATES.find((s) => s.slug === slug) ?? STATES[0]!;

  const value: StateContextValue = {
    state,
    setSlug: (next) => {
      activeSlug = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Persistence is best-effort; the switch still works for this session.
      }
      setSlug(next);
    },
  };
  return createElement(StateContext.Provider, { value }, children);
}

export function useActiveState(): StateConfig {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useActiveState must be used within a StateProvider");
  return ctx.state;
}

export function useSetState(): (slug: string) => void {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useSetState must be used within a StateProvider");
  return ctx.setSlug;
}
