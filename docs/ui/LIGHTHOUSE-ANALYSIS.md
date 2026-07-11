# Lighthouse-Analyse (Lauf: 2026-02-25)

> **Archivhinweis (2026-05-31):** Dies ist ein historischer Lighthouse-Lauf. Der aktuelle Build nutzt System-Schriften und selbst gehostete Material Icons; frühere Hinweise zu Google Fonts, Font-Preconnects oder Icon-Stylesheets nach `window.load` sind nicht mehr der Ist-Stand. Aktuelle Messanleitung: [LIGHTHOUSE-PERFORMANCE.md](LIGHTHOUSE-PERFORMANCE.md).
>
> **Aktueller Gegenbefund (2026-07-10):** Der CI-nahe lokale Lauf des
> lokalisierten Produktionsbuilds erreichte für `/de/` und `/en/` nur
> Performance 0,55 und rund 11,1 s LCP. Die historischen 85 % beziehungsweise
> 2,4 s dürfen daher nicht als aktueller Nachweis verwendet werden. Siehe
> [Gesamt-Testlauf](../implementation/LOCAL-TESTRUN-2026-07-10.md).
>
> **Aktueller Nachweis (2026-07-11):** Nach produktionsnaher gzip-Auslieferung,
> i18n-Hydration und Font-Reduktion bestanden 6/6 Läufe mit Performance
> 0,79–0,80 und LCP 3,705–3,829 s. Siehe
> [QA-Nachlauf](../implementation/LOCAL-QA-RECHECK-2026-07-11.md).

**Ziel-URL:** http://localhost:4174/ (Production-Build, `dist/browser`)  
**Lighthouse:** 12.x, Kategorien Performance, Best Practices, SEO (Headless Chrome)

---

## Gesamtergebnisse

| Kategorie          | Score            |
| ------------------ | ---------------- |
| **Performance**    | 85 %             |
| **Best Practices** | 96 %             |
| **SEO**            | 91 %             |
| **Accessibility**  | 100 % (DoD ≥ 90) |

---

## 1. Performance (85 %)

| Metrik                         | Wert   | Bewertung |
| ------------------------------ | ------ | --------- |
| First Contentful Paint (FCP)   | ~2 s   | 84 %      |
| Largest Contentful Paint (LCP) | ~2,4 s | 92 %      |
| Speed Index                    | ~2 s   | 99 %      |
| Total Blocking Time (TBT)      | ~80 ms | 99 %      |
| Cumulative Layout Shift (CLS)  | ~0,12  | 83 %      |
| Time to Interactive (TTI)      | ~3,7 s | 91 %      |

**Stärken im damaligen Lauf:** Geringe Main-Thread-Blockierung, guter Speed Index, keine render-blocking Resources im kritischen Pfad.

**Potenzial im damaligen Lauf:** CLS, Unused JS im Home-Chunk (~20 KiB), Cache-Header in Production prüfen. Die damaligen Font-/Icon-Hinweise sind seit der Umstellung auf System-Schriften und selbst gehostete Material Icons erledigt.

---

## 2. Best Practices (96 %)

### Fehlgeschlagen / Warnung

| Audit                 | Score | Ursache                       |
| --------------------- | ----- | ----------------------------- |
| **errors-in-console** | 0 %   | Browser-Fehler in der Konsole |

**Details zu „errors-in-console“:**  
Während des Lighthouse-Laufs werden **WebSocket-Verbindungen zu `ws://localhost:3001/`** (tRPC/Backend) versucht und schlagen fehl, weil beim reinen Statik-Serve (**`npx serve dist/browser`**) kein Backend läuft. Die App versucht beim Start, eine Verbindung zum API-Server aufzubauen.

- **Bewertung:** In einer **Production-Umgebung mit laufendem Backend** treten diese Fehler nicht auf (bzw. die Verbindung steht). Der 0-%-Score ist also **testbedingt**.
- **Optional:** Für reine Statik-Tests könnte die App so konfiguriert werden, dass sie keine WS-Verbindung anfordert, wenn keine API-URL erreichbar ist (z. B. Feature-Flag oder späterer Backend-Check).

**Alle anderen Best-Practices-Audits** (u. a. HTTPS-Vorbereitung, keine veralteten APIs, keine Passwort-Eingaben ohne Paste, etc.) sind grün.

---

## 3. SEO (91 %)

### Bestanden (Auswahl)

| Audit             | Score |
| ----------------- | ----- |
| is-crawlable      | 100 % |
| document-title    | 100 % |
| meta-description  | 100 % |
| http-status-code  | 100 % |
| link-text         | 100 % |
| crawlable-anchors | 100 % |
| hreflang          | 100 % |

### Fehlgeschlagen

| Audit          | Score | Maßnahme                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **robots.txt** | 0 %   | **Umgesetzt:** `src/robots.txt` mit minimal gültigem Inhalt (`User-agent: *` + `Disallow:` leer = alles erlauben). Wichtig: Server **muss** aus **`dist/browser`** bedienen; bei SPA-Fallback liefert `/robots.txt` sonst **index.html** → der Parser sieht HTML und meldet viele Fehler (z. B. „40 errors“). Also: `npx serve dist/browser -s` und nur die Root-URL testen. |

---

## Umgesetzte Anpassungen (aus diesem Lauf)

1. **robots.txt** – Datei `apps/frontend/src/robots.txt` mit `User-agent: *`, `Allow: /` und optionalem Sitemap-Hinweis; Asset-Konfiguration in `angular.json`, sodass die Datei als `robots.txt` im Root des Build-Outputs (`dist/browser/`) liegt.

---

## 4. Accessibility (100 % – Backlog DoD ≥ 90)

- **Prüfung:** `cd apps/frontend && npm run lighthouse:a11y` (nutzt `LIGHTHOUSE_URL` oder startet eigenen Serve aus `dist/browser`).
- **Ergebnis (2026-02-25):** Accessibility-Score **100 %** – DoD-Anforderung „kein Rückgang unter 90“ erfüllt.
- **Wiederholung:** Vor relevanten UI-Änderungen oder vor Release erneut ausführen.

---

## Empfehlungen

- **Performance:** Wie in der vorherigen Analyse (font-display, CLS, Unused JS, Cache in Production).
- **Best Practices:** Keine weiteren Pflichtmaßnahmen; „errors-in-console“ im Lighthouse-Kontext als testbedingt einstufen. Bei Deployment mit Backend erneut prüfen.
- **SEO:** Nach dem nächsten Build Lighthouse erneut ausführen – **robots.txt** sollte dann gültig sein und der SEO-Score steigen (Ziel nahe 100 %).
