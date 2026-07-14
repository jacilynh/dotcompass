// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SectionHistory } from "../types";
import { Timeline } from "./Timeline";

afterEach(cleanup);

// The 1-09.7 Mobilization story, trimmed — the worked example the whole tool is built
// around. If the timeline can render this, it renders the real thing.
const MOBILIZATION: SectionHistory = {
  title: "Vacant",
  firstSeen: 2000,
  lastSeen: 2026,
  current: false,
  vacantNow: true,
  timeline: [
    { year: 2000, event: "introduced" },
    {
      year: 2008,
      event: "revised",
      churn: 0.257,
      diff: [{ op: "replace", old: "old wording", new: "new wording" }],
    },
    { year: 2026, event: "vacated", was: "Mobilization consists of preconstruction expenses" },
  ],
};

describe("Timeline", () => {
  it("shows every event, newest first", () => {
    render(<Timeline history={MOBILIZATION} />);
    const years = screen.getAllByText(/^20\d\d$/).map((el) => el.textContent);
    expect(years).toEqual(["2026", "2008", "2000"]);
    expect(screen.getByText("Introduced")).toBeInTheDocument();
    expect(screen.getByText("Vacated")).toBeInTheDocument();
  });

  it("hides a revision's diff until asked, then reveals it", () => {
    render(<Timeline history={MOBILIZATION} />);
    expect(screen.queryByText("new wording")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show change/i }));
    expect(screen.getByText("new wording")).toBeInTheDocument();
    expect(screen.getByText("old wording")).toBeInTheDocument();
  });

  it("reveals the struck text of a vacated section", () => {
    render(<Timeline history={MOBILIZATION} />);
    fireEvent.click(screen.getByRole("button", { name: /show struck text/i }));
    expect(screen.getByText(/Mobilization consists of preconstruction expenses/)).toBeInTheDocument();
  });

  it("describes churn in plain language rather than a bare number", () => {
    render(<Timeline history={MOBILIZATION} />);
    // 0.257 -> "roughly 26% rewritten", never the raw fraction.
    expect(screen.getByText(/rewritten/)).toBeInTheDocument();
    expect(screen.queryByText("0.257")).not.toBeInTheDocument();
  });
});
