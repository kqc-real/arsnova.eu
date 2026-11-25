# Design: 1C Teil 3 – restliche Pfade, voller #456-Kontext und `source_changed` unter Voting

- **Stand:** 2026-10-24
- **Autor:** Jonas Weirauch
- **Issue:** [#10](https://github.com/NiklasSkulll/arsnova.eu/issues/10); PR [#12](https://github.com/NiklasSkulll/arsnova.eu/pull/12), Abschnitt „Noch zu tun für 1C“
- **Codebasis:** `main` `248029dc`, wie in Teil 1 und 2
- **Vorgänger:** [Teil 1](2026-10-24-1c-tests-design.md), [Teil 2](2026-10-24-1c-teil2-design.md). Infrastruktur (Fixture, Test-Runtime, Messdatei, Auswertungsskript) wird aus Teil 2 wiederverwendet.
- **KI-Nutzung:** Entwurf mit Claude Code (Modell Claude Opus 5.5), vom Autor vor der Ausführung freigegeben; siehe Abschnitt 8.

## 1. Zweck

Nach Teil 2 sind in 1C ohne Laborinstanz noch vier Dinge offen:

1. **Pfade, die bisher nur statisch belegt sind:**
   - volle Queue bzw. ein belegter Inferenz-Slot (`queue_full`, `busy`; G7 aus Issue #10);
   - CONFLICT, wenn sich beim Kontextaufbau ein abgesicherter Wert ändert (N9);
   - der Legacy-Text-Adapterpfad. Dazu gehört die Aussage aus Befund 5: Nur dort ist das Verwerfen unbekannter Quellen-IDs beim Binden erreichbar.
2. **Voller #456-Kontext als Nutzlast:** Die Aufgabe verlangt den „vollständigen zulässigen #456-Kontext aus dem Releasebuilder“. Teil 2 lief mit einem reduzierten Kontext ohne Themen, Lernziele, Blitzlicht und freigegebene Quizergebnisse.
3. **Anteil von `source_changed` bei laufendem Voting (H3):** Befund 3 sagt nur „kann so enden; Häufigkeit nicht gemessen“.
4. **Issue zu Befund T2.3:** Der Text wird vorbereitet. Angelegt wird das Issue nur nach Freigabe durch den Autor, weil es öffentlich ist.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**

- E-Tests E10–E15 in derselben Suite wie Teil 2, CI-fähig.
- Messung M6 (voller Kontext) und M7 (`source_changed` unter Voting), lokal und opt-in.
- Je Fall H, G und K vorab festgelegt; je Test eine Mutationsprobe.

**Nicht-Ziele**

- **Kein Modelllauf, auch nicht lokal** (Entscheidung des Autors). Der reale Lauf bleibt Aufgabe der Laborinstanz.
- Keine Änderung am Produktivcode.
- Keine Lastmessung von Liveaktionen.

**Anti-Ziele**

- Ein CONFLICT, der nur durch einen Mock des Prüfgegenstands entsteht. Die Datenänderung muss echt in PostgreSQL passieren, während der echte Kontextaufbau läuft.
- Ein „voller Kontext“, in dem Bereiche zwar vorhanden, aber leer oder `unavailable` sind. Jeder Bereich muss nachweislich `available` sein.
- Häufigkeiten aus zu wenigen Läufen ohne Unsicherheitsangabe.

## 3. Aufbau

- **Fixture:** Sechs-Fragen-Szenario aus #456 Abschnitt 12 (Teil 2, N = 200).
- **Erweiterung „voller Kontext“:** Ein neuer Helfer reichert die Session an. Welche Funktionen und Schlüssel der Code tatsächlich liest, klärt der Plan am Code.
  - **Semantische Themen:** ein gültiger `QaSemanticTopicSnapshot` in Redis, dessen Mitglieder Fixturefragen sind (A/B, C/D, E/F als Themen), mit `WORD_CLOUD_SEMANTIC_ENABLED=true`.
  - **Lernziele:** mindestens ein bestätigtes Lernziel der Session.
  - **Blitzlicht:** aktiviert, mit Antworten.
  - **Freigegebene Quizergebnisse:** eine Quiz-Session mit Q&A und einer abgeschlossenen Frage mit Stimmen, wie in T5.5K.
- **CONFLICT ohne Mock des Prüfgegenstands:** Ein durchreichender Wrapper um eine Redis-Leseoperation, die zwischen zwei Absicherungen des Kontextaufbaus liegt, löst einmalig eine echte Stimme über `arsnova_change_qa_vote` aus und ruft dann die echte Operation auf. Redis ist eine Systemgrenze; der Wrapper ändert kein Ergebnis. Welche Leseoperation zwischen welchen Absicherungen liegt, bestimmt der Plan am Code. Ist das nicht ohne Eingriff in den Prüfgegenstand möglich, wird E12 als nicht umsetzbar protokolliert (Teil 1, Regel 5.5) und nicht anders erzwungen.
- **Legacy-Text-Runtime:** Die Test-Runtime bekommt einen Modus für den Legacy-Vertrag (`QA_SUMMARY_INFERENCE_URL`; Open-Weight aus). Sie zeichnet den rohen Body auf und antwortet mit einer konfigurierbaren `QaSummaryModelOutput`.

## 4. Ende-zu-Ende-Fälle

| Nr. | Fall                                                                                                                                                                                | H                                                                                                                                              | G                                                 | K                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E10 | **Belegter Slot:** Die Runtime antwortet auf `GET /slots` mit 503.                                                                                                                  | Fallback mit Grund `busy`; kein `POST /v1/chat/completions`.                                                                                   | Modellaufruf trotzdem oder anderer Grund.         | Grund `busy`; die Runtime hat keinen POST empfangen; Host bekam zuerst `pending`.                                                                                                                                           |
| E11 | **Volle Queue:** Queue-Limit 1, Nebenläufigkeit 1. Job 1 hängt in der Runtime (Latch), Job 2 einer zweiten Session wartet in der Queue, Job 3 einer dritten Session wird angefragt. | Job 3 bekommt sofort ein Ergebnis mit Grund `queue_full`, ohne Kontextaufbau für einen Job; Jobs 1 und 2 laufen nach dem Lösen normal zu Ende. | Job 3 wird angenommen, wartet oder wirft.         | (1) Antwort von Job 3 mit `queue_full`; (2) die Runtime empfängt genau zwei POSTs (Job 1 und 2); (3) Jobs 1 und 2 enden `ready`.                                                                                            |
| E12 | **CONFLICT beim Kontextaufbau:** Während `requestSummary` den Kontext aufbaut, ändert sich eine Q&A-Stimme.                                                                         | Host bekommt `TRPCError` `CONFLICT`; es entsteht kein Job.                                                                                     | `pending` mit einem Kontext aus gemischtem Stand. | Code `CONFLICT`; die Runtime empfängt keinen POST; `summaryRuntime` danach ohne laufenden Job. Kontrolle: ohne die Stimme im selben Aufbau `pending`.                                                                       |
| E13 | **Legacy-Text-Pfad, Erfolg:** Open-Weight aus, `QA_SUMMARY_INFERENCE_URL` auf die Test-Runtime.                                                                                     | Der Legacy-Vertrag geht raus; das Ergebnis hat Modus `legacy-text` und Aussagen, die an gepackte Quellen gebunden sind.                        | Anderer Modus oder ungebundene Aussagen.          | Modus und Status wie H; jede Quellen-ID einer Aussage ist eine gepackte Quelle.                                                                                                                                             |
| E14 | **Legacy-Text-Pfad, unbekannte Quellen-ID (Befund 5 dynamisch):** Die Runtime liefert eine Aussage mit gültiger und eine mit unbekannter ID.                                        | Die Aussage mit unbekannter ID wird beim Binden verworfen und als Einschränkung vermerkt; bleibt keine Aussage, ist der Status `uncertain`.    | Die unbekannte ID erscheint im Ergebnis.          | Unbekannte ID fehlt überall; Einschränkung vorhanden; zweite Variante mit nur unbekannten IDs → `uncertain`.                                                                                                                |
| E15 | **Voller #456-Kontext auf dem Draht:** Fixture mit allen Bereichen, dann Vorschau und Auftrag wie E1.                                                                               | Alle Bereiche sind `available`, und die gesendete Nutzlast ist bytegleich zum Kontext der Vorschau.                                            | Ein Bereich fehlt, ist leer oder geht verloren.   | (1) In der Vorschau sind Themen, Lernziele, Blitzlicht, freigegebene Ergebnisse und Kompass `available` mit mindestens einem Eintrag; (2) K (1)–(4) von E1 erfüllt; (3) die Kennungen dieser Bereiche stehen im rohen Body. |

**Mutationsproben** (lokal, nicht committet):

| Fall | Mutation                                                                                                        | Erwartung                |
| ---- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| E10  | Slot-Status 503 wie 200 behandeln                                                                               | E10 rot (POST empfangen) |
| E11  | Queue-Limit-Prüfung in `requestQaSummary` aushebeln                                                             | E11 rot                  |
| E12  | Die abschließende Absicherung (`assertModerationStateStillCurrent` bzw. die zuständige) liefert immer „aktuell“ | E12 rot, Kontrolle grün  |
| E13  | Legacy-Plan auf `none` umbiegen                                                                                 | E13 rot                  |
| E14  | Quellenfilter beim Binden des Legacy-Ergebnisses entfernen                                                      | E14 rot                  |
| E15  | Einen Bereich beim Packen weglassen                                                                             | E15 rot                  |

## 5. Messungen

Eigene Blöcke in der opt-in Messdatei aus Teil 2. Beide laufen nicht in der CI und schreiben JSON nach `evidenz/1C/messung/`. Ausgewertet wird mit `auswertung.mjs`, für den neuen Teil erweitert. Vor der Messung darf nichts anderes laufen.

| Nr. | Messgröße                                                                                                                                                                                            | Bedingungen                                                          | H                                                                                                                                                                                 | G                                                                                                           | K                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M6  | **Kosten mit vollem Kontext:** Dauer eines Kontextaufbaus (warm und kalt), Validierungsanteil wie M4, Nutzlastgröße                                                                                  | Fixture mit vollem Kontext, n = 20 (M4-Teil n = 200), 3 Aufwärmläufe | Ein Kontextaufbau bleibt im Median (kalt) unter 500 ms; der Validierungsanteil bleibt unter 20 %.                                                                                 | Der Aufbau wird deutlich teurer, oder die Validierung dominiert.                                            | Mediane wie H. Ergebnis wird gegen M3/M4 verglichen und mit Faktor angegeben.                                                             |
| M7  | **Anteil `source_changed` unter Voting:** Während eines Auftrags mit D = 2000 ms laufen Q&A-Stimmen als Poisson-Prozess (fester Seed) mit Rate r ∈ {0; 0,1; 0,5; 2} Stimmen/s auf die Fixturefragen. | n = 20 je Rate                                                       | Der Anteil folgt 1 − e^(−r·T), mit T = gemessene Zeit zwischen prepare (2) und prepare (3) je Lauf. Schon bei 0,5 Stimmen/s endet die Mehrheit der Aufträge mit `source_changed`. | Der Anteil liegt deutlich unter der Vorhersage, z. B. weil Stimmen den Hash seltener ändern als angenommen. | Für jede Rate liegt die Vorhersage (Mittel über die Läufe) im 95-%-Wilson-Intervall des beobachteten Anteils; bei r = 0 ist der Anteil 0. |

**Vorab festgelegte Entscheidungsregel zu M7:**

| Ergebnis                    | Entscheidung                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anteil ≥ 50 % bei r = 0,5/s | **Verbesserungsempfehlung prüfen:** Die Hash-Grenze macht Modellantworten bei aktiver Q&A überwiegend unbrauchbar. Kandidaten werden benannt und nach Kosten und Risiko bewertet, z. B. reine Stimmenänderungen tolerieren oder als „veraltet“ markieren statt verwerfen. Umgesetzt wird nichts. |
| Anteil < 50 % bei r = 0,5/s | **Beibehaltung** der Hash-Grenze mit dokumentierter Häufigkeit.                                                                                                                                                                                                                                  |
| K verfehlt                  | Befund „Vorhersagemodell falsch“; Ursache klären, bevor eine Empfehlung abgegeben wird.                                                                                                                                                                                                          |

**Begründung der Rate 0,5/s:** In einer Vorlesung mit 200 Teilnehmenden ist eine Q&A-Stimme alle zwei Sekunden eine eher geringe Aktivität. Sie ist kein gemessener Wert, sondern eine Annahme, die das Protokoll so nennt. Die reale Inferenzzeit ist länger als D = 2000 ms (Teil 2) und verschiebt den Anteil nach oben.

## 6. Gültigkeitsgrenzen

- Test-Runtime statt privater Inferenz; D ist ein Stellvertreter.
- Lokale Hardware unter Podman; Stimmenraten sind Annahmen, keine gemessene Nutzung.
- Der volle Kontext entsteht aus synthetischen Daten. Größere echte Sessions können teurer sein.
- Das CONFLICT-Fenster wird gezielt getroffen. Wie oft es in der Praxis auftritt, ist nicht gemessen.

## 7. Issue zu T2.3

Der Entwurf kommt nach `evidenz/1C/issue-t2-3-entwurf.md`: Beobachtung, Reproduktion über die Tests, erwartetes Verhalten, Vorschlag und Kosten. Angelegt wird das Issue erst nach Freigabe durch den Autor; wo (kqc-real oder Fork), entscheidet er.

## 8. KI-Nutzung

Dieses Design hat Claude Code (Anthropic, Modell Claude Opus 5.5) entworfen, einschließlich der Schwellen (500 ms, 20 %, 50 %, Raten, n). Der Autor hat Umfang und Grenzen vorgegeben („ohne Laborinstanz machbar“, kein lokales Modell) und das Design vor der Ausführung freigegeben. Ob die Ergebnisse geprüft sind, vermerken die Protokolle.
