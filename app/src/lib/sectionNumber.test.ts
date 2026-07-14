import { describe, expect, it } from "vitest";

import { compareSectionNumbers, divisionOf, parseSectionNumber } from "./sectionNumber";

/**
 * These cases mirror tests/test_section_numbers.py on the Python side. The two
 * implementations must agree, because the pipeline sorts sections one way at build time
 * and the app re-sorts them the same way at run time — a mismatch would scramble the
 * navigation tree.
 */
describe("compareSectionNumbers", () => {
  const sorted = (nums: string[]) => [...nums].sort(compareSectionNumbers);

  it("orders a full section ladder", () => {
    const bookOrder = [
      "1-01",
      "1-01.1",
      "1-01.2",
      "1-01.2(1)",
      "1-01.2(2)",
      "1-02",
      "9-03.8",
      "9-03.8(2)",
      "9-35",
    ];
    expect(sorted(bookOrder)).toEqual(bookOrder);
  });

  it("sorts a parent before its own subsections", () => {
    expect(compareSectionNumbers("1-01", "1-01.1")).toBeLessThan(0);
    expect(compareSectionNumbers("9-03", "9-03.8")).toBeLessThan(0);
  });

  it("sorts numeric subparts numerically, not lexically", () => {
    expect(compareSectionNumbers("1-07.15(2)", "1-07.15(10)")).toBeLessThan(0);
    expect(compareSectionNumbers("1-2", "1-10")).toBeLessThan(0);
  });

  it("sorts lettered subparts after numeric ones", () => {
    expect(compareSectionNumbers("8-21.3(9)", "8-21.3(9)A")).toBeLessThan(0);
    expect(compareSectionNumbers("8-21.3(9)A", "8-21.3(9)B")).toBeLessThan(0);
  });

  it("is a total order (antisymmetric and reflexive)", () => {
    expect(compareSectionNumbers("6-02.3(2)", "6-02.3(2)")).toBe(0);
    expect(Math.sign(compareSectionNumbers("1-01", "1-02"))).toBe(
      -Math.sign(compareSectionNumbers("1-02", "1-01")),
    );
  });
});

describe("parseSectionNumber / divisionOf", () => {
  it("extracts the division", () => {
    expect(parseSectionNumber("9-03.8(2)").division).toBe(9);
    expect(divisionOf("1-07.1")).toBe(1);
  });
});
