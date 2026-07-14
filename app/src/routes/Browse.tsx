import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { SearchBox } from "../components/SearchBox";
import { VacantBadge } from "../components/badges";
import { useIndex } from "../lib/indexContext";
import { compareSectionNumbers } from "../lib/sectionNumber";

/**
 * The Spec Explorer: a division picker on the left, the sections of the chosen division
 * on the right. The selected division lives in the URL (?division=6) so the view is
 * shareable and the browser back button works.
 */
export function Browse() {
  const { divisions, sections } = useIndex();
  const [params, setParams] = useSearchParams();
  const active = Number(params.get("division")) || divisions[0]!.n;

  const inDivision = useMemo(
    () => sections.filter((s) => s.division === active).sort((a, b) => compareSectionNumbers(a.num, b.num)),
    [sections, active],
  );
  const activeTitle = divisions.find((d) => d.n === active)?.title ?? "";

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <SearchBox />
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Divisions" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="space-y-1">
            {divisions.map((d) => (
              <li key={d.n}>
                <button
                  type="button"
                  onClick={() => setParams({ division: String(d.n) })}
                  className={`flex w-full items-baseline gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    d.n === active
                      ? "bg-accent text-accent-ink"
                      : "text-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  <span className="font-mono text-xs font-semibold opacity-80">{d.n}</span>
                  <span className="leading-4">{d.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-faint">
            Division {active}
          </h2>
          <h1 className="mb-4 text-xl font-semibold text-ink">{activeTitle}</h1>
          <p className="mb-4 text-sm text-muted">{inDivision.length.toLocaleString()} sections</p>

          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {inDivision.map((s) => (
              <li key={s.num}>
                <Link
                  to={`/section/${s.num}`}
                  className="flex items-baseline gap-3 bg-surface px-4 py-2.5 hover:bg-raised"
                >
                  <span className="w-24 shrink-0 font-mono text-sm font-semibold text-accent">
                    {s.num}
                  </span>
                  <span className="flex-1 truncate text-sm text-ink">{s.title || "Vacant"}</span>
                  {s.vacant && <VacantBadge />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
