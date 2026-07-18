import { describe, expect, it } from "vitest";

import { rerank } from "./rerank";
import type { ScoredChunk } from "./retrieval";

function chunk(cite: string, text: string, score: number): ScoredChunk {
  return { text, cite, ref: cite, source: "Test", sourceId: "M 0", page: 1, url: "", inApp: true, score, idx: 0 };
}

const chunks: ScoredChunk[] = [chunk("1-01.1", "alpha", 3), chunk("1-02.1", "bravo", 2)];

describe("rerank", () => {
  it("skips the model call (and its cost) when candidates already fit topK", async () => {
    // The client is never touched on this path, so passing none is safe.
    const res = await rerank(undefined as never, "any question", chunks, 5);
    expect(res.cost).toBe(0);
    expect(res.chunks).toEqual(chunks);
  });
});
