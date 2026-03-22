# arsnova.eu – Landing

> **Produktion:** Die App liegt unter **https://arsnova.eu**. Die Marketing‑Landing
> kann z. B. über GitHub Pages mit Custom Domain (z. B. `arsnova.eu` oder
> Subdomain) ausgeliefert werden.

Marketing- und Informationsseite für arsnova.eu. Astro + Tailwind, SEO-optimiert, für GitHub Pages oder beliebigen Static Host.

## Entwicklung

```bash
# Aus Repo-Root
npm run dev:landing
```

Öffnen: [http://localhost:4321](http://localhost:4321)

## Build

```bash
npm run build:landing
```

Output: `apps/landing/dist/`

## GitHub Pages

> Hinweis: Die Custom‑Domain in den GitHub‑Pages‑Einstellungen muss zu eurer
> gewünschten öffentlichen Landing‑URL passen (z. B. `arsnova.eu`).

1. **Repo-Einstellung:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Beim Push auf `main` (bei Änderungen in `apps/landing/`) baut das Workflow `.github/workflows/deploy-landing.yml` die Landing und deployt sie.
3. Optional: Eigene Domain unter Pages → Custom domain eintragen (z. B. `arsnova.eu`).

**Hinweis:** Du brauchst Schreibrechte auf das Repo und die Berechtigung, Pages auf „GitHub Actions“ umzustellen. Der Workflow selbst liegt im Repo; nach dem Push und nach Aktivierung von Pages läuft alles automatisch.

### 404 auf \`username.github.io/arsnova.eu/\`?

- **Pages-Quelle:** Settings → Pages → Source muss **„GitHub Actions“** sein (nicht „Deploy from a branch“).
- **Workflow ausführen:** Actions → „Deploy Landing (GitHub Pages)“ → „Run workflow“ (Branch: main). Prüfen, ob beide Jobs (Build, Deploy) grün sind.
- **URL exakt:** Repo-Name muss genau `arsnova.eu` heißen; die URL ist `https://<owner>.github.io/arsnova.eu/`.
- **Default-Branch:** Der Workflow läuft nur bei Push auf `main`; bei Fork prüfen, ob der Default-Branch `main` ist.

## SEO

- Meta Title/Description, Open Graph, Twitter Cards
- JSON-LD `WebApplication` für Suchmaschinen
- Sitemap (`public/sitemap.xml`)
- `robots.txt` in `public/`

## Impressum & Datenschutz (DSGVO)

Die Seiten `/impressum` und `/datenschutz` sind mit DSGVO-tauglichen Inhalten vorstrukturiert. **Vor Go-Live** die Platzhalter in **`src/config/legal.ts`** durch echte Angaben ersetzen (Anbieter, Anschrift, E-Mail, ggf. USt-ID, Verantwortliche Person, Datenschutz-E-Mail). Die Texte (Haftung, Urheberrecht, Betroffenenrechte etc.) sind rechtlich üblich formuliert; bei Bedarf durch einen Anwalt prüfen lassen.

## OG-Bild

Für Social-Sharing wird `/og.png` erwartet. Bild (z. B. 1200×630 px) nach `apps/landing/public/og.png` legen. Ohne Datei zeigen Soziale Netzwerke ggf. kein Vorschaubild.
