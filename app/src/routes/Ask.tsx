import { useState } from "react";
import { Link } from "react-router-dom";

import { DISCLAIMER } from "../config";
import { FeatureUnavailable } from "../components/FeatureUnavailable";
import { searchSections } from "../components/SearchBox";
import { type AnswerSegment, ASK_URL, type AskResult, askWorker, splitCitations } from "../lib/ask";
import { useIndex } from "../lib/indexContext";
import { useActiveState } from "../states";
import type { IndexEntry } from "../types";

/**
 * Phase 6: ask a plain-English question and get an answer grounded in the specifications,
 * with every claim cited to a section you can click through and verify.
 *
 * The AI answer comes from an optional Cloudflare Worker (see worker/). When it isn't
 * configured, or it has hit its monthly spend cap, the page falls back to keyword search
 * over the section index — so the feature always returns something useful, and the answer
 * is never ungrounded.
 */
export function Ask() {
  const index = useIndex();
  const state = useActiveState();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [matches, setMatches] = useState<IndexEntry[]>([]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setMatches(searchSections(index.sections, q).slice(0, 8));
    setResult(await askWorker(q));
    setBusy(false);
  }

  if (!state.ask) {
    return <FeatureUnavailable feature="Ask the specifications" stateName={state.name} />;
  }

  const answered = result?.kind === "answer";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Ask the specifications</h1>
        <p className="mt-2 leading-7 text-muted">
          Ask a question in plain English. The answer is drawn only from the {index.stats.latest}{" "}
          edition, and every point is cited to a section you can open and check. It won’t guess — if
          the answer isn’t in the specifications, it says so.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What does mobilization payment cover, and when is it paid?"
          rows={2}
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-ink outline-none placeholder:text-faint focus:border-accent"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>

      {result && (
        <section className="space-y-4">
          {answered && <AnswerCard result={result} />}
          {result.kind === "capped" && (
            <Notice>
              Live answers are paused for this month (the free service reached its spending cap).
              Here are the sections most relevant to your question.
            </Notice>
          )}
          {result.kind === "unavailable" && (
            <Notice>
              {ASK_URL
                ? "The answer service is unavailable right now. Here are the most relevant sections."
                : "Live AI answers require the optional Ask-the-Specs service, which isn’t connected to this site. Here are the most relevant sections instead."}
            </Notice>
          )}

          {(!answered || matches.length > 0) && <RelevantSections matches={matches} />}

          <p className="text-xs leading-5 text-faint">{DISCLAIMER}</p>
        </section>
      )}
    </div>
  );
}

function AnswerCard({ result }: { result: Extract<AskResult, { kind: "answer" }> }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {result.confidence && (
        <div className="mb-3 flex justify-end">
          <ConfidenceBadge level={result.confidence} />
        </div>
      )}
      <p className="prose-spec whitespace-pre-wrap leading-7">
        {splitCitations(result.answer).map((seg, i) => (
          <Segment key={i} seg={seg} />
        ))}
      </p>

      {result.caveats.length > 0 && (
        <div className="mt-4 rounded-lg border border-vacated/30 bg-vacated/5 p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-vacated">Caveats</span>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
            {result.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {result.citations.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wider text-faint">Sources</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {result.citations.map((num) => (
              <Link
                key={num}
                to={`/section/${num}`}
                className="rounded bg-raised px-2 py-0.5 font-mono text-xs text-accent hover:underline"
              >
                {num}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    high: "bg-accent/15 text-accent",
    medium: "bg-raised text-muted",
    low: "bg-vacated/15 text-vacated",
  } as const;
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[level]}`}
      title="How well the retrieved specification sections support this answer"
    >
      {level} confidence
    </span>
  );
}

function Segment({ seg }: { seg: AnswerSegment }) {
  if ("cite" in seg) {
    return (
      <Link to={`/section/${seg.cite}`} className="font-mono text-accent hover:underline">
        [{seg.cite}]
      </Link>
    );
  }
  return <>{seg.text}</>;
}

function RelevantSections({ matches }: { matches: IndexEntry[] }) {
  if (matches.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-faint">
        Relevant sections
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {matches.map((s) => (
          <li key={s.num}>
            <Link
              to={`/section/${s.num}`}
              className="flex items-baseline gap-3 bg-surface px-4 py-2.5 hover:bg-raised"
            >
              <span className="w-24 shrink-0 font-mono text-sm font-semibold text-accent">
                {s.num}
              </span>
              <span className="flex-1 truncate text-sm text-ink">{s.title || "Vacant"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-vacated/30 bg-vacated/5 p-3 text-sm text-muted">
      {children}
    </div>
  );
}
