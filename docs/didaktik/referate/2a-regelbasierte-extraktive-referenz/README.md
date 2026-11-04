<!-- markdownlint-disable MD013 -->

# Referat 2A: Regelbasierte und extraktive Referenz des Moderationskompasses

**Kurs:** Cloud Computing (DSCC012701), Referatsprüfung, Gruppenreferat Thema 2 · **Autor:** Tino Heinisch · **Untersuchter Stand:** `main`, Commit `9f230abc` vom 04.11.2026 (Linie 1.3; erste Messreihe auf `a657798e` vom 20.10.2026) · **Auftrag:** [Gruppenauftrag 2A](../../CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#gruppenauftrag-2a-regelbasierte-und-extraktive-referenz)

**Leitfrage:** Welche Lageeinschätzung liefern Regelkern und extraktiver Fallback von Release 1.3, wenn die generative Unterstützung gezielt ausgeschaltet wird?

Dieser Ordner enthält die Evidenz zum Handout: Rohdaten, Messskripte, Rubrik, Bewertung und Entscheidung. Alle Versuche liefen gegen das unveränderte Repository; die Messskripte rufen ausschließlich vorhandene Funktionen auf und reproduzieren die Referenzwerte aus `libs/shared-types/src/moderation-prompt-context-fixtures.ts` exakt.

## Messstände

Die erste Messreihe lief auf `a657798e` (20.10.2026). Nach dem Abgleich mit `main` wurden am 04.11.2026 alle Versuche auf `9f230abc` wiederholt. Die Berichte tragen den Commit im Dateinamen; die Rohdateien des zweiten E3b-Laufs liegen in `evidence/E3/9f230abc/`.

- E1 (72 Läufe), E2 (K1–K9) und E3a sind inhaltlich identisch. Anders ist nur die Beschriftung von Themenquellen: Die Beispielfrage steht als eigene Belegzeile.
- E3b bestätigt Inhalt (E, C, D, F; nie A, B), Scores und das Verhalten des Schutzschalters.
- E5: Der Rechenaufwand des Regelkerns ist gestiegen, verursacht durch die neue Quellenaufbereitung im Präsentationsadapter ([Vergleich und CPU-Profil](./evidence/E5/e5-vergleich-9f230abc.md)).
- E1b ist neu: Der Kompass-Button erscheint ab `9f230abc` nur mit Handlungsempfehlung und ist in allen 72 Kombinationen sichtbar.

## Ergebnisse

| Versuch                                                                    | Befund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidenz                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| E1: Sechs-Fragen-Szenario aus #456 §12 durch den Regelkern (72 Läufe)      | Bei N = 200 erscheinen Reibung (E, F) und Themen (»linearen«, »Regression«). Die Prüfungsorganisation (C, D) erscheint auf keiner Karte, weil der Regelkern nur über gemeinsame Wörter gruppiert. Bei N = 1000 bleibt nur die Themenkarte.                                                                                                                                                                                                                                                             | [E1](./evidence/E1/e1-9f230abc.md), [E1b](./evidence/E1/e1b-button-9f230abc.md)                      |
| E2: Gegenfälle                                                             | Eine ungeprüfte Frage mit hoher Kontroversität erscheint in der Klärungs-, nicht in der Reibungskarte (K9; im Releasepfad unerreichbar, da Stimmen auf PENDING abgelehnt werden). Fehlende Stimmdaten erzeugen dieselbe Ausgabe wie 0 Stimmen. Eine einzelne ungeprüfte Frage ohne Stimme verdrängt den Kontroversen-Hinweis aus „Als Nächstes“; bleibt eine Karte übrig, entfällt der Vorschlag. Das Label „umstritten“ gilt für E (40:40) nur bis N = 790, für A (80:30) schon in Räumen bis N = 90. | [E2](./evidence/E2/e2-9f230abc.md)                                                                   |
| E3: Extraktiver Fallback über den Releasepfad (Backend, PostgreSQL, Redis) | 62 von 62 Anfragen lieferten ein Ergebnis (erste Messreihe: 59 von 59) (`disabled`, `unavailable`, `circuit_open`, `timeout`). Jeder Lauf zeigte E, F, C, D; die meistunterstützte Frage A fehlte immer, weil der Kandidatenfilter (max. 4 Fragen) nach Best-Score auffüllt und die Wilson-Untergrenze 12:0 vor 80:30 stellt. Der Fallback-Grund ist im UI nicht sichtbar.                                                                                                                             | [E3](./evidence/E3/e3b-9f230abc.md)                                                                  |
| E4: Rubrik (fünf Dimensionen, vorab festgelegt)                            | Beste nichtgenerative Variante 5/10, ebenso die ungefilterte Liste. Keine Variante erfüllt Bedeutung der Bewertungen, Trennung der Anliegen und Vollständigkeit zugleich.                                                                                                                                                                                                                                                                                                                              | [Bewertung](./evidence/E4/bewertung-a657798e.md), [Bestätigung](./evidence/E4/bewertung-9f230abc.md) |
| E5: Rechenaufwand                                                          | Regelkern inklusive Wortextraktion 14,8 ms (p95) bei 500 Fragen (erste Messreihe 9,7 ms); extraktiver Fallback 143 ms Serverzeit (Median).                                                                                                                                                                                                                                                                                                                                                             | [E5](./evidence/E5/e5-9f230abc.md)                                                                   |

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

| Pfad                                                                | Inhalt                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `evidence/E1` … `evidence/E5`                                       | Berichte (Markdown) und Rohdaten (JSON, Logs) je Versuch                |
| `evidence/tests/`                                                   | Baseline-Testläufe (`9f230abc`: 283/283, `a657798e`: 270/270 bestanden) |
| `evidence/E4/rubrik.md`                                             | Rubrik mit Prüfregeln, vor der Bewertung festgelegt                     |
| `evidence/literatur-verifiziert.md`, `evidence/literatur-seiten.md` | Literatur mit DOI-Prüfung und Seitenangaben                             |
| `harness/`                                                          | Messskripte                                                             |
| [KI-OFFENLEGUNG.md](./KI-OFFENLEGUNG.md)                            | Protokoll der KI-Nutzung                                                |
