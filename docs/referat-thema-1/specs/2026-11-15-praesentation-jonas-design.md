# Design: Folien und Handout von Jonas (1C und 1B Schritte 1–2)

- **Stand:** 2026-11-15, Entwurf der KI aus dem Brainstorming mit dem Autor
- **Autor:** Jonas Weirauch (Rolle Y)
- **Grundlage:** [1C-Gerüst](../1C-praesentation-geruest.md), [1B-Gerüst](../1B-praesentation-geruest.md), [1C-Ergebnis](../1C-ergebnis.md), [1B-Ergebnis](../1B-ergebnis.md)
- **Stilproben:** Artefakt „Folien-Mischung 1C/1B“ (Richtung M: Rahmen A, Messwerkzeuge B, Fußballfeld C); nicht im Repo
- _Aktualisiert 2026-11-15:_ Das Handout entsteht in PaperLab (Typ `referat`, IU-Gestaltungs- und Zitierleitfaden), nicht mehr als HTML in `bau.mjs`; `--abgabe` entfällt. Folien tragen Kurzbelege nach ZL in der Fußzeile, J16 zeigt das Literaturverzeichnis. Der Clip auf J13 stammt aus dem Laborlauf vom 2026-11-15 ([Protokoll](../evidenz/1B/2026-11-15-clip.md)). Anlass: Hinweise des Autors vom selben Tag.
- _Aktualisiert 2026-11-16:_ Nach einem visuellen und fachlichen Audit: J11 (Betrieb) ist Reserve R13, J16 (Literaturverzeichnis) steht als Anhang nach G9, neue Reserve R14 „Einordnung Cloud Computing“ (Rechnung aus dem Code, keine Messung). Zielzeit G0 bis J16 etwa 10:30 min (J2, J4, J8, J15 gekürzt). J9 als Punktdiagramm auf der Log-Achse, Fußzeilen nur mit Kurzbelegen; Rechner und Commit stehen in den Sprechnotizen und im Manifest. Die Tabelle unten bleibt der Stand des Designs.

## 1. Absicht

Jonas hält ein Referat, das als das beste des Kurses in Erinnerung bleibt: fachlich so belegt, dass ein skeptischer Prüfer nichts findet, und so gestaltet, dass man ohne Vorwissen folgen kann. Der Wow-Effekt soll aus den Inhalten kommen (echte Artefakte, eine durchgehende Geschichte, ein Bild, das man behält), nicht aus Effekten.

## 2. Rahmen und Vorgaben

