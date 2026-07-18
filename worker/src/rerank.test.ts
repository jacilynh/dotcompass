import { describe, expect, it } from "vitest";

import { rerank } from "./rerank";
import type { ScoredChunk } from "./retrieval";

const chunks: ScoredChunk[] = [
  { section: "1-01.1", text: "alpha", score: 3 },
  { section: "1-02.1", text: "bravo", score: 2 },
];

describe("rerank", () => {
  it("skips the model call (and its cost) when candidates already fit topK", async () => {
    // The client is never touched on this path, so passing none is safe.
    const res = await rerank(undefined as never, "any question", chunks, 5);
    expect(res.cost).toBe(0);
    expect(res.chunks).toEqual(chunks);
  });
});
