import { describe, expect, it } from "vitest";

import { buildUserMessage, citedLabels, estimateCostUsd, validateQuestion } from "./rag";
import type { ScoredChunk } from "./retrieval";

function chunk(cite: string, text: string, over: Partial<ScoredChunk> = {}): ScoredChunk {
  return {
    text,
    cite,
    ref: cite,
    source: "Standard Specifications",
    sourceId: "M 41-10",
    page: 1,
    url: "",
    inApp: true,
    score: 2,
    idx: 0,
    ...over,
  };
}

describe("validateQuestion", () => {
  it("accepts a normal question", () => {
    expect(validateQuestion("What is mobilization?").ok).toBe(true);
  });

  it("rejects non-strings, empties, and document-sized input", () => {
    expect(validateQuestion(42).ok).toBe(false);
    expect(validateQuestion("  ").ok).toBe(false);
    expect(validateQuestion("x".repeat(501)).ok).toBe(false);
  });
});

describe("buildUserMessage", () => {
  it("numbers the excerpts and tags each with its source", () => {
    const msg = buildUserMessage("What is mobilization?", [
      chunk("1-09.7", "Mobilization consists of preconstruction expenses."),
      chunk("CM p.363", "The Material Transfer Device is inspected before use.", {
        source: "Construction Manual",
        sourceId: "M 41-01",
        page: 363,
        inApp: false,
      }),
    ]);
    expect(msg).toContain("Question: What is mobilization?");
    expect(msg).toContain("[1] Standard Specifications (M 41-10), section 1-09.7");
    expect(msg).toContain("[2] Construction Manual (M 41-01), p.363");
  });
});

describe("citedLabels", () => {
  it("returns only the excerpt numbers that were actually supplied", () => {
    const answer = "Mobilization is defined in [1]; see also [2], not [9].";
    expect(citedLabels(answer, ["1", "2", "3"])).toEqual(["1", "2"]);
  });

  it("deduplicates repeated citations", () => {
    expect(citedLabels("[2] and again [2]", ["1", "2"])).toEqual(["2"]);
  });

  it("is empty when the model cited nothing supplied", () => {
    expect(citedLabels("I could not find that.", ["1"])).toEqual([]);
  });
});

describe("estimateCostUsd", () => {
  it("prices Haiku 4.5 at $1/MTok in and $5/MTok out", () => {
    // 10k input + 1k output = 10000*1e-6 + 1000*5e-6 = 0.01 + 0.005 = 0.015
    expect(estimateCostUsd(10_000, 1_000)).toBeCloseTo(0.015, 6);
  });

  it("is zero for no usage", () => {
    expect(estimateCostUsd(0, 0)).toBe(0);
  });
});
