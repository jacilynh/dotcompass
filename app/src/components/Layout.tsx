import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { DISCLAIMER, PUBLISHER, SITE_NAME } from "../config";
import { STATES, useActiveState, useSetState, type StateConfig } from "../states";
import { ThemeToggle } from "./ThemeToggle";

/** The nav links available for a state, hiding features its data can't support. */
function navFor(state: StateConfig) {
  return [
    { to: "/", label: "Home", end: true },
    ...(state.ask ? [{ to: "/ask", label: "Ask" }] : []),
    { to: "/browse", label: "Browse" },
    ...(state.requirements ? [{ to: "/requirements", label: "Requirements" }] : []),
    { to: "/scan", label: "Check a draft" },
    { to: "/how-it-was-built", label: "How it was built" },
    { to: "/about", label: "About" },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const state = useActiveState();
  const nav = navFor(state);

  // Close the mobile menu whenever navigation happens.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-ink">{SITE_NAME}</span>
          <span className="hidden text-xs font-medium uppercase tracking-wider text-faint sm:inline">
            Unofficial
          </span>
        </NavLink>

        {STATES.length > 1 && <StateSwitcher />}

        {/* Desktop: the full nav row, shown only at widths where it fits. */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <ThemeToggle />
        </nav>

        {/* Mobile: theme toggle + a button that opens the links below the header. */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md border border-border bg-raised px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? "✕ Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="border-t border-border bg-surface px-4 py-2 lg:hidden" aria-label="Main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-raised font-medium text-ink"
                    : "text-muted hover:bg-raised hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function StateSwitcher() {
  const state = useActiveState();
  const setSlug = useSetState();
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="state-switcher">
        Jurisdiction
      </label>
      <select
        id="state-switcher"
        value={state.slug}
        onChange={(e) => setSlug(e.target.value)}
        className="rounded-md border border-border bg-raised px-2 py-1 text-xs font-medium text-ink outline-none focus:border-accent"
        title="Switch jurisdiction"
      >
        {STATES.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.dot}
          </option>
        ))}
      </select>
      {state.uncleared && (
        <span
          className="hidden rounded bg-vacated/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-vacated sm:inline"
          title="Reuse terms unstated — local demo only, not published"
        >
          Local demo
        </span>
      )}
    </div>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-md px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? "font-medium text-ink" : "text-muted hover:text-ink"
  }`;
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm sm:px-6">
        <p className="text-muted">
          A free tool from <span className="font-medium text-ink">{PUBLISHER}</span>.
        </p>
        <p className="mt-1 max-w-reading text-xs leading-5 text-faint">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
