import { describe, expect, it } from "vitest";

import { fuseRankings } from "./hybrid";

describe("fuseRankings", () => {
  it("returns the keyword order when it's the only ranking (graceful degradation)", () => {
    const fused = fuseRankings([{ source: "keyword", sections: ["1-01", "1-02", "1-03"] }]);
    expect(fused.map((f) => f.section)).toEqual(["1-01", "1-02", "1-03"]);
  });

  it("rewards a section both methods rank highly", () => {
    // "6-02.3" is top of keyword and second in semantic; nothing else is in both.
    const fused = fuseRankings([
      { source: "keyword", sections: ["6-02.3", "1-01", "9-03.1"] },
      { source: "semantic", sections: ["8-20.3", "6-02.3", "5-05.3"] },
    ]);
    expect(fused[0]?.section).toBe("6-02.3");
    expect(fused[0]?.sources.sort()).toEqual(["keyword", "semantic"]);
  });

  it("still surfaces a strong single-method hit", () => {
    const fused = fuseRankings([
      { source: "keyword", sections: ["1-01"] },
      { source: "semantic", sections: ["9-99"] },
    ]);
    expect(fused.map((f) => f.section).sort()).toEqual(["1-01", "9-99"]);
  });

  it("records which methods contributed to each item", () => {
    const fused = fuseRankings([
      { source: "keyword", sections: ["1-01"] },
      { source: "semantic", sections: ["1-01", "2-02"] },
    ]);
    const byNum = Object.fromEntries(fused.map((f) => [f.section, f.sources.sort()]));
    expect(byNum["1-01"]).toEqual(["keyword", "semantic"]);
    expect(byNum["2-02"]).toEqual(["semantic"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 50 }, (_, i) => `1-${String(i).padStart(2, "0")}`);
    expect(fuseRankings([{ source: "keyword", sections: many }], 10)).toHaveLength(10);
  });
});
