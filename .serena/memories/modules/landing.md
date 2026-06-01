# Landing Module

- Path: `apps/landing/`; package: `@arsnova/landing`.
- Separate Astro app for public landing/legal pages, not the Angular product app.
- Stack: Astro 5, Tailwind 3, `@astrojs/tailwind`, YAML/prompts/html-escaper helpers.
- Source layout:
  - `src/pages/`: `index.astro`, `impressum.astro`, `datenschutz.astro`, `robots.txt.ts`, `sitemap.xml.ts`.
  - `src/components/`: `Hero`, `Features`, `Workflow`, `Comparison`, `Trust`, `Faq`, `Cta`.
  - `src/layouts/BaseLayout.astro`; `src/config/{site,seo,legal,github}.ts`.
- Commands: root `npm run dev:landing`, root `npm run build:landing`, or workspace `npm run build -w @arsnova/landing`.
- Tailwind here does not authorize Tailwind in `apps/frontend`.

## Verwandte Memories:

- `mem:core`
- `mem:modules/product`
- `mem:deployment/core`
- `mem:quality/workflow`
