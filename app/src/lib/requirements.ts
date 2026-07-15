import type { Requirement } from "../types";

export interface RequirementFilter {
  party: string | null; // exactly this party, or any
  topics: string[]; // match any of these (empty = any)
  query: string; // case-insensitive substring of the text
}

/**
 * Filter a division's requirements by party, topic, and free text. Party is an exact
 * match (a requirement has one). Topics are OR'd — selecting Submittals and Testing shows
 * requirements in either category, which is what a facet filter is expected to do.
 */
export function filterRequirements(reqs: Requirement[], f: RequirementFilter): Requirement[] {
  const q = f.query.trim().toLowerCase();
  const topics = new Set(f.topics);
  return reqs.filter((r) => {
    if (f.party && r.party !== f.party) return false;
    if (topics.size > 0 && !r.topics.some((t) => topics.has(t))) return false;
    if (q && !r.text.toLowerCase().includes(q)) return false;
    return true;
  });
}
