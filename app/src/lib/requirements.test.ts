import { describe, expect, it } from "vitest";

import type { Requirement } from "../types";
import { filterRequirements } from "./requirements";

const req = (over: Partial<Requirement>): Requirement => ({
  section: "1-01",
  division: 1,
  party: "Contractor",
  modal: "shall",
  topics: [],
  text: "The Contractor shall do a thing.",
  ...over,
});

const REQS: Requirement[] = [
  req({ party: "Contractor", topics: ["Submittals"], text: "shall submit a plan" }),
  req({ party: "Engineer", topics: ["Testing & Inspection"], text: "shall inspect the weld" }),
  req({ party: "Work/Material", topics: ["Materials"], text: "concrete shall reach 4000 psi" }),
];

const NONE = { party: null, topics: [], query: "" };

describe("filterRequirements", () => {
  it("returns everything with no filter", () => {
    expect(filterRequirements(REQS, NONE)).toHaveLength(3);
  });

  it("filters to an exact party", () => {
    const out = filterRequirements(REQS, { ...NONE, party: "Engineer" });
    expect(out).toHaveLength(1);
    expect(out[0]?.party).toBe("Engineer");
  });

  it("ORs multiple topics", () => {
    const out = filterRequirements(REQS, { ...NONE, topics: ["Submittals", "Materials"] });
    expect(out.map((r) => r.party).sort()).toEqual(["Contractor", "Work/Material"]);
  });

  it("matches free text case-insensitively", () => {
    expect(filterRequirements(REQS, { ...NONE, query: "WELD" })).toHaveLength(1);
  });

  it("combines filters (AND across facets)", () => {
    const out = filterRequirements(REQS, {
      party: "Contractor",
      topics: ["Submittals"],
      query: "plan",
    });
    expect(out).toHaveLength(1);
    expect(filterRequirements(REQS, { party: "Engineer", topics: ["Submittals"], query: "" })).toHaveLength(0);
  });
});
