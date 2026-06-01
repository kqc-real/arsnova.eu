# Landing Core

- `apps/landing` is a separate Astro app for public landing/legal pages, not the Angular product app.
- Source layout:
  - `src/pages`: `index.astro`, `impressum.astro`, `datenschutz.astro`, `robots.txt.ts`, `sitemap.xml.ts`.
  - `src/components`: `Hero`, `Features`, `Workflow`, `Comparison`, `Trust`, `Faq`, `Cta`.
  - `src/layouts/BaseLayout.astro` and `src/config/{site,seo,legal,github}.ts`.
- Stack: Astro 5, Tailwind 3, YAML/prompts/html-escaper helpers. Tailwind use here does not imply Tailwind is acceptable in `apps/frontend`.
- Commands: root `npm run dev:landing`; workspace `npm run build -w @arsnova/landing` or root `npm run build:landing`.
- Landing build derives `PUBLIC_GITHUB_REPO` from env or `scripts/get-github-repo.mjs`, defaulting to `kqc-real/arsnova.eu`.
