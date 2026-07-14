import { useIndex } from "../lib/indexContext";

/**
 * The making-of. Since a central goal of this project is to show what's now possible, the
 * story of building it is treated as a first-class page, not a footnote — and it's told
 * honestly, including where the data is weak.
 */
export function HowBuilt() {
  const { stats } = useIndex();
  return (
    <div className="mx-auto max-w-reading space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">How this was built</h1>
        <p className="mt-2 leading-7 text-muted">
          One person, working with an AI coding assistant, over a few weeks. The site is static and
          costs almost nothing to run: all the heavy work happens once, ahead of time, and what you
          load is plain files.
        </p>
      </header>

      <Step n={1} title="Read 26 years of PDFs">
        WSDOT publishes each edition of the specifications as a PDF. This project gathers all{" "}
        {stats.editions.length} of them, from {stats.earliest} to {stats.latest}, and extracts every
        section — the number, the title, and the full text.
        <p className="mt-3">
          That sounds routine and isn’t. Only a handful of the editions ship a usable table of
          contents; the rest have almost none. And across 26 years nearly everything about the
          layout changed — the page size, the heading font (one era’s heading font doesn’t even
          contain the word “bold”), and whether a section’s number and title share a line or sit on
          two. So the parser <em>measures</em> each book instead of assuming, and defends against two
          traps that each quietly destroyed most of a book before being caught: numbering that
          restarts partway through, and a single stray table cell that could truncate everything
          after it.
        </p>
      </Step>

      <Step n={2} title="Line up every edition, section by section">
        With all editions parsed, each section’s life is assembled by comparing consecutive
        editions: when it first appeared, every time its wording changed (and by how much), and
        whether it was ever struck or removed. That produces{" "}
        <strong className="text-ink">{stats.revisions.toLocaleString()}</strong> tracked revisions
        across <strong className="text-ink">{stats.everPublished.toLocaleString()}</strong> sections.
      </Step>

      <Step n={3} title="Ship it as plain files">
        The result is baked into static JSON — split by division so your browser only ever loads the
        part you’re looking at — and served as a static site. No server, no database, no per-use
        cost. The full source, including the pipeline that does all of this, is open and meant to be
        forked for other agencies’ spec books.
      </Step>

      <div className="rounded-lg border border-vacated/30 bg-vacated/5 p-4">
        <h2 className="font-medium text-ink">Where it’s still weak — stated plainly</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          The pre-2010 editions parse least reliably. The raw process even claimed a couple hundred
          sections vanished for a single edition and came back — almost certainly the parser missing
          a heading, not the agency striking and reinstating them. Those one-edition gaps are treated
          as parse misses, and pre-2010 data is flagged as lower-confidence wherever it appears. A
          tool whose whole point is that it doesn’t bluff shouldn’t start by bluffing about its own
          data.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-accent-ink">
        {n}
      </div>
      <div>
        <h2 className="mb-1 text-lg font-semibold text-ink">{title}</h2>
        <div className="leading-7 text-muted">{children}</div>
      </div>
    </section>
  );
}
