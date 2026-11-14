# E4 – Rubrikbewertung (Commit a657798e)

Angewendet nach den vorab festgelegten Prüfregeln in [rubrik.md](./rubrik.md). Grundlage sind ausschließlich die Rohdaten aus E1, E3a und E3b.

## Bewertete Bedingungen

| Kürzel    | Bedingung                                                   | Was die Lehrperson sieht                                                                          | Quelle   |
| --------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| **R200**  | Regelkern, alle Fragen freigegeben, N=200, BEST             | Reibung [E, F] mit „Als Nächstes“ · Themen [»linearen«, »Regression«]                             | E1       |
| **R1000** | wie R200, aber N=1000                                       | nur Themen [»linearen«, »Regression«], kein „Als Nächstes“                                        | E1       |
| **R-Fix** | Regelkern mit Fixture-Status (A, D, F ungeprüft), N=200     | Reibung [E] · Klärung [D, A, F] mit „Als Nächstes“                                                | E1       |
| **X-Rel** | extraktiver Fallback, Release-Pfad, generative Inferenz aus | 4 Belege: E, F, C, D (Reihenfolge je Session zufällig) + Hinweis „ohne generative Interpretation“ | E3b      |
| **X-Top** | extraktiver Fallback mit semantischen Themen (Fixture)      | 3 Themenlabels + Frage A                                                                          | E3a      |
| **L**     | Gegenalternative: ungefilterte chronologische Liste         | A–F mit +/−-Zahlen                                                                                | Szenario |

## Punkte

| Dimension                     | R200                                          | R1000                      | R-Fix                                  | X-Rel                                                                      | X-Top                       | L                         |
| ----------------------------- | --------------------------------------------- | -------------------------- | -------------------------------------- | -------------------------------------------------------------------------- | --------------------------- | ------------------------- |
| D1 Quellennachvollziehbarkeit | 1 (2 von 4 Quellen direkt; Begriffe indirekt) | 0 (nur Begriffe)           | 2                                      | 2                                                                          | 0 (3 von 4 nur Themenlabel) | 2                         |
| D2 Bedeutung der Bewertungen  | 2 (E, F als Reibung)                          | 0 (Kontroverse unsichtbar) | 2 (E als Reibung)                      | 0 (E, F ohne Hinweis auf Teilung)                                          | 0                           | 1 (40:40 nur als Rohzahl) |
| D3 Trennung org./fachlich     | 1 (Ü und K getrennt, P fehlt)                 | 0 (nur eine Gruppe)        | 1 (K getrennt; Klärung mischt P, Ü, K) | 0 (vier Einzelbelege, keine Gruppierung)                                   | 2 (drei Themen = Ü, P, K)   | 0                         |
| D4 Unsicherheit und Lücken    | 0                                             | 0                          | 0                                      | 1 (Betriebsmodus-Hinweis; Auswahlgrenze und Fallback-Grund nicht sichtbar) | 1                           | 0                         |
| D5 Informationsumfang         | 1 (Ü, K)                                      | 0 (Ü)                      | 2 (Ü, P, K)                            | 1 (P, K; **Ü fehlt**)                                                      | 2                           | 2                         |
| **Summe (max. 10)**           | **5**                                         | **0**                      | **7**                                  | **4**                                                                      | **5**                       | **5**                     |
| Leseaufwand (Elemente)        | 4                                             | 2                          | 4                                      | 4                                                                          | 4                           | 6 (wächst mit n)          |
| Unzulässige Verkürzungen      | 0                                             | 0                          | 0                                      | 0                                                                          | 0                           | 0                         |

Auslegungshinweis D4: Der Kompassdialog besitzt einen Aufklapper für weitere Quellen (`moderation-compass-dialog.component.html:124–129`), der aber nur bei mehr als drei Quellen je Karte erscheint. In keiner bewerteten Bedingung trifft das zu; er zählt daher nicht als Treffer.

Auslegungshinweis D3: „abgegrenzt“ setzt mindestens zwei sichtbare, voneinander getrennte Anliegen voraus. Bei nur einer sichtbaren Gruppe gibt es 0 Punkte.

## Befunde

1. **Keine nichtgenerative Variante erreicht alle fünf Dimensionen.** Die beste realistische Variante (R200) zeigt die Kontroverse korrekt, aber die Prüfungsorganisation (C/D) nicht.
2. **Die Raumgröße entscheidet über die Kontroverse.** R1000 fällt auf 0 Punkte, weil E/F (40:40 bzw. 20:20) bei N=1000 unter der Schwelle T=100 liegen.
3. **Der extraktive Release-Pfad verliert den stärksten Übungswunsch.** A (80:30, die meiste Zustimmung) wird nie ausgewählt: Der Kandidatenfilter nimmt zuerst die durch das Kontroversitätssignal geschützten Fragen E/F, dann die gepinnte C, dann nach Best-Score D (12:0 → 0,757) vor B (0,722) und A (0,637) (`moderationSummaryContext.ts:187–247, 471–495`). Die Wilson-Untergrenze bestraft A für 30 Gegenstimmen.
4. **Keine Variante erzeugt unzulässige Verkürzungen.** Das ist eine Eigenschaft der Konstruktion (Zitieren statt Formulieren), kein Zufall.
5. **Bei sechs Fragen ist die einfache Liste gleichwertig.** Der Mehrwert des Regelkerns liegt in der Verdichtung bei großen Fragemengen (Leseaufwand bleibt konstant bei ≤ 3 sichtbaren Quellen je Karte), nicht in besserer Einordnung kleiner Mengen.

## Grenzen

- Eine bewertende Person; Prüfregeln weitgehend mechanisch. Eine Zweitbewertung mit Cohen's κ steht aus.
- X-Top verwendet handgeschriebene Themenlabels der Fixture. Echte Encoder-Cluster und extraktive Labels (Story 1.14c) können abweichen; ihre Güte ist Gegenstand von Auftrag 2B.
- Gemessen wird Informationsqualität für die Lehrperson, nicht didaktische Wirksamkeit.
