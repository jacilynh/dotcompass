export const meta = {
  name: 'national-dot-recon',
  description: 'Survey all 50 state DOT specification + manual publications (source, format, numbering, historical depth, reuse) to scope national expansion of DOTcompass beyond Washington',
  phases: [
    { title: 'Discover', detail: 'one Sonnet agent per state researches its spec + manual publications' },
    { title: 'Verify', detail: 'adversarially confirm each primary spec URL actually resolves and matches' },
    { title: 'Synthesize', detail: 'Opus clusters states by scheme/format and writes a tiered, phased plan' },
  ],
}

const STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

const DISCOVER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['state','dotAbbrev','specsPageUrl','primarySpecUrl','format','numberingScheme',
    'numberingExample','currentEdition','historicalEditionsAvailable','historicalDepth',
    'manuals','reuse','confidence','notes'],
  properties: {
    state: { type: 'string' },
    dotAbbrev: { type: 'string', description: 'e.g. Caltrans, TxDOT, WSDOT' },
    specsPageUrl: { type: 'string', description: 'official page where the Standard Specifications are published' },
    primarySpecUrl: { type: 'string', description: 'direct link to the current edition (PDF or landing); empty string if not confirmed' },
    format: { type: 'string', enum: ['single-pdf','per-division-pdf','html','portal-login','scanned-images','unknown'] },
    numberingScheme: { type: 'string', description: 'how sections are numbered' },
    numberingExample: { type: 'string', description: 'one concrete example, e.g. "Section 105.01" or "1-09.7"' },
    currentEdition: { type: 'string', description: 'year/name of the current edition' },
    historicalEditionsAvailable: { type: 'boolean' },
    historicalDepth: { type: 'string', description: 'e.g. "back to 2004, ~6 editions" or "current only"' },
    manuals: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name','url'],
        properties: { name: { type: 'string' }, url: { type: 'string' } },
      },
      description: 'other major manuals: Design, Construction, Materials, Bridge, Traffic, etc.',
    },
    reuse: { type: 'string', description: 'any stated reuse/copyright terms' },
    confidence: { type: 'string', enum: ['high','medium','low'] },
    notes: { type: 'string' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['urlResolves','matchesClaim','observation','adjustedConfidence'],
  properties: {
    urlResolves: { type: 'boolean', description: 'did the primary spec URL (or specs page) actually load real content?' },
    matchesClaim: { type: 'boolean', description: 'does the real page match the reported format and numbering?' },
    observation: { type: 'string', description: 'what you actually saw when you fetched it' },
    adjustedConfidence: { type: 'string', enum: ['high','medium','low'] },
  },
};

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary','clusters','tractabilityTiers','historyFeasibility','pilotRecommendations','phasedPlan','risks'],
  properties: {
    summary: { type: 'string' },
    clusters: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['scheme','description','states'],
        properties: { scheme: { type: 'string' }, description: { type: 'string' }, states: { type: 'array', items: { type: 'string' } } },
      },
      description: 'states grouped by shared numbering scheme + document structure (a shared parser serves a cluster)',
    },
    tractabilityTiers: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['tier','description','states'],
        properties: { tier: { type: 'string' }, description: { type: 'string' }, states: { type: 'array', items: { type: 'string' } } },
      },
      description: 'tier1: small generalization of the WSDOT parser; tier2: new parser, clean PDFs; tier3: hard (OCR/portal/HTML)',
    },
    historyFeasibility: { type: 'string', description: 'which states publish enough historical editions for the section-history feature vs. current-only states' },
    pilotRecommendations: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['state','why'], properties: { state: { type: 'string' }, why: { type: 'string' } } },
      description: '3-5 best states to implement first, by value-to-effort',
    },
    phasedPlan: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['phase','goal','work'], properties: { phase: { type: 'string' }, goal: { type: 'string' }, work: { type: 'string' } } },
    },
    risks: { type: 'string' },
  },
};

