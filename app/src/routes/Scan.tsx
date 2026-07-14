import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DISCLAIMER } from "../config";
import { useIndex } from "../lib/indexContext";
import { type CitationStatus, type Finding, scanDraft, summarize } from "../lib/scanner";

const SAMPLE = `The Contractor shall provide Mobilization in accordance with Section 1-09.7.
Traffic control shall conform to Section 1-10 and the requirements of 1-07.1.
Payment for structure excavation is measured under 2-09.4 and 6-02.3(2).`;

/**
 * Phase 5: paste a draft special provision and check every section number it cites
 * against the current specifications. Runs entirely in the browser — the draft never
 * leaves the page, which is stated prominently because for pre-bid documents it's the
 * point, not a nicety.
 */
export function Scan() {
  const { sections, removed, stats } = useIndex();
  const [text, setText] = useState("");

  const findings = useMemo(
    () => (text.trim() ? scanDraft(text, sections, removed) : []),
    [text, sections, removed],
  );
  const totals = summarize(findings);
  const problems = findings.filter((f) => f.status !== "valid");

  return (
    <div className="space-y-6">
      <header className="max-w-reading">
        <h1 className="text-2xl font-semibold text-ink">Check a draft against the specifications</h1>
        <p className="mt-2 leading-7 text-muted">
          Paste a special provision, memo, or any text that cites section numbers. Every citation is
          checked against the {stats.latest} edition — flagging any that point to a{" "}
          <span className="text-vacated">vacant</span> section or a number that’s{" "}
          <span className="text-removed">no longer in the book</span>.
        </p>
        <p className="mt-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-muted">
          <strong className="text-ink">Your text never leaves your browser.</strong> This check runs
          entirely on your machine — nothing is uploaded or sent anywhere.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="draft" className="text-sm font-medium text-ink">
              Your draft
            </label>
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="text-xs text-accent hover:underline"
            >
              Try a sample
            </button>
          </div>
          <textarea
            id="draft"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text that references section numbers…"
            className="h-80 w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium text-ink">
            {text.trim() ? (
              <>
                {findings.length} citation{findings.length === 1 ? "" : "s"} found
                {problems.length > 0 && (
                  <span className="ml-2 text-removed">· {problems.length} to review</span>
                )}
              </>
            ) : (
              "Results"
            )}
          </h2>

          {!text.trim() && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-faint">
              Findings will appear here as you type.
            </p>
          )}

          {text.trim() && findings.length === 0 && (
            <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">
              No section numbers found in the text.
            </p>
          )}

          {findings.length > 0 && (
            <>
              <SummaryBar totals={totals} />
              <ul className="mt-3 space-y-2">
                {findings.map((f) => (
                  <FindingRow key={f.num} finding={f} />
                ))}
              </ul>
            </>
          )}
          {findings.length > 0 && (
            <p className="mt-4 text-xs leading-5 text-faint">{DISCLAIMER}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBar({ totals }: { totals: Record<CitationStatus, number> }) {
  const cells: { status: CitationStatus; label: string; cls: string }[] = [
    { status: "vacant", label: "vacant", cls: "text-vacated" },
    { status: "removed", label: "removed", cls: "text-removed" },
    { status: "unknown", label: "unrecognized", cls: "text-removed" },
    { status: "valid", label: "current", cls: "text-added" },
  ];
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-raised px-4 py-2 text-sm">
      {cells.map((c) => (
        <span key={c.status} className={totals[c.status] ? c.cls : "text-faint"}>
          <span className="font-semibold tabular-nums">{totals[c.status]}</span> {c.label}
        </span>
      ))}
    </div>
  );
}

function statusLabel(finding: Finding): string {
  switch (finding.status) {
    case "vacant":
      return "Vacant — citing a struck section";
    case "removed":
      return `Removed — last in the ${finding.lastSeen} edition`;
    case "unknown":
      return "Unrecognized — not found in any edition (check for a typo)";
    case "valid":
      return finding.title ? `Current — ${finding.title}` : "Current";
  }
}

const STATUS_STYLE: Record<CitationStatus, { ring: string; dot: string }> = {
  vacant: { ring: "border-vacated/40", dot: "bg-vacated" },
  removed: { ring: "border-removed/40", dot: "bg-removed" },
  unknown: { ring: "border-removed/40", dot: "bg-removed" },
  valid: { ring: "border-border", dot: "bg-added" },
};

function FindingRow({ finding }: { finding: Finding }) {
  const meta = STATUS_STYLE[finding.status];
  return (
    <li className={`flex items-baseline gap-3 rounded-lg border bg-surface px-3 py-2.5 ${meta.ring}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link to={`/section/${finding.num}`} className="font-mono text-sm font-semibold text-accent hover:underline">
            {finding.num}
          </Link>
          {finding.count > 1 && <span className="text-xs text-faint">×{finding.count}</span>}
        </div>
        <div className="text-xs text-muted">{statusLabel(finding)}</div>
      </div>
      <Link to={`/section/${finding.num}`} className="shrink-0 self-center text-xs text-accent hover:underline">
        history →
      </Link>
    </li>
  );
}
