// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Index, SectionHistory, SectionText } from "./types";

// Mock the data layer so the whole app can be exercised without the generated JSON.
// The fixtures are the 1-09.7 story, which is what the app is built to tell.
const INDEX: Index = {
  stats: {
    everPublished: 3853,
    live: 3095,
    vacant: 142,
    sinceStart: 1599,
    newInLatest: 269,
    revisions: 11561,
    editions: [2000, 2008, 2026],
    latest: 2026,
    earliest: 2000,
  },
  divisions: [{ n: 1, title: "General Requirements" }],
  removed: {},
  sections: [
    { num: "1-09.6", division: 1, title: "Progress Estimates and Payments", vacant: false },
    { num: "1-09.7", division: 1, title: "Vacant", vacant: true },
    { num: "1-09.8", division: 1, title: "Payment for Material on Hand", vacant: false },
  ],
};

const DIV_TEXT: Record<string, SectionText> = {
  "1-09.7": { title: "Vacant", text: "", vacant: true, page: 180 },
};

const DIV_HISTORY: Record<string, SectionHistory> = {
  "1-09.7": {
    title: "Vacant",
    firstSeen: 2000,
    lastSeen: 2026,
    current: false,
    vacantNow: true,
    timeline: [
      { year: 2000, event: "introduced" },
      { year: 2026, event: "vacated", was: "Mobilization consists of preconstruction expenses" },
    ],
  },
};

vi.mock("./lib/api", () => ({
  getIndex: () => Promise.resolve(INDEX),
  getDivisionText: () => Promise.resolve(DIV_TEXT),
  getDivisionHistory: () => Promise.resolve(DIV_HISTORY),
}));

// Imported after the mock is registered.
const { App } = await import("./App");

afterEach(cleanup);

describe("App", () => {
  it("renders the home page once the index loads", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText(/A specification section is not a fact/i),
    ).toBeInTheDocument();
    // The headline count appears in both the prose and the stat band — its presence,
    // not its uniqueness, is what matters.
    expect(screen.getAllByText("3,853").length).toBeGreaterThan(0);
  });

  it("renders a vacant section with its full history at a deep link", async () => {
    render(
      <MemoryRouter initialEntries={["/section/1-09.7"]}>
        <App />
      </MemoryRouter>,
    );

    // The section heading, and the Vacant notice in place of current text.
    expect(await screen.findByRole("heading", { name: "1-09.7" })).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(within(main).getByText(/reserved but carries no text/i)).toBeInTheDocument();

    // The history timeline rendered alongside it, newest first.
    const aside = screen.getByRole("complementary");
    expect(within(aside).getByText("Vacated")).toBeInTheDocument();
    expect(within(aside).getByText("Introduced")).toBeInTheDocument();
    expect(within(aside).getByText("2026")).toBeInTheDocument();
  });

  it("checks a pasted draft and flags a citation of a vacant section", async () => {
    render(
      <MemoryRouter initialEntries={["/scan"]}>
        <App />
      </MemoryRouter>,
    );
    const draft = await screen.findByLabelText(/your draft/i);
    fireEvent.change(draft, { target: { value: "Mobilization is paid under Section 1-09.7." } });

    // The finding appears with its stale-citation status; nothing was sent anywhere.
    expect(await screen.findByText(/citing a struck section/i)).toBeInTheDocument();
    expect(screen.getByText(/never leaves your browser/i)).toBeInTheDocument();
  });
});
