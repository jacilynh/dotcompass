import { describe, expect, it } from "vitest";

import type { IndexEntry } from "../types";
import { searchSections } from "./SearchBox";

const entry = (num: string, title: string, vacant = false): IndexEntry => ({
  num,
  title,
  division: Number(num[0]),
  vacant,
});

const SECTIONS: IndexEntry[] = [
  entry("1-09.7", "Vacant", true),
  entry("1-09", "Measurement and Payment"),
  entry("1-09.1", "Measurement of Quantities"),
  entry("8-20.3(5)", "Mobilization considerations"),
  entry("1-07.1", "Laws to be Observed"),
];

describe("searchSections", () => {
  it("returns nothing for an empty query", () => {
    expect(searchSections(SECTIONS, "  ")).toEqual([]);
  });

  it("puts an exact section-number match first", () => {
    const [first] = searchSections(SECTIONS, "1-09.7");
    expect(first?.num).toBe("1-09.7");
  });

  it("ranks a number prefix above a title match", () => {
    const results = searchSections(SECTIONS, "1-09");
    // Every 1-09* number outranks the title hit on "considerations".
    expect(results[0]?.num.startsWith("1-09")).toBe(true);
  });

  it("finds sections by a word in the title", () => {
    const results = searchSections(SECTIONS, "mobilization");
    expect(results.map((r) => r.num)).toContain("8-20.3(5)");
  });

  it("is case-insensitive", () => {
    expect(searchSections(SECTIONS, "LAWS")[0]?.num).toBe("1-07.1");
  });
});
