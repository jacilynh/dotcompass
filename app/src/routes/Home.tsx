import { Link } from "react-router-dom";

import { DEMO_SECTION } from "../config";
import { SearchBox } from "../components/SearchBox";
import { useIndex } from "../lib/indexContext";
import type { Stats } from "../types";

export function Home() {
  const { stats, divisions } = useIndex();

  return (
    <div className="space-y-14">
      <Hero stats={stats} />
      <StatBand stats={stats} />
      <DivisionGrid divisions={divisions} />
      <ScanPrompt latest={stats.latest} />
    </div>
  );
}

function ScanPrompt({ latest }: { latest: number }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div className="max-w-reading">
        <h2 className="text-lg font-semibold text-ink">Have a draft to check?</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Paste a special provision and every section number it cites is checked against the {latest}{" "}
          edition — flagging anything that points to a struck or removed section. It runs entirely in
          your browser; the text never leaves your machine.
        </p>
      </div>
      <Link
        to="/scan"
        className="mt-4 inline-block whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 sm:mt-0"
      >
        Check a draft →
      </Link>
    </section>
  );
}

function Hero({ stats }: { stats: Stats }) {
  return (
    <section className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-accent">
        WSDOT Standard Specifications · M 41-10
      </p>
      <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight text-ink sm:text-4xl">
        A specification section is not a fact. It’s a decision with a history.
      </h1>
      <p className="mx-auto mt-4 max-w-reading text-pretty leading-7 text-muted">
        This tool reads every edition of the Standard Specifications from {stats.earliest} to{" "}
        {stats.latest} and reconstructs what happened to each of the{" "}
        <strong className="text-ink">{stats.everPublished.toLocaleString()}</strong> sections ever
        published — when it was introduced, every time it was revised, and whether it’s still in the
        book today.
      </p>

      <div className="mx-auto mt-8 max-w-2xl">
        <SearchBox autoFocus />
      </div>

      <p className="mt-4 text-sm text-muted">
        Start with{" "}
        <Link to={`/section/${DEMO_SECTION}`} className="font-medium text-accent hover:underline">
          {DEMO_SECTION} Mobilization
        </Link>{" "}
        — introduced in {stats.earliest}, revised six times, and struck from the {stats.latest}{" "}
        edition. Any draft still citing it is stale, and no one was told.
      </p>
    </section>
  );
}

function StatBand({ stats }: { stats: Stats }) {
  const items = [
    { value: stats.everPublished, label: "sections ever published" },
    { value: stats.live, label: `live in ${stats.latest}` },
    { value: stats.sinceStart, label: `unchanged in number since ${stats.earliest}` },
    { value: stats.revisions, label: "revisions tracked" },
    { value: stats.vacant, label: `vacant in ${stats.latest}` },
    { value: stats.editions.length, label: "editions parsed" },
  ];
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-4 py-5 text-center">
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {it.value.toLocaleString()}
          </div>
          <div className="mt-1 text-xs leading-4 text-muted">{it.label}</div>
        </div>
      ))}
    </section>
  );
}

function DivisionGrid({ divisions }: { divisions: { n: number; title: string }[] }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-ink">Browse by division</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {divisions.map((d) => (
          <Link
            key={d.n}
            to={`/browse?division=${d.n}`}
            className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-accent">Div. {d.n}</span>
            </div>
            <div className="mt-1 text-sm leading-5 text-ink group-hover:text-accent">{d.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
