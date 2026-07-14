import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { DISCLAIMER, PUBLISHER, SITE_NAME } from "../config";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/browse", label: "Browse" },
  { to: "/scan", label: "Check a draft" },
  { to: "/how-it-was-built", label: "How it was built" },
  { to: "/about", label: "About" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-ink">{SITE_NAME}</span>
          <span className="hidden text-xs font-medium uppercase tracking-wider text-faint sm:inline">
            Unofficial
          </span>
        </NavLink>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  isActive ? "text-ink font-medium" : "text-muted hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
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
