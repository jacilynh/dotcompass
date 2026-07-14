import { describe, expect, it } from "vitest";

import type { IndexEntry } from "../types";
import { extractCitations, scanDraft, summarize } from "./scanner";

const entry = (num: string, title: string, vacant = false): IndexEntry => ({
  num,
  title,
  division: Number(num[0]),
  vacant,
});

const SECTIONS: IndexEntry[] = [
  entry("1-07.1", "Laws to be Observed"),
  entry("1-09.7", "Vacant", true),
  entry("8-21.3(9)F", "Foundations"),
];

describe("extractCitations", () => {
  it("finds section numbers in prose and counts repeats", () => {
    const text = "Per Section 1-07.1, and again 1-07.1, see also 8-21.3(9)F.";
    const counts = extractCitations(text);
    expect(counts.get("1-07.1")).toBe(2);
    expect(counts.get("8-21.3(9)F")).toBe(1);
  });

  it("does not match dates, dimensions, or single-digit ranges", () => {
    // "1-5" has one digit after the dash; a real section number has two (1-05).
    const counts = extractCitations("a 1-5 day window, 3-inch pipe, dated 2024.");
    expect(counts.size).toBe(0);
  });
});

// 1-10 (Temporary Traffic Control) was a real section through 2025, then removed when
// WSDOT renumbered it to 2-04 in 2026 — the real case that motivated this distinction.
const REMOVED = { "1-10": 2025 };

describe("scanDraft", () => {
  it("flags a citation of a vacant (struck) section", () => {
    const [finding] = scanDraft("payment under 1-09.7", SECTIONS);
    expect(finding).toMatchObject({ num: "1-09.7", status: "vacant" });
  });

  it("distinguishes a removed section from a number that never existed", () => {
    const findings = scanDraft("cite 1-10 and also 1-99.9", SECTIONS, REMOVED);
    const removed = findings.find((f) => f.num === "1-10");
    const unknown = findings.find((f) => f.num === "1-99.9");
    expect(removed).toMatchObject({ status: "removed", lastSeen: 2025 });
    expect(unknown?.status).toBe("unknown");
  });

  it("passes a citation that exists with text", () => {
    const [finding] = scanDraft("comply with 1-07.1", SECTIONS);
    expect(finding).toMatchObject({ num: "1-07.1", status: "valid" });
  });

  it("leads with problems before valid citations", () => {
    const statuses = scanDraft("1-07.1 then 1-09.7 then 1-10", SECTIONS, REMOVED).map(
      (f) => f.status,
    );
    expect(statuses.indexOf("valid")).toBeGreaterThan(statuses.indexOf("vacant"));
    expect(statuses.indexOf("valid")).toBeGreaterThan(statuses.indexOf("removed"));
  });

  it("summarizes counts by status", () => {
    const totals = summarize(scanDraft("1-07.1 1-09.7 1-10 2-50.5", SECTIONS, REMOVED));
    expect(totals).toEqual({ valid: 1, vacant: 1, removed: 1, unknown: 1 });
  });
});
