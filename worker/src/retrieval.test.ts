import { describe, expect, it } from "vitest";

import { type Chunk, prepare, retrieve, tokenize } from "./retrieval";

/** Minimal chunk for retrieval tests — only `text` drives scoring; `cite` identifies the hit. */
function chunk(cite: string, text: string): Chunk {
  return { text, cite, ref: cite, source: "Test", sourceId: "M 0", page: 1, url: "", inApp: true };
}

const CORPUS = [
  chunk("1-09.7", "Mobilization consists of preconstruction expenses and the cost of moving equipment."),
  chunk("1-07.1", "The Contractor shall comply with all Federal, State, and local laws."),
  chunk("8-20.3", "Traffic signal systems shall be installed as shown in the Plans."),
  chunk("9-03.1", "Fine aggregate for concrete shall be manufactured from ledge rock."),
];

describe("tokenize", () => {
  it("lowercases, drops stopwords and short tokens", () => {
    expect(tokenize("The Contractor shall comply with laws")).toEqual([
      "contractor",
      "comply",
      "laws",
    ]);
  });
});

describe("retrieve", () => {
  const prepared = prepare(CORPUS);

  it("finds the section that matches the question's terms", () => {
    const hits = retrieve(prepared, "what does mobilization cost include?", 3);
    expect(hits[0]?.cite).toBe("1-09.7");
  });

  it("ranks by how many distinct query terms match", () => {
    const hits = retrieve(prepared, "traffic signal installation", 4);
    expect(hits[0]?.cite).toBe("8-20.3");
  });

  it("returns nothing when no meaningful term matches", () => {
    // Only stopwords and unrelated words -> empty, which the caller reads as "not found".
    expect(retrieve(prepared, "the and of with", 5)).toEqual([]);
    expect(retrieve(prepared, "helicopter avionics telemetry", 5)).toEqual([]);
  });

  it("respects the k limit", () => {
    const hits = retrieve(prepared, "shall concrete aggregate signal laws", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("weights a rare term above a common one", () => {
    // "contractor" appears in three chunks (common, low weight); "material" in one (rare,
    // high weight). A chunk matching only the rare term must outrank one matching only the
    // common term.
    const idf = prepare([
      chunk("1-01", "the contractor performs the work"),
      chunk("1-02", "the contractor submits the forms"),
      chunk("1-03", "the contractor is responsible"),
      chunk("9-01", "material sampling procedures"),
    ]);
    const hits = retrieve(idf, "contractor material", 4);
    expect(hits[0]?.cite).toBe("9-01");
  });
});
