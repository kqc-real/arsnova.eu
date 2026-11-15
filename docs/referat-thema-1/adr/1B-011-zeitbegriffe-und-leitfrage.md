# 1B-011: Zeitbegriffe nach Dossier 8.1 und Leitfrage der Schritte 1–2

- **Status:** methodisch (2026-11-13); Zuordnung der Begriffe gilt für 1B Schritte 1–4. Leitfrage: Vorschlag der KI, vom Autor zu bestätigen; _aktualisiert 2026-11-13:_ Leitfrage und Kurzantwort vom Autor bestätigt
- **Kategorie:** Methodik

## Kontext

Issue #8 verlangt die Zeitbegriffe T_host … T_transport aus [Dossier 8.1](../1B-private-inferenz-zweiter-host.md#81-zerlegung-der-gesamtzeit-vorschlag-einer-begriffsdefinition); #9 (Niklas, Schritte 3–4) soll dieselben nutzen. Gemessen wurde nach [ADR 1B-006](1B-006-zeitmessung-per-mitschnitt.md) per Mitschnitt auf beiden Hosts, ohne Instrumentierung im Produktionscode. Die Größen aus Design und Laufprotokoll („Netz“, „Adapter“, „Server ohne Inferenz“) hießen bisher anders als im Dossier; eine Zuordnung fehlte (Prüfung 2026-11-13). Der Entwurf der Leitfrage aus #8 war noch nicht festgelegt.

## Entscheidung

**Zeitbegriffe:** Es gelten die Begriffe aus Dossier 8.1. Die Messung ordnet sich ihnen so zu (Werte: Median des gewerteten Laufs, n = 10, [Laufprotokoll](../evidenz/1B/2026-11-13-lauf.md), [`2026-11-13-lauf.json`](../evidenz/1B/messung/2026-11-13-lauf.json), Commit `8e9d1317`, ThinkPad P50):

| Dossier 8.1                               | Gemessen als                                                                              | Feld im Ergebnis                   |  Median |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- | ------: |
| T_host                                    | Rückkehr von `qa.requestSummary` im Treiber                                               | `treiber.auftraege[].hostReturnMs` |   56 ms |
| T_job                                     | `latencyMs` aus `qa_summary:completed`                                                    | `zerlegung.auftraege[].jobMs`      | 148,6 s |
| T_slot + T_post                           | Drahtzeit von GET `/slots` und POST am app-host (erstes Anfrage- bis Antwortsegment)      | Job − Adapter                      | 148,5 s |
| T_dns                                     | IP-Literal, also ≈ 0                                                                      | –                                  |       – |
| T_infer                                   | `timings.prompt_ms + timings.predicted_ms`                                                | `inferMs`                          | 148,3 s |
| T_transport ≈ (T_slot + T_post) − T_infer | **Netz + Server ohne Inferenz**                                                           | `netzMs` + `serverOhneInferenzMs`  | 17,8 ms |
| davon Netz                                | Drahtzeit app-host − Drahtzeit llm-host (zwei Uhren, Auflösung ≈ ± 1 ms)                  | `netzMs`                           | 0,43 ms |
| davon Server ohne Inferenz                | Drahtzeit am llm-host − T_infer (HTTP, Template, Tokenisierung, Serialisierung)           | `serverOhneInferenzMs`             | 17,4 ms |
| T_adapter + Client-Anteil                 | T_job − (T_slot + T_post): Queue, zwei `prepare`, Binding, `parseCompletion`, Client-Code | `adapterMs`                        |  101 ms |

_Korrigiert 2026-11-13:_ Die Tabelle mischt zwei Gruppen. T_job (148,6 s) und T_infer (148,3 s) sind die Mediane der neun warmen Aufträge (`kennzahlen.warm`), die übrigen Zeilen gelten für alle zehn. Für alle zehn Aufträge sind es T_host **56,5 ms**, T_job **148,7 s** (148675,5 ms) und T_infer **148,5 s** (148458 ms), nachgerechnet aus [`2026-11-13-lauf.json`](../evidenz/1B/messung/2026-11-13-lauf.json). T_transport (17,8 ms), Netz, Server ohne Inferenz und Adapter sind Mediane der Werte je Auftrag; sie lassen sich deshalb nicht aus den Medianen der Zeilen darüber abziehen. Die Aussage der Tabelle ändert sich nicht.

