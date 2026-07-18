import { describe, expect, it } from "vitest";

import type { ScoredChunk } from "./retrieval";
import { fuse } from "./semantic";

function chunk(idx: number, cite: string, score: number): ScoredChunk {
  return { text: cite, cite, ref: cite, source: "Test", sourceId: "M 0", page: 1, url: "", inApp: true, score, idx };
}

describe("fuse (reciprocal rank fusion)", () => {
  it("ranks a chunk that appears in both lists above ones in only one", () => {
    const lexical = [chunk(1, "A", 9), chunk(2, "B", 8), chunk(3, "C", 7)];
    const semantic = [chunk(3, "C", 0.9), chunk(1, "A", 0.8), chunk(9, "Z", 0.7)];
    // A is #1 lexical + #2 semantic; C is #3 lexical + #1 semantic — both beat singletons.
    const fused = fuse([lexical, semantic], 10);
    const order = fused.map((c) => c.cite);
    expect(order.slice(0, 2).sort()).toEqual(["A", "C"]);
    expect(order).toContain("Z"); // still included, just ranked lower
  });

  it("deduplicates by chunk position and respects the limit", () => {
    const a = [chunk(1, "A", 1), chunk(2, "B", 1)];
    const b = [chunk(1, "A", 1), chunk(3, "C", 1)];
    const fused = fuse([a, b], 2);
    expect(fused.length).toBe(2);
    expect(new Set(fused.map((c) => c.idx)).size).toBe(2); // no dup positions
  });
});
