/**
 * Ordering and structure for WSDOT section numbers (1-01, 1-01.2, 9-03.8(2), 9-35).
 *
 * This mirrors `sort_key` in pipeline/parse_any_edition.py, and for the same reason:
 * the book's order is not string order. "1-2" must precede "1-10", and a bare "1-01"
 * must precede its own subsection "1-01.1". The nav tree, the section list, and
 * next/previous navigation all depend on getting this right.
 */

export interface ParsedNumber {
  division: number;
  /** Comparable key: numeric components stay numbers so 2 sorts before 10. */
  key: (number | string)[];
}

const PART = /\d+|[A-Za-z]+/g;

export function parseSectionNumber(num: string): ParsedNumber {
  const dash = num.indexOf("-");
  const division = Number(num.slice(0, dash));
  const rest = num.slice(dash + 1);

  // A bare section (1-01) must sort below its children (1-01.1), so the decimal slot
  // defaults to -1 rather than 0 — matching the Python parser's key.
  const key: (number | string)[] = [];
  const tokens = rest.match(PART) ?? [];
  for (const token of tokens) {
    // Digits compare numerically; a trailing letter (…(2)A) compares as a string but
    // is prefixed so it always sorts after any numeric component at its position.
    key.push(/^\d+$/.test(token) ? Number(token) : `~${token}`);
  }
  return { division, key };
}

/** Compare two section numbers in book order. Suitable for Array.prototype.sort. */
export function compareSectionNumbers(a: string, b: string): number {
  const pa = parseSectionNumber(a);
  const pb = parseSectionNumber(b);
  if (pa.division !== pb.division) return pa.division - pb.division;

  const len = Math.max(pa.key.length, pb.key.length);
  for (let i = 0; i < len; i++) {
    const x = pa.key[i];
    const y = pb.key[i];
    // A shorter number (the parent) sorts before a longer one sharing its prefix.
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else {
      const xs = String(x);
      const ys = String(y);
      if (xs !== ys) return xs < ys ? -1 : 1;
    }
  }
  return 0;
}

/** The division a section belongs to, e.g. "9-03.8(2)" -> 9. */
export function divisionOf(num: string): number {
  return Number(num[0]);
}
