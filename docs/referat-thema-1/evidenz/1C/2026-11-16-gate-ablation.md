# Gate-Ablation offline (2026-11-16)

Nachtrag zu [ADR 1C-018](../../adr/1C-018-quality-gate-verwirft-echte-antworten.md). Kein neuer Lauf, keine Inferenz: Das Quality-Gate wird auf schon aufgezeichnete Modellantworten angewandt.

## 1. Frage

Im Nachlauf (`def56700`, Instruktion v5, mit Gate) endet kein Auftrag `full-context`. Auf `9f230abc` (Instruktion v2, ohne Gate) enden 19 von 20 `full-context`. Offen ist, **an welcher Regel des Gates** die Antworten scheitern, und ob die Regeln auch inhaltliche Mängel treffen, die schon die alten Antworten hatten.

## 2. Daten (vorab festgelegt)

- Codestand Gate: `apps/backend/src/lib/qaSummaryQuality.ts`, `hasAcceptableQaSummaryQuality`, byte-gleich zwischen `v1.4.0` und `def56700` ([1C-Ergebnis](../../1C/1C-ergebnis.md)). Locale `de` (Referenzfixture).
- Antworten: jede aufgezeichnete Runtime-Antwort mit `choices` in
  - `messung/2026-11-09-labor-nachlauf.json.gz` (`def56700`, Laptop),
  - `messung/2026-11-05-labor.json.gz` (`9f230abc`, Laptop),
  - `messung/2026-11-05-labor-pc.json.gz` (`9f230abc`, PC).
- Antworten, deren `content` kein JSON mit `output` ist, zählen getrennt als „nicht auswertbar“.

## 3. Regeln des Gates (aus dem Code, je Antwort einzeln geprüft)

| Regel        | Art    | Bedingung für Verwerfen                                                                                    |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------- |
| R1 Anzahl    | Form   | weniger als 2 Aussagen                                                                                     |
| R2 Leitwort  | Form   | eine Aussage ohne „Leitwort: Rumpf“ (Doppelpunkt oder Gedankenstrich bis Zeichen 48)                       |
| R3 Markdown  | Form   | `**`, `__` oder Backtick                                                                                   |
| R4 Meta-Leck | Inhalt | interne Begriffe (Quellen-IDs, Token-/Kontextbudget, „nicht berücksichtigt“, Status pending/pinned/active) |
| R5 Abbruch   | Inhalt | Rumpf endet auf Artikel oder Adjektiv ohne Bezugswort                                                      |
| R6 Satzende  | Form   | Rumpf kürzer als 12 Zeichen oder ohne Satzzeichen am Ende                                                  |
| R7 Doppelt   | Form   | gleiches Leitwort zweimal                                                                                  |
| R8 Generisch | Inhalt | Leitwort „Frage(n)“ oder „Beispiel(e)“                                                                     |

Die Zerlegung je Regel bildet der Auswerter nach. Er gilt nur, wenn sein Gesamturteil für **jede** Antwort mit `hasAcceptableQaSummaryQuality` übereinstimmt (Konsistenzprüfung).

## 4. Hypothesen und Schwellen (vorab, 2026-11-16)

- **H_A1 (Form statt Inhalt):** Im Nachlauf verwirft R2 allein mindestens 50 % der auswertbaren Antworten. Gegenalternative: Die Antworten scheitern überwiegend an Inhaltsregeln (R4, R5, R8).
- **H_A2 (Gate trifft echte Mängel):** Auf `9f230abc` verletzt mindestens eine von zehn auswertbaren Antworten eine Inhaltsregel (R4, R5 oder R8). Gegenalternative: Die Inhaltsregeln treffen die alten Antworten nicht; das Gate verwirft sie nur wegen der Form.
- **Beschreibend, ohne Hypothese:** Anteil der `9f230abc`-Antworten, die das Gate insgesamt verwerfen würde. Die Instruktion v2 verlangt die Form „Leitwort: Rumpf“ nicht; ein hoher Anteil ist erwartbar und belegt allein nichts.

**Offenlegung:** Vor dem Festlegen habe ich eine einzige Antwort gesehen (PC, Lauf 2, `9f230abc`): drei Aussagen ohne Leitwort, eine mit „als PINNED markiert“. H_A2 ist dadurch schwach vorbelastet; deshalb die niedrige, aber nicht triviale Schwelle über alle Antworten.

## 5. Grenzen (vorab)

- Eine Fixture, eine Sprache, ein Modell. Kein Urteil über die inhaltliche Güte der Zusammenfassungen.
- Die Instruktion unterscheidet sich zwischen den Codeständen; die Ablation trennt Regeln, nicht Instruktionen.

## 6. Ergebnis

Ausgewertet 2026-11-16 nach dem Commit der Abschnitte 1–5 (`dccbdfd1`):
`node --import tsx docs/referat-thema-1/evidenz/1C/messung/gate-ablation.mjs`. Konsistenzprüfung: 0 Abweichungen vom echten Gate in 87 von 87 Antworten; keine Antwort nicht auswertbar.

| Codestand (Rechner) | Antworten | Gate verwirft | R2 Leitwort | R7 Doppelt | R4 Meta-Leck | R8 Generisch | mit Inhaltsregel |
| ------------------- | --------- | ------------- | ----------- | ---------- | ------------ | ------------ | ---------------- |
| `def56700` (Laptop) | 28        | 28            | 23          | 5          | 0            | 0            | 0                |
| `9f230abc` (Laptop) | 29        | 29            | 28          | 1          | 13           | 1            | 14               |
| `9f230abc` (PC)     | 30        | 30            | 30          | 0          | 12           | 0            | 12               |

R1, R3, R5 und R6 verletzt keine Antwort.

- **H_A1 erfüllt.** Im Nachlauf verletzen 23 von 28 Antworten (82 %) R2, die übrigen 5 R7. Keine Antwort verletzt eine Inhaltsregel. Das Gate verwirft die Antworten von `def56700` nur wegen der Form.
- **H_A2 erfüllt.** Auf `9f230abc` verletzen 26 von 59 Antworten (44 %) eine Inhaltsregel, fast immer R4: Sie nennen interne Status wie „als PINNED markiert“.
- **Beschreibend:** Das Gate hätte alle 59 Antworten von `9f230abc` verworfen. Die damals gemessenen 19 von 20 `full-context` gab es nur, weil das Gate noch fehlte.

**Nachträglich, nicht vorab festgelegt (beschreibend):** Eine einfache Wortzählung (häufige deutsche gegen englische Funktionswörter) stuft 22 der 28 Nachlauf-Antworten als englisch ein, 0 der 59 Antworten von `9f230abc`. 7 der 28 Nachlauf-Antworten übernehmen den Platzhalter „Specific topic:“ wörtlich; sie bilden die R7-Fälle. Das Gate prüft die Sprache nicht.

**Einordnung.** Das Gate verwirft nicht grundlos, aber es verwirft aus anderen Gründen, als seine Inhaltsregeln nennen. Die alten Antworten (v2) sind deutsch, verraten aber in 44 % interne Status. Die neuen Antworten (v5) verraten keine Status mehr, sind aber meist englisch und verfehlen die Form „Leitwort: Rumpf“. Instruktion und Gate wirken also zusammen: v5 beseitigt das Meta-Leck und verschlechtert Sprache und Form; das Gate fängt beides nur über die Formregeln ab. Die Empfehlung aus ADR 1C-018 bleibt: Instruktion, Grammatik und Gate gemeinsam am ausgelieferten Modell abstimmen; zusätzlich eine Sprachprüfung erwägen.
