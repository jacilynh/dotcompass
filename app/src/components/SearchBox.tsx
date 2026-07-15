import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { IndexEntry } from "../types";
import { useIndex } from "../lib/indexContext";

/**
 * Client-side keyword search over the section index (numbers + titles). It runs entirely
 * in the browser against the ~250 KB index, so it is instant and needs no server. A
 * section number typed in full jumps straight there.
 *
 * (Semantic search over the section text — precomputed embeddings + an in-browser
 * encoder — is planned but not yet wired in; this keyword pass is the honest v1.)
 */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const index = useIndex();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchSections(index.sections, query), [index.sections, query]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // An exact section number jumps straight there; anything else goes to the full
    // hybrid (keyword + semantic) results page.
    const exact = index.sections.find((s) => s.num.toLowerCase() === q.toLowerCase());
    if (exact) navigate(`/section/${exact.num}`);
    else navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="relative">
      <form onSubmit={onSubmit}>
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a section number or keyword — e.g. 1-09.7, or “mobilization”"
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink shadow-sm outline-none placeholder:text-faint focus:border-accent"
          aria-label="Search sections"
        />
      </form>

      {query.trim() && (
        <ul className="absolute z-10 mt-1 max-h-96 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-faint">No matches.</li>}
          {results.slice(0, 20).map((s) => (
            <li key={s.num}>
              <Link
                to={`/section/${s.num}`}
                className="flex items-baseline gap-3 px-4 py-2 hover:bg-raised"
                onClick={() => setQuery("")}
              >
                <span className="font-mono text-sm font-semibold text-accent">{s.num}</span>
                <span className="truncate text-sm text-ink">{s.title || "Vacant"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Rank: an exact section number wins, then a number prefix, then a title substring.
 * Exported so the ranking is unit-tested without rendering the component.
 */
export function searchSections(sections: IndexEntry[], raw: string): IndexEntry[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const scored: { s: IndexEntry; score: number }[] = [];
  for (const s of sections) {
    const num = s.num.toLowerCase();
    const title = s.title.toLowerCase();
    let score = 0;
    if (num === q) score = 100;
    else if (num.startsWith(q)) score = 60;
    else if (title.includes(q)) score = 30;
    else if (num.includes(q)) score = 20;
    if (score > 0) scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.s);
}