_Korrigiert 2026-11-14 (Docs-Audit):_ Auch T_host (56 ms) ist der Median der neun warmen Aufträge; für alle zehn sind es 56,5 ms, wie oben genannt.

_Ergänzt 2026-11-14 (Docs-Audit):_ Zwei Kontrollen heißen C0. **C0 Direktprompt** ([Design Abschnitt 5](../specs/2026-11-12-1b-zwei-host-design.md#5-zeitmessung-ki-vorschlag), [ADR 1B-006](1B-006-zeitmessung-per-mitschnitt.md)): derselbe Summary-POST einmal direkt im llm-host, Teil jedes `lauf` außer B0. **C0 nach M2** (Dossier 10.3, [Design-Nachtrag 2026-11-13](../specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung), Modus `kontrolle`): dieselbe kurze Anfrage je 30-mal vom llm-host an sich selbst und vom app-host an den llm-host. Die Doku nennt jeweils den vollen Namen.

T_client ist nicht getrennt messbar ohne Instrumentierung (heute verworfen, Befund C); die Messung schneidet am Draht. Damit ist T_transport feiner zerlegt als im Dossier: Netzanteil und Serveranteil getrennt. Der Transportanteil T_transport / T_job beträgt im Median rund 0,01 % und liegt weit unter der Dossier-Schwelle von 5 % ([Dossier 10.5](../1B-private-inferenz-zweiter-host.md#105-entscheidungsschwellen-vorschlag-vorab-begründen)).

**Leitfrage Schritte 1–2 (Vorschlag, eng am Entwurf aus #8):**

> Wie schlüsselt sich die Zeit eines echten Kompass-Auftrags (Q&A-Zusammenfassung V2 mit der 1C-Referenzfixture) über die zweite private Serverrolle auf, und wie groß ist der Transportanteil im Vergleich zur Inferenz?

**Kurzantwort:** Fast die ganze Zeit ist Inferenz (99,9 %); der Transport kostet im Median 17,8 ms, davon Netz unter 1 ms.

## Alternativen

- **Eigene Begriffe beibehalten:** verworfen; #9 und das Dossier nutzen 8.1, gemeinsame Aussagen brauchen dieselben Wörter.
- **T_client per Laborbuild messen:** verworfen nach [ADR 1B-006](1B-006-zeitmessung-per-mitschnitt.md) (kein Produktionscode, der Mitschnitt misst am Draht).

## Belege

_Ergänzt 2026-11-14 (Docs-Audit):_

- Messwerte: [`2026-11-13-lauf.json`](../evidenz/1B/messung/2026-11-13-lauf.json), Commit `8e9d1317`, ThinkPad P50; Auswertung im [Laufprotokoll](../evidenz/1B/2026-11-13-lauf.md).
- Begriffe: [Dossier 8.1](../1B-private-inferenz-zweiter-host.md#81-zerlegung-der-gesamtzeit-vorschlag-einer-begriffsdefinition), Schwelle: [Dossier 10.5](../1B-private-inferenz-zweiter-host.md#105-entscheidungsschwellen-vorschlag-vorab-begründen).
- Messmethode: [ADR 1B-006](1B-006-zeitmessung-per-mitschnitt.md).

## Folgen

- [1B-ergebnis.md](../1B-ergebnis.md) nennt Leitfrage und Kurzantwort mit diesen Begriffen; Niklas nutzt die Tabelle für Schritt 3 (Störversuche verändern T_transport bzw. T_infer).
- Neue Läufe berichten T_host und T_transport zusätzlich zu Netz, Adapter und Inferenz.
