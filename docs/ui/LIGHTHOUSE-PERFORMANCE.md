# Lighthouse Performance

## Verbindliche CI-Werte

Lighthouse CI misst den lokalisierten Produktionsbuild mobil und führt je URL drei Läufe aus.
Folgende Grenzen blockieren die CI:

- Performance-Score mindestens **60 %**
- Accessibility mindestens **90 %**
- Largest Contentful Paint höchstens **4 s**
- Cumulative Layout Shift höchstens **0,1**
- Total Blocking Time höchstens **600 ms**

Best Practices und SEO bleiben Warnsignale. Die Grenzwerte stehen kanonisch in
`.lighthouserc.cjs`; Änderungen daran müssen als bewusste Performance-Entscheidung reviewed
werden.

## Letzter CI-naher lokaler Lauf

Am **2026-07-10** wurde der lokalisierte Produktionsbuild für `/de/` und `/en/`
je dreimal mit dem mobilen Profil gemessen. Beide URLs verfehlten reproduzierbar:

- Performance-Score **0,55** statt mindestens **0,60**
- LCP rund **11,1 s** statt höchstens **4 s**

Accessibility, CLS und TBT verletzten kein Gate. Der Lauf verwendete einen
einfachen lokalen statischen Server ohne produktionsspezifische Kompression oder
CDN. Das kann die absolute LCP beeinflussen; das lokale Hard-Gate bleibt dennoch
rot und darf nicht als bestanden dokumentiert werden. Details und die übrigen
Testergebnisse:
[Lokaler Gesamt-Testlauf 2026-07-10](../implementation/LOCAL-TESTRUN-2026-07-10.md).

## Wichtig: Production-Build messen

**Lighthouse immer gegen einen Production-Build laufen lassen.** Im Development-Modus (`ng serve`) ist das Bundle unminifiziert und nicht optimiert – das führt zu schlechten Performance-Werten (~50 %).

```bash
npm run build:prod
npm run serve:localize -w @arsnova/frontend
# Dann in Chrome: http://localhost:4200/de/ → DevTools → Lighthouse → Performance (Mobile)
```

Hinweis: Der lokalisierte Build-Output liegt unter **`apps/frontend/dist/browser/`**. Beim Servieren immer **`dist/browser`** als Dokument-Wurzel nutzen, damit `/de/`, `/en/`, `/fr/`, `/it/` und `/es/` die App laden und nicht ein Verzeichnislisting.

Alternativ: `npx http-server dist/browser -p 8080 -c-1`

### robots.txt: „not valid“, viele Fehler (z. B. 40)?

Wenn der Server **nicht** aus **`dist/browser`** bedient wird, liefert die SPA bei Anfragen wie `/robots.txt` die **index.html** aus (Fallback). Lighthouse parst dann HTML als robots.txt → sehr viele Syntaxfehler. **Lösung:** Server mit Wurzel **`dist/browser`** starten (`npx serve dist/browser -s`), dann liefert `/robots.txt` die echte Datei. Die `robots.txt` im Projekt ist minimal und RFC-konform (`User-agent: *` + leeres `Disallow:`).

### App wird nicht angezeigt / weiße Seite?

- **Nur Verzeichnislisting?** Du siehst „Index of …“ mit Ordnern wie `browser/` → Server läuft mit Wurzel **`dist/`**. Stoppe den Server und starte mit **`dist/browser`** als Wurzel (siehe Befehle oben). Dann im Browser **nur** die Root-URL öffnen (z. B. `http://localhost:3000/`).
- **URL endet auf `/browser/`?** Wenn der Server mit Wurzel `dist/` läuft und du `…/browser/` aufrufst, lädt die App ihre Skripte von `/chunk-xxx.js` statt von `/browser/chunk-xxx.js` → 404, weiße Seite. **Lösung:** Server mit Wurzel `dist/browser` starten und **`http://localhost:PORT/`** (ohne `/browser/`) öffnen.

## Umgesetzte Optimierungen

| Maßnahme                            | Zweck                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **System-Schriften**                | Keine Google-Fonts-Requests; dadurch kein externer Font-Fetch und kein Google-Verbindungsaufbau.             |
| **Selbst gehostete Material Icons** | `material-icons.woff2` liegt unter `assets/fonts/`; Icons laden vom eigenen Server mit `font-display: swap`. |
| **Keine Font-Preconnects**          | Keine `preconnect`-Einträge zu Google-Font-Domains mehr notwendig.                                           |
| **Lazy Loading**                    | Alle Routen (Home, Quiz, Session, Legal) laden ihre Komponenten per `loadComponent()` (Code-Splitting).      |
| **Bundle-Budgets**                  | `angular.json`: initial max. 1.70 MB (Warning), 1.85 MB (Error).                                             |
| **Service Worker**                  | PWA/ngsw für Production – Caching bei wiederholten Besuchen.                                                 |

## DoD-Checks: 320px & Accessibility

- **Kein horizontales Scrollen ab 320px (Story 6.4):**  
  Nach dem Build: `npm run serve:localize -w @arsnova/frontend` starten, dann `BASE_URL=http://localhost:4200 npm run check:viewport -w @arsnova/frontend`. Prüft den 320px-Viewport für die konfigurierten Kernrouten.

- **Lighthouse Accessibility ≥ 90 und Performance-Gates (DoD):**
  `npm run lighthouse:a11y -w @arsnova/frontend` – startet bei Bedarf einen lokalen Serve und gibt den Accessibility-Score aus. Optional: `LIGHTHOUSE_URL=http://localhost:4200/de/ npm run lighthouse:a11y -w @arsnova/frontend`, wenn bereits ein Serve läuft.

---

## Weitere Tipps bei Bedarf

- **Bundle analysieren:** `cd apps/frontend && npm run build -- --configuration=production --stats-json`, dann mit [source-map-explorer](https://www.npmjs.com/package/source-map-explorer) oder [webpack-bundle-analyzer](https://www.npmjs.com/package/webpack-bundle-analyzer) die größten Pakete prüfen (z. B. Angular Material, tRPC).
- **Icon-Subset:** Falls Performance weiter Priorität hat, die selbst gehostete Material-Icon-Font durch SVG-Icons oder ein kleineres Icon-Subset ersetzen.
- **LCP:** Hero und erste Card bleiben schlank; System-Schriften vermeiden FOIT durch externe Font-Ladepfade.
