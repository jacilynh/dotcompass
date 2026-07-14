import { DISCLAIMER, PUBLISHER } from "../config";
import { useIndex } from "../lib/indexContext";

export function About() {
  const { stats } = useIndex();
  return (
    <div className="prose-page mx-auto max-w-reading space-y-6">
      <h1 className="text-2xl font-semibold text-ink">About this tool</h1>

      <p className="leading-7 text-muted">
        This is a free, unofficial reference for the{" "}
        <span className="text-ink">WSDOT Standard Specifications for Road, Bridge, and Municipal</span>{" "}
        <span className="text-ink">Construction (M 41-10)</span>. It reads every published edition
        from {stats.earliest} to {stats.latest} and reconstructs the history of each section — the
        thing the published book, which only ever shows you today, cannot.
      </p>

      <Callout title="It is not affiliated with WSDOT">{DISCLAIMER}</Callout>

      <Section title="Why it’s free and public">
        The WSDOT Standard Specifications are a Washington State public document. This tool is a
        public resource anyone may use — not a benefit offered to any particular group. It is
        deliberately not gated to state employees: a free public reference belongs to everyone, and
        restricting it would defeat the point.
      </Section>

      <Section title="Your documents never leave your browser">
        Any feature that checks your own draft against the specifications runs entirely on your
        machine. Nothing you paste or upload is sent anywhere. That’s a deliberate design choice, not
        an incidental one.
      </Section>

      <Section title="How current it is">
        The data is built from the edition PDFs WSDOT publishes and is only as current as the latest
        one processed (the {stats.latest} edition). Editions before 2010 parse less reliably and are
        marked as lower-confidence where they appear. Always confirm anything that matters against
        the official manual.
      </Section>

      <p className="border-t border-border pt-6 text-sm text-muted">
        Built and maintained by <span className="font-medium text-ink">{PUBLISHER}</span>. We build
        tools like this — if your team has a document problem shaped like this one, get in touch.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-ink">{title}</h2>
      <p className="leading-7 text-muted">{children}</p>
    </section>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{children}</p>
    </div>
  );
}
