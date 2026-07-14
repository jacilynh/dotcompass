import type { DiffOp } from "../types";

/**
 * Renders the precomputed word-level diff for one revision. Deletions are struck through
 * in the "removed" color, insertions underlined in the "added" color — the same visual
 * language a redline uses, which is what this audience already reads.
 */
export function DiffView({ ops }: { ops: DiffOp[] }) {
  if (ops.length === 0) {
    return <p className="text-sm text-faint">Formatting only — no wording changed.</p>;
  }
  return (
    <div className="space-y-2 font-serif text-sm leading-6">
      {ops.map((op, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2">
          {op.old && (
            <span className="text-removed line-through decoration-removed/60">{op.old}</span>
          )}
          {op.new && (
            <span className="text-added underline decoration-added/50 underline-offset-2">
              {op.new}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
