# Nachweisumfang Referat Thema 1

Was an Belegen im Repo liegt, gezählt statt geschätzt. Die Zahlen sagen, wie
viel Material zum Nachprüfen da ist, nicht, wie gut es ist; Ergebnisse und
Befunde stehen in den Hauptdokumenten der Aufträge.

Stand 17.11.2026, Branch `feature-praesentation-jonas`, Commit `e3986902`.
Alle Werte der Tabellen rechnet
[`abgabe/jonas/nachweisumfang.mjs`](abgabe/jonas/nachweisumfang.mjs) auf dem
aktuellen Checkout neu aus; `nachweisumfang.test.mjs` daneben schlägt fehl,
sobald diese Datei und der Checkout auseinanderlaufen:

```sh
node docs/referat-thema-1/abgabe/jonas/nachweisumfang.mjs   # Werte als JSON
cd docs/referat-thema-1/abgabe/jonas && node --test nachweisumfang.test.mjs
```

## Kopfzahlen

Nur Werte, deren Rohdaten und Protokolle beide auf diesem Stand liegen.

| Kennzahl                                   | Wert                                | Quelle                                                                                                                |
| ------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Gewertete Laborzeit                        | **20,3 h** (20 h 21 min, 73.235 s)  | Abschnitt [Laborzeit](#laborzeit)                                                                                     |
| Aufbau, Tests und weitere Läufe            | **29,3 h** (29 h 15 min, 105.311 s) | Abschnitt [Aufbau, Tests und weitere Läufe](#aufbau-tests-und-weitere-läufe); Rechnerzeit, getrennt von der Laborzeit |
| Automatisierte Tests                       | **328**                             | Abschnitt [Tests](#tests); ohne die Tests des Abgabe-Builds                                                           |
| ADRs                                       | **35** (1B: 13, 1C: 22)             | `ls adr/1[BC]-*.md`; 1A hat statt ADRs einen Experimentvertrag                                                        |
| Vorab festgelegte Hypothesen und Kriterien | **50**                              | Abschnitt [Hypothesen](#hypothesen-und-kriterien)                                                                     |

## Laborzeit

Dauer je Lauf aus den Zeitstempeln der Rohdaten, nicht aus Protokollangaben.
Gezählt sind nur gewertete Läufe; Vorläufe, gestörte und abgebrochene Versuche,
Entwicklungsläufe, Aufbau und modellfreie Messungen fehlen.

| Kennzahl                      | Wert                                  | Rohdaten und Zeitstempel                                                                                                                                                                              |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| davon 1A Ressourcenisolation  | 2 h 32 min (25 Läufe, 25 vollständig) | `evidenz/1A/reihe-main-a19ca70f-20261115-122547/V*/block-*/`: `lauf.json` → `warmup.manifest.startAt` bis `report.json` → `timestamp`                                                                 |
| davon 1B Schritte 1–2         | 55 min (25 Aufträge)                  | `evidenz/1B/messung/2026-11-13-lauf.json`, `-lauf-b0.json`, `-lauf-kalt*.json`: `treiber.startedAt` bis spätestes `treiber.auftraege[].finishedAt`                                                    |
| davon 1B Schritte 3–4         | 12 h 39 min (18 Läufe, 128 Aufträge)  | `evidenz/1B/messung/2026-11-1{5,6}-lauf-*-{summary,label}[-NN].json.gz`, Breaker-Folgen `-lauf-breaker-*.json`: Lauf-ID `lauf` (UTC, bei S1 `treiber.startedAt`) bis `umgebung.erfasstAm`, wie PR #26 |
| davon 1C Laborläufe           | 4 h 15 min (3 Läufe)                  | `evidenz/1C/messung/2026-11-05-labor.json.gz`, `-labor-pc.json.gz`, `2026-11-09-labor-nachlauf.json.gz`: `environment.startedAt` bis `endedAt`                                                        |
| Zeitraum der gewerteten Läufe | 5.–16.11.2026                         | erster Start bis letztes Ende der Zeilen darüber, Berliner Kalendertag                                                                                                                                |

_Aktualisiert 2026-11-17:_ 1B Schritte 3–4 zählen jetzt mit. Rohdaten, Protokolle, Schwellen
(`1B/archiv/1B-3u4-Planung.md`) und Autorenprüfung (16.11.) liegen seit dem Merge von PR #26 auf diesem Branch. Gezählt wie in
der PR-Beschreibung vom Laufbeginn (Lauf-ID) bis zur Ergebniserfassung, also samt Aufwärmen und Nachlauf; die PR
rundet je Reihe und nennt ca. 12 h 40 min. 1B Schritte 1–2 haben kein `erfasstAm` und bleiben bei Treiberstart bis
letztem Auftrag.

## Aufbau, Tests und weitere Läufe

_Ergänzt 2026-11-17:_ Rechnerzeit außerhalb der gewerteten Läufe, getrennt gezählt und nie mit der Laborzeit
addiert: Aufbau und Neuaufbau der Labore, Windows-/Hyper-V-Versuche, Entwicklungs-, Probe- und Trockenläufe,
Kalibrierung, Ursachenversuch, Messungen außerhalb der Laborläufe, Abbau. Keine Arbeitszeit; Planung, Code,
Tests und Dokumentation ohne laufendes Labor fehlen.

| Kennzahl                          | Wert                                             | Quelle                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zusätzlich 1A Ressourcenisolation | 3 h 26 min (Vorlauf; 43 gelöschte Läufe aus Git) | Vorlauf der gewerteten Reihe; dazu die in `ab1619e7` (15.11.) gelöschten Reihen und Anläufe, gelesen aus `ab1619e7^` (`evidenz/1A/README.md`: „Frühere Fassungen sind über Git erreichbar“), je Lauf gezählt wie die gewerteten; Zählung von Niklas am 17.11. bestätigt |
| zusätzlich 1B Schritte 1–2        | 23 h 19 min (29 VM-Starts, davon 11 Windows)     | VM-Laufzeit aus dem Systemjournal ohne die gewerteten Läufe: [`evidenz/1B/2026-11-17-vm-laufzeiten.md`](evidenz/1B/2026-11-17-vm-laufzeiten.md)                                                                                                                         |
| zusätzlich 1B Schritte 3–4        | 1 h 19 min (14 Zeitfenster)                      | Uhrzeiten in den Protokollen `evidenz/1B/2026-11-1{5,6}-*` (Aufbau unter Windows, Entwicklungsläufe, Kalibrierung, Abbau)                                                                                                                                               |
| zusätzlich 1C Laborläufe          | 1 h 11 min (10 Zeitfenster)                      | Uhrzeiten in `evidenz/1C/2026-11-05-labor-pc.md`, `2026-10-24-teil2.md`, `-teil3.md`; Probe- und Trockenläufe aus `environment.startedAt` bis `endedAt`                                                                                                                 |

Jedes Zeitfenster steht mit Datei und wörtlichem Beleg in `FENSTER` in
[`abgabe/jonas/nachweisumfang.mjs`](abgabe/jonas/nachweisumfang.mjs); der Test prüft, dass jeder Beleg in seiner
Datei steht. Nur Fenster mit Anfang und Ende (oder einer Dauer) zählen. Nicht gezählt: Windows-Versuche 4 und 5
ohne Uhrzeit (im VM-Journal enthalten), Entwicklungsläufe 1B 3–4 mit nur einer Startzeit, der doppelte Vorlauf `reihe-2026-11-12/vorlauf/` (gleiche Zeitstempel wie `vorlauf/`). Für Niklas'
Windows-Rechner gibt es kein Journal im Repo; seine PR nennt für Entwicklungs- und Diagnoseproben rund 1 h 20 min.

## Tests

Statisch gezählt, nicht ausgeführt: Zeilen, die mit `test(` oder `it(`
beginnen (node:test, Vitest), bei Pester mit `It '…'`. Tests in Schleifen
zählen einmal. Gezählt werden getrackte und nicht ignorierte Dateien des
Checkouts. „Neu“ und „geändert“ beziehen sich auf den letzten Upstream-Stand im
Fork, `21734265` (`git merge-base upstream/main HEAD`); bei geänderten Dateien
zählt die Differenz der Testzeilen.

| Kennzahl            | Wert                                        | Dateien                                                                   |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Messwerkzeuge 1B/1C | 128 (23 Dateien)                            | `docs/referat-thema-1/evidenz/**/*.test.mjs`                              |
| Pester 1B (Windows) | 57 (3 Dateien)                              | `docs/referat-thema-1/evidenz/1B/**/*.Tests.ps1`                          |
| 1A Lastwerkzeuge    | 108 (16 neue Dateien)                       | `scripts/load/**/*.test.mjs`, neu seit `21734265`                         |
| Backend 1C          | 35 (4 neue Dateien, netto +1 in geänderten) | `apps/backend/src/__tests__/*.test.ts`, neu oder geändert seit `21734265` |

Nicht in den Kopfzahlen: die Tests des Abgabe-Builds unter `abgabe/` (Folien,
Handout, Deck). Sie prüfen die Präsentation, nicht die Belege, und ändern sich
mit jeder Folienänderung; das Skript gibt sie als `tests.gruppen.abgabe` und
die Summe mit ihnen als `kopfzahlen().testsMitAbgabe` aus.

## Hypothesen und Kriterien

Gezählt sind Kennungen, die in einem Design oder Vertrag vor dem jeweiligen
Lauf festgelegt wurden, je an ihrer definierenden Stelle (Tabellenzeile oder
fett gesetzter Listenpunkt). E6a und E6b zählen getrennt, weil sie getrennte
Kriterien haben.

| Kennzahl               | Wert | Datei                                                                                    |
| ---------------------- | ---- | ---------------------------------------------------------------------------------------- |
| 1A (Experimentvertrag) | 2    | `1A/1A-experiment-contract.md` (H1, H2)                                                  |
| 1B Schritte 1–2        | 5    | `specs/2026-11-12-1b-zwei-host-design.md` (H_B0–H_B3, H_C0)                              |
| 1B Schritte 3–4        | 6    | `1B/archiv/1B-3u4-Planung.md` (H2-Fehler, H2-Latenz, H2-Fallback, H-F1, H-F1F2, H-Queue) |
| 1C Einzeltests E       | 16   | `specs/2026-10-24-1c-teil2-design.md`, `-teil3-design.md` (E1–E15, E6 als E6a, E6b)      |
| 1C Messungen M         | 7    | `specs/2026-10-24-1c-teil2-design.md`, `-teil3-design.md` (M1–M7)                        |
| 1C Labor L             | 6    | `specs/2026-10-25-1c-labor-design.md` (L1–L6)                                            |
| 1C Nachlauf N          | 6    | `specs/2026-11-06-1c-nachlauf-design.md` (N1–N6)                                         |
| 1C Gate-Ablation H_A   | 2    | `evidenz/1C/2026-11-16-gate-ablation.md` (H_A1, H_A2)                                    |

Nicht gezählt: die beschreibende S1-Prüfung aus den Nachträgen der Planung und die Testfälle T… des Testdesigns
`specs/2026-10-24-1c-tests-design.md`.

## Darstellung

Auf Folien und im Handout nur Zahl und Pfad, ohne Wertung wie „umfangreich“. _Ergänzt 2026-11-17:_ GD zeigt die
vier Kopfzahlen, den Zeitraum und die Laborzeit je Auftrag als Balken; Reservefolie R17 zeigt alle Zeilen dieser
Datei. Beide lesen die Werte aus dieser Datei (`ladeNachweis` in `abgabe/jonas/folien.mjs`). _Aktualisiert
2026-11-18:_ Kopfzahlen, Balken und gerafft Tests und Hypothesen je Auftrag stehen auf GN vor dem Dank; R17
entfällt, GD zeigt keine Zahlen mehr.
Verworfene und gestörte Läufe stehen mit Grund in den Protokollen unter
`evidenz/`; wer die Laborzeit nennt, nennt sie als gewertete Zeit. Commit- und
Zeilenzahlen sind kein Aufwandsmaß und gehören nicht hierher.