const discoverPrompt = (state) => `You are researching how the ${state} Department of Transportation publishes its construction specifications and engineering manuals, so we can extend a tool (DOTcompass) that currently covers only Washington State to cover ${state}.

Use web search and web fetch to find, for the ${state} DOT:
1. The official "Standard Specifications for Road/Highway and Bridge Construction" (or that state's equivalent name) — the page where it's published, and a direct link to the CURRENT edition (PDF or landing page).
2. The current edition's year or name.
3. The section-numbering scheme, with ONE concrete example (e.g. "Section 105.01", "6-digit item numbers like 390105", or Washington-style "1-09.7").
4. The document format: one large PDF, per-division/section PDFs, HTML pages, a login/portal, or scanned images.
5. Whether HISTORICAL editions are downloadable, and roughly how far back. This matters a lot: the tool's flagship feature is showing each section's history across editions, which only works if the state publishes an archive.
6. Other major manuals the DOT publishes (Design, Construction, Materials, Bridge, Traffic/MUTCD supplement, etc.) with URLs.
7. Any stated reuse or copyright terms.

Return the structured record. Rules: only report a primarySpecUrl you have actually seen referenced on an official page or successfully fetched — if you cannot confirm one, use an empty string and set confidence to "low". Never invent a URL. Prefer official .gov / state DOT domains.`;

const verifyPrompt = (rec) => `A researcher reported the following about ${rec.state} DOT's construction specifications. Adversarially verify it — your job is to catch errors, not confirm.

  specs page:        ${rec.specsPageUrl || '(none given)'}
  primary spec URL:  ${rec.primarySpecUrl || '(none given)'}
  claimed format:    ${rec.format}
  claimed numbering: ${rec.numberingScheme} (example: ${rec.numberingExample})
  current edition:   ${rec.currentEdition}

Fetch the primary spec URL (or, if none was given, the specs page). Confirm whether it actually resolves to real ${rec.state} DOT construction specifications, and whether the format and numbering claims hold up against what you observe. If the URL 404s, redirects somewhere unrelated, requires a login, or the numbering/format is misdescribed, say so plainly and lower the confidence. Report exactly what you observed.`;

const synthesizePrompt = (records) => `Here are verified reconnaissance records for state DOT construction-specification publications (JSON array):

${JSON.stringify(records, null, 1)}

Context: DOTcompass currently parses only Washington State's specifications. Its pipeline assumes WSDOT's specific section numbering (like "1-09.7"), a 9-division structure, and — crucially — WSDOT's unusual practice of publishing a complete new edition every year with stable section numbers, which is the only reason its 26-year "section history" feature is possible. Most states differ on all three counts.

Produce a concrete, honest national-expansion plan:
- CLUSTERS: group the states by shared section-numbering scheme and document structure. States in one cluster can likely share a single parser.
- TRACTABILITY TIERS: tier 1 = close to WSDOT, a small generalization of the existing parser; tier 2 = a different scheme but clean born-digital PDFs, needs a new but straightforward parser; tier 3 = hard (scanned images needing OCR, login portals, or HTML-only publication).
- HISTORY FEASIBILITY: which states actually publish enough historical editions for the section-history feature to work, versus current-only states where DOTcompass would be a browser + search + scanner only (no history).
- PILOTS: recommend 3-5 states to implement first, chosen for the best ratio of value to effort.
- PHASED PLAN: a realistic sequence of implementation phases.
- RISKS: the biggest honest risks (data availability, copyright, parser fragility, the history feature simply not existing for most states).

Do not overstate feasibility. Be specific about which states are easy and which are painful.`;

phase('Discover');
log(`Fanning out ${STATES.length} state-DOT reconnaissance agents (Sonnet), each verified before synthesis.`);

// Discover then verify each state independently (no barrier); pipeline wall-clock is the
// slowest single state's discover+verify chain, not the sum.
const results = await pipeline(
  STATES,
  (state) =>
    agent(discoverPrompt(state), {
      schema: DISCOVER_SCHEMA,
      model: 'sonnet',
      effort: 'medium',
      agentType: 'general-purpose',
      phase: 'Discover',
      label: `discover:${state}`,
    }),
  (rec) =>
    rec
      ? agent(verifyPrompt(rec), {
          schema: VERIFY_SCHEMA,
          model: 'sonnet',
          effort: 'low',
          agentType: 'general-purpose',
          phase: 'Verify',
          label: `verify:${rec.state}`,
        }).then((v) => ({ ...rec, verification: v }))
      : null,
);

const catalog = results.filter(Boolean);
log(`Recon complete: ${catalog.length}/${STATES.length} states catalogued. Synthesizing the national plan (Opus).`);

phase('Synthesize');
const plan = await agent(synthesizePrompt(catalog), {
  schema: PLAN_SCHEMA,
  model: 'opus',
  effort: 'high',
  phase: 'Synthesize',
  label: 'synthesize:national-plan',
});

return { catalogCount: catalog.length, catalog, plan };
