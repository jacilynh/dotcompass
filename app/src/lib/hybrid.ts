/**
 * Combine a keyword ranking and a semantic ranking into one hybrid ranking.
 *
 * Uses Reciprocal Rank Fusion: an item's score is the sum over each list it appears in of
 * 1 / (K + rank). RRF needs no score normalization between the two very different scoring
 * schemes (lexical overlap vs. cosine similarity), rewards items that both methods rank
 * highly, and still surfaces strong single-method hits. It is the standard way to merge
 * heterogeneous rankings, and it degrades cleanly: with only the keyword list present
 * (semantic still loading or unavailable), it simply returns the keyword order.
 */

export interface Ranking {
  source: string;
  sections: string[]; // section numbers, best first
}

export interface FusedItem {
  section: string;
  score: number;
  sources: string[]; // which methods contributed, e.g. ["keyword", "semantic"]
}

const RRF_K = 60; // the conventional constant; damps the weight of very deep ranks

export function fuseRankings(rankings: Ranking[], limit = 30): FusedItem[] {
  const scores = new Map<string, { score: number; sources: Set<string> }>();

  for (const { source, sections } of rankings) {
    sections.forEach((section, rank) => {
      const entry = scores.get(section) ?? { score: 0, sources: new Set() };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.sources.add(source);
      scores.set(section, entry);
    });
  }

  return [...scores.entries()]
    .map(([section, { score, sources }]) => ({ section, score, sources: [...sources] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
