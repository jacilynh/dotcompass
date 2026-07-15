import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getDivisionRequirements } from "../lib/api";
import { useIndex } from "../lib/indexContext";
import { filterRequirements } from "../lib/requirements";
import { useAsync } from "../lib/useAsync";
import type { Requirement } from "../types";

/**
 * Phase 2: a filterable database of every obligation ("… shall …", "… must …") in the
 * current edition. Each entry is verbatim and links back to its section. Useful even with
 * the AI features switched off — the extraction is deterministic, so this is just a fast,
 * honest index of the book's requirements.
 */
export function Requirements() {
  const { divisions, requirements: meta } = useIndex();
  const [params, setParams] = useSearchParams();
  const division = Number(params.get("division")) || divisions[0]!.n;

  const [party, setParty] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const { data, loading } = useAsync(() => getDivisionRequirements(division), [division]);
  const all = data ?? [];
  const shown = useMemo(
    () => filterRequirements(all, { party, topics, query }),
    [all, party, topics, query],
  );

  const toggleTopic = (t: string) =>
    setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const activeTitle = divisions.find((d) => d.n === division)?.title ?? "";

  return (
    <div className="space-y-6">
      <header className="max-w-reading">
        <h1 className="text-2xl font-semibold text-ink">Requirements</h1>
        <p className="mt-2 leading-7 text-muted">
          Every “shall”, “must”, and “is required” statement in the current edition —{" "}
          <strong className="text-ink">{meta.total.toLocaleString()}</strong> in all — pulled out
          verbatim and tagged by who is bound and what it’s about. Nothing here is generated; each
          entry links back to its section.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <FilterGroup label="Division">
            <select
              value={division}
              onChange={(e) => setParams({ division: e.target.value })}
              className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-ink"
              aria-label="Division"
            >
              {divisions.map((d) => (
                <option key={d.n} value={d.n}>
                  {d.n} — {d.title} ({meta.perDivision[String(d.n)] ?? 0})
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Bound party">
            <Chip active={party === null} onClick={() => setParty(null)}>
              Any
            </Chip>
            {meta.parties.map((p) => (
              <Chip key={p} active={party === p} onClick={() => setParty(party === p ? null : p)}>
                {p} <Count n={meta.partyCounts[p]} />
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Topic">
            {meta.topics.map((t) => (
              <Chip key={t} active={topics.includes(t)} onClick={() => toggleTopic(t)}>
                {t} <Count n={meta.topicCounts[t]} />
              </Chip>
            ))}
          </FilterGroup>
        </aside>

        <section>
          <div className="mb-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search within these requirements…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
              aria-label="Search requirements"
            />
          </div>

          <p className="mb-3 text-sm text-muted">
            {loading
              ? "Loading…"
              : `${shown.length.toLocaleString()} of ${all.length.toLocaleString()} in Division ${division} — ${activeTitle}`}
          </p>

          <ul className="space-y-2">
            {shown.slice(0, 400).map((r, i) => (
              <RequirementRow key={`${r.section}-${i}`} req={r} />
            ))}
          </ul>
          {shown.length > 400 && (
            <p className="mt-4 text-center text-sm text-faint">
              Showing the first 400 of {shown.length.toLocaleString()}. Narrow the filters to see
              more.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function RequirementRow({ req }: { req: Requirement }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <p className="prose-spec text-[0.95rem] leading-6">{req.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Link
          to={`/section/${req.section}`}
          className="font-mono font-semibold text-accent hover:underline"
        >
          {req.section}
        </Link>
        <PartyTag party={req.party} />
        {req.topics.map((t) => (
          <span key={t} className="rounded bg-raised px-1.5 py-0.5 text-faint">
            {t}
          </span>
        ))}
      </div>
    </li>
  );
}

function PartyTag({ party }: { party: string }) {
  const cls =
    party === "Contractor"
      ? "bg-accent/15 text-accent"
      : party === "Work/Material"
        ? "bg-raised text-muted"
        : "bg-vacated/15 text-vacated";
  return <span className={`rounded px-1.5 py-0.5 font-medium ${cls}`}>{party}</span>;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">{label}</h2>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-border text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="opacity-60">({n.toLocaleString()})</span>;
}
