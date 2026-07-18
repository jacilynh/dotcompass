import { describe, expect, it } from "vitest";

import { type Citation, splitCitations } from "./ask";

function cite(id: number, label: string, over: Partial<Citation> = {}): Citation {
  return {
    id,
    cite: label,
    ref: label,
    source: "Standard Specifications",
    sourceId: "M 41-10",
    page: 1,
    url: "",
    inApp: true,
    ...over,
  };
}

describe("splitCitations", () => {
  it("turns a bracketed number that matches a citation into a citation segment", () => {
    const c = cite(1, "1-09.7");
    const segs = splitCitations("Mobilization is in [1] of the manual.", [c]);
    expect(segs).toEqual([
      { text: "Mobilization is in " },
      { cite: c },
      { text: " of the manual." },
    ]);
  });

  it("handles multiple citations across manuals", () => {
    const a = cite(1, "8-21.3(9)F");
    const b = cite(2, "CM p.363", { source: "Construction Manual", sourceId: "M 41-01", inApp: false });
    const segs = splitCitations("See [1] and [2].", [a, b]);
    expect(segs.filter((s) => "cite" in s)).toEqual([{ cite: a }, { cite: b }]);
  });

  it("returns a single text segment when there are no citations", () => {
    expect(splitCitations("I could not find that.", [])).toEqual([
      { text: "I could not find that." },
    ]);
  });

  it("does not treat a bracketed number we weren't given as a citation", () => {
    // [see note] isn't numeric, and [9] isn't a supplied citation id — both stay literal text.
    expect(splitCitations("[see note] and [9]", [cite(1, "1-09.7")])).toEqual([
      { text: "[see note] and [9]" },
    ]);
  });
});