| Punkt                | Festlegung                                                                                                                                                                                                                                                        | Quelle                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Format               | Online-Vorlesung, Bildschirmfreigabe; kein Beamer                                                                                                                                                                                                                 | Autor, 2026-11-15                                                                                          |
| Zeit                 | Vortrag Jonas etwa 12 min, danach Befragung. Das Prüfungsdokument sieht 15 min inklusive Befragung vor; der Autor plant bewusst mit 12–13 min Vortrag, weil der Prüfer bei anderen kaum nachgefragt hat. Kürzung auf etwa 7:30 ist in den Sprechnotizen markiert. | Autor; [Prüfungsdokument Z. 18, 115](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md)                   |
| Handout              | ein Handout für 1C und 1B 1–2, höchstens 5 DIN-A4-Seiten, 350–1.800 Wörter, PDF, mit Literaturliste, ad personam gekennzeichnet                                                                                                                                   | [00-rahmen Z. 55](../00-rahmen-und-pruefung.md), [1C-Gerüst Rahmen](../1C-praesentation-geruest.md#rahmen) |
| Abgabe               | Handout und Folien als PDF 48 h vor der Prüfung                                                                                                                                                                                                                   | [00-rahmen, Frage 5](../00-rahmen-und-pruefung.md)                                                         |
| Name, Matrikelnummer | nur im Abgabe-PDF, nie im Repo                                                                                                                                                                                                                                    | [1C-Gerüst Rahmen](../1C-praesentation-geruest.md#rahmen), Ordnerregeln                                    |
| Zahlen               | jede Zahl mit Rechner und Commit, aus ADR oder Protokoll, keine eigenen Herleitungen                                                                                                                                                                              | [AGENTS.md](../AGENTS.md)                                                                                  |

## 3. Reihenfolge der Gruppe

Niklas eröffnet mit 1A, Jonas erzählt den Auftrag am Stück (1C und 1B 1–2 verwoben), Niklas schließt mit 1B 3–4. Zwei Sprecherwechsel. Das ändert die Empfehlung in [01-aufteilung](../01-aufteilung.md#gemeinsame-präsentation-empfehlung-offen) (1A → 1B 1–2 → 1B 3–4 → 1C) und braucht Niklas' Zustimmung. Übergänge:

- von 1A: „Was, wenn wir die schwere Arbeit auslagern?“
- zu 1B 3–4: „Und wenn der zweite Host langsam ist oder ausfällt?“

_Ergänzt 2026-11-16:_ Das gemeinsame Deck folgt jetzt dieser Reihenfolge (vorher eröffnete Jonas mit G0):
Titel und Fahrplan (Niklas), 1A, Jonas, 1B 3–4, Fazit und Dank (Niklas); Einzelheiten im
[Gesamtdesign](2026-11-16-gesamtpraesentation-design.md#reihenfolge-nach-design-3-rahmenfolien-designregeln-ergänzt-2026-11-16).

Gemeinsamer Rahmen als Entwurf für beide: Einstiegsfolie (Thema 1, wer macht was, Systembild) und Kurzfazit am Ende.

**Ein gemeinsames Deck** (Autor, 2026-11-15): Eine Person teilt von Anfang bis Ende. Das Deck enthält Rahmen, 1A, Jonas' Teil und 1B 3–4 in dieser Reihenfolge. Niklas' Teile kommen als Abschnitte hinein: zunächst als Seiten seines PDFs (16:9, als Bilder eingebettet), später auf Wunsch in der gemeinsamen Vorlage nachgebaut. Für die Abgabe exportiert der Bau je Person ein eigenes Folien-PDF (eindeutig zugeordnet, Prüfungsdokument Z. 115) und das gemeinsame Vortragsdeck. Jonas' Teil muss auch allein vollständig funktionieren, falls die Gruppe doch getrennt teilt.

## 4. Roter Faden

„Ein Klick. 148 Sekunden. Keine Modellantwort.“ Ein echter Summary-Auftrag wird vom Klick der Lehrperson bis zur Ersatzzusammenfassung verfolgt. Jede Station ist mit 1C oder 1B etikettiert (Petrol und Bernstein), damit der Eigenanteil je Auftrag sichtbar bleibt. Jede Folie folgt dem Muster Frage → Mechanismus → Zahl → Beleg.

## 5. Folienplan (etwa 12 min)

| Nr. | Folie                                                                    | Auftrag | Zeit |
| --- | ------------------------------------------------------------------------ | ------- | ---- |
| J1  | Titel und Leitfragen                                                     | 1C, 1B  | 0:40 |
| J2  | Labor: Release 1.3 mit einem Befehl nachgebaut, Abweichungen offengelegt | 1B      | 1:00 |
| J3  | Weg des Auftrags (Karte über beide Hosts)                                | beide   | 0:40 |
| J4  | Nachweiskette: Hypothesen vorab, modellfreie Tests, dann Labor           | beide   | 0:50 |
| J5  | Klick → Queue: Entkopplung                                               | 1C      | 0:45 |
| J6  | Kontext und Vertrag mit echtem Nutzlast-Ausschnitt                       | 1C      | 1:00 |
| J7  | Kosten der Kontextbereitstellung                                         | 1C      | 0:45 |
| J8  | Über die Grenze: Mitschnitt mit t₀–t₃ und echten Zeitstempeln            | 1B      | 0:50 |
| J9  | Zeitzerlegung, Log-Achse mit Schwellen, kalt und warm                    | 1B      | 0:50 |
| J10 | Fußballfeld mit Zoom bis 0,3 mm                                          | 1B      | 0:25 |
| J11 | Betrieb: Timeout 90 s zu kurz, Prompt-Cache bis zum OOM-Kill             | 1C      | 0:50 |
| J12 | Nachprüfung und Blitzlicht-Hash                                          | 1C      | 0:50 |
| J13 | Gate: echte Modellantwort, Ablehnung, Clip aus der Lehrenden-Sicht       | 1C, 1B  | 1:10 |
| J14 | Was der Betrieb nicht sieht (#19, #20)                                   | 1B      | 0:40 |
| J15 | Entscheidung, drei Diskussionsfragen, Übergabe an Niklas                 | beide   | 0:50 |

Reservefolien (nicht im Vortrag, sofort aufrufbar): Kalibrierung, Kontrolle C0, Ausfall B0, Kaltläufe n = 5 im Detail, Gültigkeitsgrenzen, KI-Anteil, ADR-Zählung 1C. B0 bleibt Reserve, weil Störung und Ausfall Niklas' Teil sind.

## 6. Gestaltung (Richtung M)

- **Rahmen aus Niklas' Folien:** weißer Grund, sein Blau für Titel und Pfad, Fußzeile mit Seitenzahl und Quellenzeile.
- **Messwerkzeuge:** Messwerte, IPs, Commits und t₀–t₃ in IBM Plex Mono; Text in Inter. Host-Kästen mit IP; Tabelle Hypothese, Schwelle, Urteil.
- **Raster** nur in Diagrammflächen und Host-Kästen, nie ganzflächig.
- **Farben:** 1C Petrol, 1B Bernstein, Ablehnung Rot; Farbe trägt nie allein Bedeutung (immer mit Etikett).
- **Bildschirmfreigabe:** Folie 1600 × 900, Schrift ab 22–24 px, keine Linie unter 2 px; geprüft als Bildschirmfoto in Originalgröße und verkleinert auf etwa 960 px Breite (Fenster neben der Kameragalerie).
- **Diagramme:** von Hand als SVG gezeichnet, keine Mermaid-Grafiken auf Folien; Daten-Diagramme per Skript aus den Ergebnis-JSONs erzeugt, nicht abgetippt.

## 7. Wow-Elemente

1. **Wandernder Auftrag:** Im Browser-Deck läuft ein Punkt von Folie zu Folie den Weg entlang; im PDF steht er an der jeweiligen Station.
2. **Zoom ins Fußballfeld:** vom ganzen Feld (105 m ≙ 148 s) bis auf 0,3 mm (Netz); Maßstab exakt aus den Medianen.
3. **Echte Artefakte:** Zeitstempel aus der Zeitzerlegung, ein Ausschnitt der Nutzlast aus der synthetischen Fixture, eine echte Modellantwort, die das Gate verwirft. Nie Token, Header mit Token, `.env`-Inhalte oder Mitschnitte selbst.
   - _Entscheidung der KI:_ Die abgelehnte Antwort liegt bisher nur im Rohmitschnitt (`~/labor-1b/20261113T081452/http.tsv`, neben dem Token). Ein neuer, datierter Ausschnitt unter `evidenz/1B/messung/` enthält nur Modellausgabe und Prüfergebnis des Tors (ohne Header, ohne Token), mit SHA-256 der Quelldatei. Der Bau liest diesen Ausschnitt; eingefrorene Protokolle bleiben unverändert.
   - _Entscheidung der KI:_ Zeitstempel t₀–t₃ kommen aus den committeten Ergebnis-JSONs (`2026-11-13-lauf.json`), nicht aus dem Mitschnitt. Der Bau läuft damit ohne Labor.
4. **Clip aus dem Labor:** etwa 10 s Lehrenden-Sicht (Klick, Warten, Ersatzzusammenfassung). Braucht einen Laborlauf; nur nach ausdrücklicher Freigabe des Autors, Hypothese entfällt (kein gewerteter Lauf, Tag `dev-…`). Der Clip (WebM, etwa 1–3 MB) kommt nach `abgabe/`; das PDF zeigt ein Standbild daraus. Ohne Freigabe zeigt J13 einen gezeichneten Nachbau der Lehrenden-Ansicht mit der echten Ersatzzusammenfassung aus dem Lauf (Autor, 2026-11-15).

## 8. Vorführung und Bau

- **Browser-Deck:** eine HTML-Datei, Vollbild, Pfeiltasten, ohne Internet lauffähig, keine neuen Abhängigkeiten, `prefers-reduced-motion` respektiert, Clip eingebettet.
- **Schriften** (_Entscheidung der KI_): Inter und IBM Plex Mono (beide SIL OFL) als woff2 mit Lizenzdatei unter `abgabe/`, damit Deck und PDF auf jedem Rechner gleich aussehen.
- **PDF:** aus derselben Quelle mit Playwright gerendert (wie bei Niklas), Folien 16:9 und Handout A4.
- **Ablage:** `docs/referat-thema-1/abgabe/` neben Niklas, eigene Dateinamen (`jonas-…`), erst nach Niklas' Merge. Bauskript und Test daneben; Zahlen per Skript aus `evidenz/` eingesetzt; Manifest mit Prüfsummen wie bei Niklas.
- **Matrikel:** Der Bau liest Namen und Matrikelnummern aus einer nicht versionierten Datei außerhalb des Repos; im Repo stehen Platzhalter.

## 9. Handout

1. **Seite 1:** Kopf (Namen, ad personam), Kasten mit Kurzantwort, Weg-Grafik, Leitfragen.
2. **Seite 2:** Abschnitt 1C (Jonas): Hypothesen, Nachweis, Urteil als Tabelle.
3. **Seite 3:** Abschnitt 1B Schritte 1–2 (Jonas): Aufbau, Zeitzerlegung, H_B1–H_B3 und M2–M4.
4. **Seite 4:** Befunde, Entscheidung, Gültigkeitsgrenzen.
5. **Seite 5:** Quellen, Evidenzort, KI-Offenlegung.

## 10. Diskussion

- Fragenkatalog mit Antworten und Belegstellen (aus beiden Gerüsten, ergänzt), nur zum Üben.
- Sprechnotizen je Folie mit Sekunden und markierter Kürzung auf etwa 7:30.
- Drei Diskussionsfragen auf J15.

## 11. Abnahme

1. **Fachliche Review-Schleife:** frischer, skeptischer Reviewer prüft jede Zahl gegen Quelle, Rechner und Commit, jede Aussage gegen Belege, Ad-personam-Kennzeichnung, Wortgrenzen und Prüfungsvorgaben. Wiederholen mit jeweils neuem Reviewer, bis nur noch Banales kommt.
2. **Danach visuelle Schleife:** Lesbarkeit bei Bildschirmfreigabe, Hierarchie, Abstände, Konsistenz zwischen Folien, Handout und Niklas' Teil; ebenso bis nur noch Banales kommt.

## 12. Nicht-Ziele

- Keine Änderung an Produktionscode, keine neuen npm-Abhängigkeiten.
- Keine neuen gewerteten Messungen; der Clip ist Illustration, kein Nachweis.
- Kein Ersatz für Niklas' Folien; der Rahmen ist ein Angebot.

## 13. Offen

- Zustimmung von Niklas zur Reihenfolge, zum gemeinsamen Deck und zum gemeinsamen Rahmen; ob er seine Folien in die Vorlage überträgt.
- Freigabe des Laborlaufs für den Clip.
- Zeitregel: ob der Prüfer 12–13 min Vortrag akzeptiert (Annahme des Autors, nicht bestätigt).
