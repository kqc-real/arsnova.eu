# E4 – Rubrikbewertung auf efd71b44

Angewendet nach den unveränderten, vorab festgelegten Prüfregeln in [rubrik.md](./rubrik.md). Grundlage sind die Rohdaten aus E1, E3a und E3b auf `efd71b44` (letzter Stand der Linie 1.3 vor der Vorbereitung von Release 1.4.0).

## Was sich gegenüber 9f230abc geändert hat

- **R200, R1000, R-Fix (Regelkern, E1):** Karten, Quellen und „Als Nächstes“ sind in allen 72 Läufen inhaltsgleich mit `9f230abc`. Die Punkte aus [bewertung-a657798e.md](./bewertung-a657798e.md) gelten unverändert.
- **X-Rel (extraktiver Releasepfad, E3b):** Die Ausgabe zeigt jetzt drei statt vier Belege (C, E, F; D fällt zusätzlich weg) im Wortlaut und den Hinweis „Eine ausführliche Zusammenfassung war diesmal nicht möglich. Deshalb werden die wichtigsten Fragen im Wortlaut angezeigt.“
- **X-Top (extraktiv mit Themen der Referenzdaten, E3a):** Die Ausgabe zeigt keine Themenlabels mehr, sondern die Fragen A, B, C, D im Wortlaut, weil Fragen Vorrang erhalten, sobald mindestens zwei vorliegen.

## Punkte

| Dimension                     | R200  | R1000 | R-Fix | X-Rel                                                          | X-Top                                    | L     |
| ----------------------------- | ----- | ----- | ----- | -------------------------------------------------------------- | ---------------------------------------- | ----- |
| D1 Quellennachvollziehbarkeit | 1     | 0     | 2     | 2 (3 von 3 Elementen direkte Fragen)                           | 2 (4 von 4 direkte Fragen)               | 2     |
| D2 Bedeutung der Bewertungen  | 2     | 0     | 2     | 0 (E, F ohne Hinweis auf Teilung)                              | 0 (E, F fehlen)                          | 1     |
| D3 Trennung org./fachlich     | 1     | 0     | 1     | 0 (drei Einzelfragen, keine Gruppierung)                       | 0 (vier Einzelfragen, keine Gruppierung) | 0     |
| D4 Unsicherheit und Lücken    | 0     | 0     | 0     | 1 (Hinweis auf den Betriebsmodus; Grund und Grenze unsichtbar) | 1 (derselbe Hinweis)                     | 0     |
| D5 Informationsumfang         | 1     | 0     | 2     | 1 (P über C, K; **Ü fehlt**)                                   | 1 (Ü, P; K fehlt)                        | 2     |
| **Summe (max. 10)**           | **5** | **0** | **7** | **4**                                                          | **4** (vorher 5)                         | **5** |
| Leseaufwand (Elemente)        | 4     | 2     | 4     | 3                                                              | 4                                        | 6     |
| Unzulässige Verkürzungen      | 0     | 0     | 0     | 0                                                              | 0                                        | 0     |

Auslegungshinweis D4: Der neue Hinweistext spricht von „den wichtigsten Fragen“. Er nennt weder die Auswahlgrenze (3 von 6) noch den Grund des Rückfalls; beides steht nur in der eingeklappten Diagnose, die erst auf Anforderung lädt. Nach der Prüfregel zählt er daher als ein Treffer (Betriebsmodus), wie zuvor „ohne generative Interpretation“.

## Befunde

1. **Keine nichtgenerative Variante erreicht alle fünf Dimensionen.** Unverändert; die beste realistische Variante bleibt R200 mit 5 Punkten, gleichauf mit der einfachen Liste.
2. **Der extraktive Releasepfad verliert den Übungswunsch weiterhin vollständig.** Mit drei Plätzen, die alle durch Kompass-Signale (umstritten: E, F; angeheftet: C) belegt werden, kommen A, B und D nie in die Auswahl.
3. **Die Themenvariante verliert ihren Vorteil.** Weil die Ausgabe Fragen vor Themen stellt, entfällt die Gruppierung nach Anliegen (D3 2 → 0); die Summe sinkt von 5 auf 4.
4. **Keine Variante erzeugt unzulässige Verkürzungen.** Unverändert.
