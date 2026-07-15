import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { searchSections } from "../components/SearchBox";
import { fuseRankings } from "../lib/hybrid";
import { useIndex } from "../lib/indexContext";
import { semanticSearch } from "../lib/semantic";

type SemanticState =
  | { status: "off" } // no query yet
  | { status: "loading" }
  | { status: "ready"; sections: string[] }
  | { status: "error" };

/**
 * Hybrid search results: instant keyword matching, blended with semantic matching once the
 * in-browser model finishes loading. Keyword results show immediately so the page is never
 * blank; semantic results merge in (and re-rank) when ready. If the model can't load, the
 * page stays keyword-only — semantic is an enhancement, not a dependency.
 */
export function Search() {
  const index = useIndex();
  const [params] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";

  const [semantic, setSemantic] = useState<SemanticState>({ status: "off" });

  // Keyword ranking is synchronous and instant.
  const keyword = useMemo(
    () => (query ? searchSections(index.sections, query).map((s) => s.num) : []),
    [index.sections, query],
  );

  // Semantic ranking loads the model lazily and resolves asynchronously.
  useEffect(() => {
    if (!query) {
      setSemantic({ status: "off" });
      return;
    }
    let live = true;
    setSemantic({ status: "loading" });
    semanticSearch(query, 20).then(
      (hits) => live && setSemantic({ status: "ready", sections: hits.map((h) => h.section) }),
      () => live && setSemantic({ status: "error" }),
    );
    return () => {
      live = false;
    };
  }, [query]);

  const titleOf = useMemo(
    () => new Map(index.sections.map((s) => [s.num, s.title])),
    [index.sections],
  );

  const fused = useMemo(() => {
    const rankings = [{ source: "keyword", sections: keyword }];
    if (semantic.status === "ready") rankings.push({ source: "semantic", sections: semantic.sections });
    return fuseRankings(rankings, 40);
  }, [keyword, semantic]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {query ? <>Results for “{query}”</> : "Search"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Keyword and meaning-based search, combined.
          {semantic.status === "loading" && " Loading the semantic model…"}
          {semantic.status === "error" && " (Semantic search is unavailable; showing keyword matches.)"}
        </p>
      </header>

      {query && fused.length === 0 && semantic.status !== "loading" && (
        <p className="rounded-lg border border-border p-6 text-center text-muted">
          No matches. Try different words, or{" "}
          <Link to="/browse" className="text-accent hover:underline">
            browse by division
          </Link>
          .
        </p>
      )}

      <ul className="space-y-2">
        {fused.map((item) => (
          <li key={item.section}>
            <Link
              to={`/section/${item.section}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent"
            >
              <span className="w-24 shrink-0 font-mono text-sm font-semibold text-accent">
                {item.section}
              </span>
              <span className="flex-1 truncate text-sm text-ink">
                {titleOf.get(item.section) || "Vacant"}
              </span>
              <SourceTags sources={item.sources} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceTags({ sources }: { sources: string[] }) {
  return (
    <span className="flex shrink-0 gap-1">
      {sources.includes("semantic") && (
        <span
          className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent"
          title="Matched by meaning"
        >
          semantic
        </span>
      )}
      {sources.includes("keyword") && (
        <span
          className="rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint"
          title="Matched by keyword"
        >
          keyword
        </span>
      )}
    </span>
  );
}
