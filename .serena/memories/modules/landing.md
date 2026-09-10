# Landing Module

- Path: `apps/landing/`; package: `@arsnova/landing`.
- Separate Astro app for public landing/legal pages, not the Angular product app.
- Stack: Astro 5, Tailwind 3, `@astrojs/tailwind`, YAML/prompts/html-escaper helpers.
- Source layout:
  - `src/pages/`: `index.astro`, `impressum.astro`, `datenschutz.astro`, `robots.txt.ts`, `sitemap.xml.ts`.
  - `src/components/`: `Hero`, `Features`, `Workflow`, `PairingSpotlight`, `Comparison`, `Trust`, `Faq`, `Cta` plus Estimate/Confidence/Q&A spotlights.
- Two distinct mobile claims: phone-first covers quiz authoring in all question formats plus the host view (ADR-0014 / Story 2.8) in hero card 1 + lead, workflow step 01, first feature, structured question types, first comparison point, FAQ, and meta/JSON-LD. Host pairing (`#host-pairing`) stays the two-device claim and must not be merged into that stance.
  - `src/layouts/BaseLayout.astro`; `src/config/{site,seo,legal,github}.ts`.
- Commands: root `npm run dev:landing`, root `npm run build:landing`, or workspace `npm run build -w @arsnova/landing`.
- Tailwind here does not authorize Tailwind in `apps/frontend`.

## Verwandte Memories:

- `mem:core`
- `mem:modules/product`
- `mem:deployment/core`
- `mem:quality/workflow`
