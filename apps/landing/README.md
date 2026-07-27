# arsnova.eu – Landing

> **Produktion:** Die App liegt unter **https://arsnova.eu**. Die getrennte
> Marketing- und Informationsseite wird über GitHub Pages unter
> **https://info.arsnova.eu/** ausgeliefert.

Marketing- und Informationsseite für arsnova.eu. Astro 6 + Tailwind 3 (PostCSS), SEO-optimiert, für GitHub Pages oder beliebigen Static Host.

**Node.js:** Landing-Build und `dev:landing` benötigen **Node ≥ 22.12** (Astro 6). CI und `.nvmrc` nutzen Node 24 LTS.

## Entwicklung

```bash
# Aus Repo-Root
npm run dev:landing
```

Öffnen: [http://localhost:4321](http://localhost:4321)

## Build

```bash
PUBLIC_SITE_URL=https://info.arsnova.eu/ \
PUBLIC_APP_URL_V3=https://arsnova.eu \
BASE_PATH=/ \
npm run build:landing
```

Output: `apps/landing/dist/`

## GitHub Pages

1. **Repo-Einstellung:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. **Vor einem Root-Build oder Merge:** GitHub-Domain-Verifikation,
   DNS-CNAME, Custom Domain, Zertifikat und **Enforce HTTPS** vollständig
   aktivieren und die Weiterleitung der bisherigen Projekt-URL prüfen.
3. Erst danach die Konfiguration mit `PUBLIC_SITE_URL=https://info.arsnova.eu/`
   und `BASE_PATH=/` nach `main` mergen. Beim Push baut und deployt
   `.github/workflows/deploy-landing.yml` die Landing; ein Preflight bricht
   ab, falls die Cutover-Voraussetzungen nicht mehr erfüllt sind.

Der Cutover ist seit dem 27. Juli 2026 vollständig aktiv:
`info.arsnova.eu` ist als Pages-Custom-Domain verifiziert, CNAME und
HTTPS-Zertifikat sind aktiv, HTTPS wird erzwungen und
`https://kqc-real.github.io/arsnova.eu/` leitet mit `301` auf die Custom Domain
weiter.

**Hinweis:** Du brauchst Schreibrechte auf das Repo und die Berechtigung, Pages auf „GitHub Actions“ umzustellen. Der Workflow selbst liegt im Repo; nach dem Push und nach Aktivierung von Pages läuft alles automatisch.

Die vollständige Aktivierungs-, DNS-, HTTPS- und Rollback-Reihenfolge steht im
[GitHub-Pages-Runbook](../../docs/operations/LANDING-GITHUB-PAGES-RUNBOOK.md).

Da über einen eigenen GitHub-Actions-Workflow veröffentlicht wird, ist keine
`CNAME`-Datei im Artifact oder Repository erforderlich; GitHub ignoriert eine
solche Datei bei diesem Veröffentlichungsweg. Die Domain-Zuordnung erfolgt in
den Pages-Einstellungen.

## SEO

- Meta Title/Description, Open Graph, Twitter Cards
- JSON-LD `WebApplication` für Suchmaschinen
- generierte Sitemap unter `/sitemap.xml`
- generierte `robots.txt` unter `/robots.txt`

Für Builds auf GitHub Pages setzt der Workflow `PUBLIC_SITE_URL=https://info.arsnova.eu/` und `BASE_PATH=/`. Dadurch verweisen Canonical, Open Graph, Sitemap und `robots.txt` auf die Landing-Domain. App-CTAs und das JSON-LD-Objekt `WebApplication` verwenden dagegen weiterhin `https://arsnova.eu`.

## Impressum & Datenschutz (DSGVO)

Die Seiten `/impressum/` und `/datenschutz/` sind mit DSGVO-tauglichen Inhalten vorstrukturiert. **Vor Go-Live** die Platzhalter in **`src/config/legal.ts`** durch echte Angaben ersetzen (Anbieter, Anschrift, E-Mail, ggf. USt-ID, Verantwortliche Person, Datenschutz-E-Mail). Die Texte (Haftung, Urheberrecht, Betroffenenrechte etc.) sind rechtlich üblich formuliert; bei Bedarf durch einen Anwalt prüfen lassen.

## OG-Bild

Für Social-Sharing wird `/og.png` erwartet. Bild (z. B. 1200×630 px) nach `apps/landing/public/og.png` legen. Ohne Datei zeigen Soziale Netzwerke ggf. kein Vorschaubild.
