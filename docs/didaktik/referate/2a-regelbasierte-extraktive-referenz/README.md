<!-- markdownlint-disable MD013 -->

# Referat 2A: Regelbasierte und extraktive Referenz des Moderationskompasses

**Kurs:** Cloud Computing (DSCC012701), Referatsprüfung, Gruppenreferat Thema 2 · **Autor:** Tino Heinisch · **Untersuchter Stand:** `main`, Commit `efd71b44` vom 07.11.2026, der letzte Stand der Linie 1.3 vor der Vorbereitung von Release 1.4.0 (frühere Messreihen auf `a657798e` vom 20.10.2026 und `9f230abc` vom 04.11.2026) · **Auftrag:** [Gruppenauftrag 2A](../../CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#gruppenauftrag-2a-regelbasierte-und-extraktive-referenz)

**Leitfrage:** Welche Lageeinschätzung liefern Regelkern und extraktiver Fallback von Release 1.3, wenn die generative Unterstützung gezielt ausgeschaltet wird?

Dieser Ordner enthält die Evidenz zum Handout: Rohdaten, Messskripte, Rubrik, Bewertung und Entscheidung. Alle Versuche liefen gegen das unveränderte Repository; die Messskripte rufen ausschließlich vorhandene Funktionen auf und reproduzieren die Referenzwerte aus `libs/shared-types/src/moderation-prompt-context-fixtures.ts` exakt.

**Belegkarte:** Welche Datei und welche Zeile jede Aussage aus Folien und Handout belegt, steht in [BELEGE.md](./BELEGE.md).

## Messstände

Die erste Messreihe lief auf `a657798e` (20.10.2026), die zweite nach dem Abgleich mit `main` auf `9f230abc` (04.11.2026). Am 07.11.2026 erschien Release 1.4.0; maßgeblich ist deshalb der letzte Stand der Linie 1.3, `efd71b44` (07.11.2026, `package.json` 1.3.0). Darauf wurden am 08.11.2026 alle Versuche in einem sauberen Klon wiederholt. Die Berichte tragen den Commit im Dateinamen; die Rohdateien der E3b-Läufe liegen in `evidence/E3/9f230abc/` und `evidence/E3/efd71b44/`.

- E1 (72 Läufe), E1b und E2 (K1–K9) sind auf `efd71b44` inhaltlich identisch mit `9f230abc`; der Regelkern (`moderation-compass-rules.ts`) und die Score-Formeln sind unverändert.
- Der extraktive Fallback wurde am 05.11.2026 geändert (`moderationSummaryContext.ts`, `qaSummaryExtractive.ts`): Bei weniger als 100 Fragen bleiben höchstens 3 statt 4 Fragekandidaten, die Ausgabe zeigt Fragen im Wortlaut und einen allgemeinen Hinweis auf den Rückfall. E3a und E3b ändern sich entsprechend; die Rubrikbewertung ist in [bewertung-efd71b44.md](./evidence/E4/bewertung-efd71b44.md) neu angewendet.
- E5 schwankt zwischen Läufen und Ständen (500 Fragen, p95: 9,7 ms auf `a657798e`, 19,1 ms auf `9f230abc`, 14,0 ms auf `efd71b44`); die Größenordnung bleibt Millisekunden.
- Die Messskripte sind unverändert bis auf eine Korrektur in `e3b-report.mjs`: Der Hinweistext der Ausgabe wird jetzt aus den Rohdaten übernommen statt als fester Text.
- Dieser Branch basiert auf `9f230abc`. Zum Wiederholen der Messung auf `efd71b44` diesen Ordner in einen Checkout von `efd71b44` kopieren.

## Ergebnisse

| Versuch                                                                    | Befund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidenz                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| E1: Sechs-Fragen-Szenario aus #456 §12 durch den Regelkern (72 Läufe)      | Bei N = 200 erscheinen Reibung (E, F) und Themen (»linearen«, »Regression«). Die Prüfungsorganisation (C, D) erscheint auf keiner Karte, weil der Regelkern nur über gemeinsame Wörter gruppiert. Bei N = 1000 bleibt nur die Themenkarte.                                                                                                                                                                                                                                                             | [E1](./evidence/E1/e1-efd71b44.md), [E1b](./evidence/E1/e1b-button-efd71b44.md)                          |
| E2: Gegenfälle                                                             | Eine ungeprüfte Frage mit hoher Kontroversität erscheint in der Klärungs-, nicht in der Reibungskarte (K9; im Releasepfad unerreichbar, da Stimmen auf PENDING abgelehnt werden). Fehlende Stimmdaten erzeugen dieselbe Ausgabe wie 0 Stimmen. Eine einzelne ungeprüfte Frage ohne Stimme verdrängt den Kontroversen-Hinweis aus „Als Nächstes“; bleibt eine Karte übrig, entfällt der Vorschlag. Das Label „umstritten“ gilt für E (40:40) nur bis N = 790, für A (80:30) schon in Räumen bis N = 90. | [E2](./evidence/E2/e2-efd71b44.md)                                                                       |
| E3: Extraktiver Fallback über den Releasepfad (Backend, PostgreSQL, Redis) | 59 von 59 Anfragen lieferten ein Ergebnis (`disabled`, `unavailable`, `circuit_open`, `timeout`). Jeder Lauf zeigte nur C, E, F: Die drei Plätze für Fragen gehen an die durch Kompass-Signale geschützten Fragen (umstritten: E, F; angeheftet: C). A, B und D fehlten immer; der Übungswunsch ist im Fallback unsichtbar. Ein allgemeiner Hinweis kündigt den Rückfall an, Grund und Auswahlgrenze nicht. Auf `9f230abc` (4 Plätze) fehlten A und B.                                                 | [E3](./evidence/E3/e3b-efd71b44.md)                                                                      |
| E4: Rubrik (fünf Dimensionen, vorab festgelegt)                            | Beste nichtgenerative Variante 5/10, ebenso die ungefilterte Liste; beide extraktiven Varianten 4/10. Keine Variante erfüllt Bedeutung der Bewertungen, Trennung der Anliegen und Vollständigkeit zugleich.                                                                                                                                                                                                                                                                                            | [Bewertung](./evidence/E4/bewertung-efd71b44.md), [erste Bewertung](./evidence/E4/bewertung-a657798e.md) |
| E5: Rechenaufwand                                                          | Regelkern inklusive Wortextraktion 14,0 ms (p95) bei 500 Fragen; extraktiver Fallback 108 ms Serverzeit (Median).                                                                                                                                                                                                                                                                                                                                                                                      | [E5](./evidence/E5/e5-efd71b44.md)                                                                       |

## Entscheidung und Verbesserungsvorschläge

Der Regelkern bleibt die Basis, generative Funktionen bleiben standardmäßig aus. Die Aktivierungskriterien für die generative Kurzfassung und fünf Verbesserungen ohne neue Dienste stehen in [entscheidung.md](./evidence/entscheidung.md). Die Verbesserungen betreffen:

1. Kandidatenfilter des extraktiven Fallbacks (`apps/backend/src/lib/moderationSummaryContext.ts`): je Anliegen mindestens eine Frage erhalten oder zusätzlich nach Unterstützung ranken.
2. Stimmenverhältnis in extraktiven Belegen anzeigen.
3. Fallback-Grund und Auswahlgrenze in der Summary-Karte anzeigen.
4. „Keine Daten“ von „0 Stimmen“ unterscheiden (#456, Definition of Done).
5. Kontroversitätsschwelle für große Räume auf tatsächlich Abstimmende beziehen und prüfen.

**Gültigkeitsgrenze:** Die regelbasierte Empfehlung ist kein empirisch bestätigtes didaktisches Optimum; die Rubrik misst Informationsqualität für die Lehrperson, nicht Lernwirkung. Messungen auf einem 4-Kern-Laborrechner (WSL2), absolute Zeiten nur als Größenordnung.

## Reproduktion

Voraussetzung: Node ≥ 24.15 (`.nvmrc`), `npm ci`, `npx prisma generate`, `npm run build -w @arsnova/shared-types`. Aus `harness/`:

```bash
R=../../../../..
$R/node_modules/.bin/tsx --tsconfig $R/tsconfig.json e1-scenario.ts
$R/node_modules/.bin/tsx --tsconfig $R/tsconfig.json e1b-button.ts
$R/node_modules/.bin/tsx --tsconfig $R/tsconfig.json e2-counter.ts
$R/node_modules/.bin/tsx --tsconfig $R/tsconfig.json e3a-extractive-unit.ts
NODE_OPTIONS=--expose-gc $R/node_modules/.bin/tsx --tsconfig $R/tsconfig.json e5-bench.ts
```

E3b benötigt PostgreSQL und Redis (`docker compose up -d postgres redis`) und startet das Backend je Bedingung mit `e3b-backend.sh <C1|C2|C3|C3b>`; der Szenariotreiber ist `e3b-release-path.mjs`, die Zusammenführung `e3b-report.mjs`. Laborgeheimnisse werden je Lauf zufällig erzeugt und in der Evidenz geschwärzt. Alle Läufe richten sich ausschließlich an `127.0.0.1` bzw. `::1`.

## Dateien

| Pfad                                                                | Inhalt                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `evidence/E1` … `evidence/E5`                                       | Berichte (Markdown) und Rohdaten (JSON, Logs) je Versuch                                     |
| `evidence/tests/`                                                   | Baseline-Testläufe (`efd71b44`: 296/296, `9f230abc`: 283/283, `a657798e`: 270/270 bestanden) |
| `evidence/E4/rubrik.md`                                             | Rubrik mit Prüfregeln, vor der Bewertung festgelegt                                          |
| `evidence/literatur-verifiziert.md`, `evidence/literatur-seiten.md` | Literatur mit DOI-Prüfung und Seitenangaben                                                  |
| `harness/`                                                          | Messskripte                                                                                  |
| [BELEGE.md](./BELEGE.md)                                            | Belegkarte: jede Aussage aus Folien und Handout mit Datei, Zeile und Evidenzstufe            |
| [KI-OFFENLEGUNG.md](./KI-OFFENLEGUNG.md)                            | Protokoll der KI-Nutzung                                                                     |
