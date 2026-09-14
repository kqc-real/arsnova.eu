# P0-03 – ARSnova-Livequiz-Blueprint für 10 Wochen

**Version:** 3.0.0 · **Stand:** 14.09.2026 · **Status:** normative Spezifikation für 100 anspruchsvolle Livefragen im synchronen Gamification-Betrieb

**Kanonischer Index:** [P0-03_Materialpaket_Pilotlauf.md](./P0-03_Materialpaket_Pilotlauf.md)

**Kürzel vorab:** **BWL/WI** steht für Betriebswirtschaftslehre/Wirtschaftsinformatik, **W01–W10** bezeichnet die Kurswochen, **LE** eine 90-minütige Vorlesungs- beziehungsweise Lerneinheit aus zwei **UE**, **UE** eine 45-minütige Unterrichtseinheit, **L01–L10** die Livefragen einer Woche, **LI01–LI24** die Leistungsindikatoren sowie **D/L** Diagnose- beziehungsweise Lernmodus. **QA** bedeutet Qualitätssicherung.

## 1. Verbindlicher Einsatzrahmen

Das Modul verwendet ARSnova.eu synchron zur pseudonymen Diagnose, zur lernorientierten Peer Instruction und für formative Spiel-/Teamphasen. Die zehn Wochen-Dateien enthalten zusammen genau 100 Livefragen:

|     Woche |  Fragen | Datei                                                                |
| --------: | ------: | -------------------------------------------------------------------- |
|       W01 |      10 | [P0-03_ARSnova_Woche_01.json](./ARSnova/P0-03_ARSnova_Woche_01.json) |
|       W02 |      10 | [P0-03_ARSnova_Woche_02.json](./ARSnova/P0-03_ARSnova_Woche_02.json) |
|       W03 |      10 | [P0-03_ARSnova_Woche_03.json](./ARSnova/P0-03_ARSnova_Woche_03.json) |
|       W04 |      10 | [P0-03_ARSnova_Woche_04.json](./ARSnova/P0-03_ARSnova_Woche_04.json) |
|       W05 |      10 | [P0-03_ARSnova_Woche_05.json](./ARSnova/P0-03_ARSnova_Woche_05.json) |
|       W06 |      10 | [P0-03_ARSnova_Woche_06.json](./ARSnova/P0-03_ARSnova_Woche_06.json) |
|       W07 |      10 | [P0-03_ARSnova_Woche_07.json](./ARSnova/P0-03_ARSnova_Woche_07.json) |
|       W08 |      10 | [P0-03_ARSnova_Woche_08.json](./ARSnova/P0-03_ARSnova_Woche_08.json) |
|       W09 |      10 | [P0-03_ARSnova_Woche_09.json](./ARSnova/P0-03_ARSnova_Woche_09.json) |
|       W10 |      10 | [P0-03_ARSnova_Woche_10.json](./ARSnova/P0-03_ARSnova_Woche_10.json) |
| **Summe** | **100** |                                                                      |

Jede Wochen-Datei enthält jeden der zehn von arsnova.eu unterstützten Fragetypen genau einmal. Wird ein Wochenblock auf mehrere Präsenztage verteilt, werden die zehn Fragen auf diese Termine verteilt und nicht pro Termin vervielfacht. Keine Frage darf wegen ihres Typs, ihrer Schwierigkeit oder einer optionalen Vertiefung ersatzlos entfallen; eine notwendige fachliche Vereinfachung verwendet denselben Typ und dasselbe Kernlernziel.

### 1.1 Formatives Gamification-Profil

Jede Wochen-Datei verwendet:

```json
{
  "showLeaderboard": true,
  "allowCustomNicknames": false,
  "defaultTimer": 60,
  "timerScaleByDifficulty": true,
  "enableTimerAccommodation": true,
  "enableSoundEffects": true,
  "enableRewardEffects": true,
  "enableMotivationMessages": true,
  "enableEmojiReactions": true,
  "anonymousMode": false,
  "teamMode": true,
  "teamCount": 4,
  "teamAssignment": "AUTO",
  "teamNames": ["Apfel :apple:", "Birne :pear:", "Banane :banana:", "Apfelsine :orange:"],
  "backgroundMusic": null,
  "nicknameTheme": "KINDERGARTEN",
  "bonusTokenCount": 3,
  "readingPhaseEnabled": true
}
```

Jede Frage verwendet `timer=null`; dadurch erbt sie den effektiven Standardtimer von 60 Sekunden, der nach Schwierigkeit skaliert wird. Der Countdown beginnt erst nach der aktivierten Lesephase. Persönlich freigegebene Zeitverlängerungen werden über `enableTimerAccommodation=true` berücksichtigt; zusätzlich liegt eine fachlich gleichwertige untimierte Alternative vor.

Rangliste, vier automatisch gebildete Frucht-Teams, drei Bonuspunkte, Sound-, Belohnungs-, Motivations- und Emoji-Effekte unterstützen Lern- und Aufmerksamkeitsmotivation. Automatisch vergebene Kindergarten-Pseudonyme ersetzen Klarnamen. Für Scoring, Ranglisten und Teams gilt die im Produkt implementierte Effective-Vote-Regel; wiederholte Abstimmungen dürfen nicht mehrfach punkten.

### 1.2 Didaktische und datenschutzbezogene Grenzen

- Teilnahme ist freiwillig, pseudonym dargestellt und ohne Notennachteil.
- Ergebnisse steuern die Lehre; Quizpunkte, Rang, Teamstand, Bonus und Antwortgeschwindigkeit sind motivierende Spielsignale, aber keine Lernstandskennzahlen.
- Eigene Nicknames und Klarnamen werden nicht verwendet. Pseudonyme und Spielwerte werden nicht in individuelle Leistungsprofile übernommen.
- SURVEY und RATING erheben unbewertete Selbstauskünfte; FREETEXT sammelt offene Beiträge. Diese Typen besitzen keine richtige Lösung und keine Lösungsquote.
- Confidence ist ordinal, antwortbezogen und optional; bei aktivierter Abfrage gibt es eine gleichwertige Alternative ohne Confidence.
- LIVE-Daten werden bevorzugt aggregiert und immer mit Nenner berichtet.
- Die Fragewand Q&A darf während der Sitzung geöffnet bleiben, zählt aber nicht zu den zehn Livequizfragen. Freitext wird vor jeder Lehrnutzung geprüft und nicht ungefiltert exportiert.
- Die Nutzung dient ausschließlich der Lehre und der internen Modulverbesserung.

## 2. IDs, Reihenfolge und Revision

### 2.1 Redaktionelle IDs

Die redaktionelle ID hat die Form `P0-03-ARS-WNN-LNN`:

- `WNN`: Woche `W01` bis `W10`,
- `LNN`: Livefrage `L01` bis `L10`,
- Beispiel: `P0-03-ARS-W06-L03`.

Die Importdatei verwendet eine nullbasierte `order`: `L01` entspricht `order=0`, `L10` entspricht `order=9`. Die App erzeugt beim Import technische Frage-UUIDs. Diese UUIDs sind nicht die redaktionellen IDs und werden nach einem Neuimport nicht als stabil vorausgesetzt. Für Lehrsteuerung und Exportzuordnung sind Wochen-Datei, Paketversion und `order` maßgeblich.

Nicht unterstützte Zusatzfelder wie eine frei erfundene `id` werden dem Import-JSON nicht hinzugefügt. Die redaktionelle Zuordnung bleibt im Blueprint, im Fragen-Review und in der bereinigten Lehrauswertung dokumentiert.

### 2.2 Revisionsregel

- Sprachliche Korrektur ohne Bedeutungsänderung: Dokument-/Paketversion und registrierte JSON-Prüfsumme erhöhen; redaktionelle ID bleibt.
- Änderung von richtiger Lösung, Referenzwert, Toleranzband, Lernziel oder geprüftem Inhalt: neue redaktionelle Revision im Review- und Datenregister.
- Nach realem Einsatz wird die verwendete JSON-Fassung über ihre Prüfsumme nachweisbar gehalten; eine neue Fassung wird als neuer Lauf importiert.
- Exporte verschiedener Revisionen oder Läufe werden nie ohne sichtbare Revisions-/Laufvariable zusammengeführt. Dem Import-JSON werden dafür keine vom aktuellen Schema unbekannten Felder hinzugefügt.

## 3. Typen-, Schwierigkeits- und Qualitätsvertrag

### 3.1 Die zehn Fragetypen

| Typ                | Verbindliche Ausprägung je Woche                                                                                             | Lösung und Distraktoren                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SINGLE_CHOICE`    | genau vier Antwortoptionen                                                                                                   | genau eine richtige und drei plausible, formal parallele Distraktoren                                     |
| `MULTIPLE_CHOICE`  | genau vier Antwortoptionen; vollständige Auswahlregel wird im Ablauf erläutert                                               | mindestens zwei richtige und mindestens eine falsche Option; falsche Optionen sind plausible Distraktoren |
| `FREETEXT`         | offene, präzise formulierte Transfer- oder Begründungsfrage                                                                  | `answers=[]`; keine Musterlösung im Import und keine automatische Lösungsquote                            |
| `SHORT_TEXT`       | bewertbare kurze Fachantwort mit vorab gepflegten Schreibvarianten und angemessener Toleranz                                 | alle Einträge in `answers` sind gültige, als richtig markierte Musterlösungen                             |
| `SURVEY`           | genau vier formal parallele, unbewertete Antwortoptionen                                                                     | alle Optionen `isCorrect=false`; keine fachliche Lösungsquote                                             |
| `RATING`           | Skala 1 bis 5 mit eindeutigen, gegensätzlichen Endlabels                                                                     | `answers=[]`; keine richtige Skalenstufe                                                                  |
| `NUMERIC_ESTIMATE` | Referenzwert, Einheit, Eingabeformat, Wertebereich und absolutes Intervall oder relative Toleranz sind vollständig angegeben | `answers=[]`; Referenz und Toleranz werden unabhängig nachgerechnet                                       |
| `MATCHING`         | vier bis sechs eindeutige Paare; rechte Seite wird gemischt                                                                  | `answers=[]`; Begriffe und Gegenstücke sind jeweils eindeutig und formal vergleichbar                     |
| `ORDERING`         | vier bis sechs eindeutig sortierbare Schritte in fachlich richtiger Arrayfolge                                               | `answers=[]`; keine zwei Schritte dürfen fachlich dieselbe Position beanspruchen                          |
| `CATEGORIZATION`   | zwei bis vier eindeutige Kategorien und sechs bis acht eindeutig zuordenbare Elemente; Elemente werden gemischt              | `answers=[]`; jedes Element verweist auf genau eine vorhandene Zielkategorie                              |

Confidence darf nur bei den bewertbaren Typen Single Choice, Multiple Choice, Short Text, Numeric Estimate, Matching, Ordering und Categorization aktiviert werden. Freitext, Survey und Rating bleiben ohne Confidence.

Für `SHORT_TEXT` gilt zusätzlich: Wenn eine einzelne Ziffer, Einheit, Negation oder ein fachlicher Gegenbegriff die Richtigkeit ändert, werden ausschließlich explizit gepflegte Schreibvarianten mit `shortTextEvaluationMode=exact`, `shortTextToleranceLevel=none` und `shortTextAllowPartialCredit=false` akzeptiert. Eine fehlertolerante Bewertung ist nur zulässig, wenn dokumentierte Gegenbeispiele zeigen, dass falsche Zahlen, Einheiten und Gegenbegriffe keine Punkte erhalten.

### 3.2 Schwierigkeit und kognitive Anforderung

- Jede Frage verwendet ausschließlich `difficulty=MEDIUM` oder `difficulty=HARD`; `EASY` ist im Paket unzulässig.
- Mittlere Fragen verlangen mindestens zwei verknüpfte Schritte, die Interpretation konkurrierender Aussagen oder die Übertragung einer Regel auf einen konkreten Fall.
- Schwere Fragen verlangen Transfer, Datenkritik, mehrstufige Rechnung oder die Abgrenzung mehrerer zugleich plausibler Erklärungen.
- Das bloße Ändern des Metadatenwerts erhöht die Schwierigkeit nicht. Stamm, Antwortalternativen, strukturierte Elemente und Auflösung müssen die ausgewiesene Anforderung tragen.
- Unbewertete Typen erhalten mindestens `MEDIUM`; der Wert beschreibt dort die kognitive Anforderung des Impulses, nicht eine Lösungsquote.

### 3.3 Distraktor- und Formulierungsvertrag

Für Single Choice, Multiple Choice und Survey sowie sinngemäß für konkurrierende Elemente der strukturierten Typen gilt:

1. Optionen vollenden den Stamm grammatisch auf dieselbe Weise oder bilden eigenständige Sätze derselben Form.
2. Wortart, Person, Numerus, Zeitform, Einheit, Rundung und Präzision sind innerhalb eines Items parallel.
3. Die richtige Lösung ist weder durch auffällige Länge noch durch eine abweichende Einschränkung erkennbar.
4. Jeder Distraktor steht für ein konkretes Fehlkonzept, einen realistischen Rechenfehler, eine Nennerverwechslung oder eine unzulässige Interpretation. Unsinn, Scherz- und Fangoptionen sind unzulässig.
5. Survey-Optionen sind wertneutral, überschneidungsarm und ähnlich spezifisch; sie werden nicht als versteckter Wissenstest formuliert.
6. Kurztext-Musterlösungen und offene Antworten sind keine Distraktoren und werden nicht künstlich auf vier Einträge aufgefüllt.
7. Die statische Reihenfolge der Antworten variiert zwischen Wochen und Fragetypen; wiederkehrende Muster der richtigen Positionen oder Auswahlkombinationen dürfen auch ohne Laufzeit-Shuffling keinen Lösungshinweis geben.

### 3.4 Curricularer Status

Die zehn Typen dienen der methodischen Variation, erweitern aber nicht den summativen Pflichtkern. Jede Frage verweist in der redaktionellen Prüfung auf mindestens einen der Leistungsindikatoren LI01–LI24. Optionales ARSnova- oder Repository-Wissen wird entweder vollständig im Stamm bereitgestellt oder bleibt als nicht summativ bewertete Vertiefung außerhalb des Lösungsschlüssels. Die vollständige Typabdeckung darf nicht von einem Vertiefungsgate abhängen.

### 3.5 QA-Verteilung

Jede Frage besteht die technische Basisprüfung: importierbares JSON, lückenlose Reihenfolge, typgerechte Pflichtfelder, lösbarer Schlüssel, bei Kurztext geprüfte Positiv- und Negativbeispiele, kein wiederkehrendes statisches Lösungsmuster, keine Lösung im Teilnehmer-Fragenstamm, vollständiges Gamification-Profil und gleichwertige Alternative. Zusätzlich wird dokumentiert:

- **QA-F:** unabhängige Fach-/Didaktikprüfung von Aussage, Lernziel, Distraktoren und Fehlvorstellung,
- **QA-R:** unabhängige Rechen-, Quellen- oder JASP-Reproduktion,
- **QA-P:** Datenschutz-/Zweckbindungsprüfung für LIVE-, Confidence-, Freitext-, Survey- oder Rating-Daten.

Die barrierearme Darstellung folgt der [Material-/A11y-Matrix](./P0-03_Barrierefreiheit_Material_und_Probe.md): vollständiger vorlesbarer Wortlaut, nicht nur farblich oder räumlich unterscheidbare Optionen, vorgeschaltete Lesephase, funktionierende Zeitunterstützung und typgerechte untimierte Papierantwort.

## 4. Verbindliche Wochenmatrix

Die jeweilige JSON-Datei ist die autoritative Quelle für Wortlaut, Reihenfolge, Lösung, Referenzwert und typbezogene Struktur. Der Blueprint legt den curricularen Rahmen fest. Für jede Woche gilt unabhängig vom Thema dieselbe maschinell prüfbare Typmenge:

`MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `FREETEXT`, `SHORT_TEXT`, `SURVEY`, `RATING`, `NUMERIC_ESTIMATE`, `MATCHING`, `ORDERING`, `CATEGORIZATION`.

| Woche | LI-Schwerpunkte       | Verbindlicher fachlicher Rahmen                                                                                                  | Besondere Reproduktions- und QA-Schwerpunkte                                                                       |
| ----: | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
|   W01 | LI01–LI04             | Statistikprozess, Bezugsgruppe, Grundgesamtheit/Stichprobe, Beobachtungseinheit, Merkmale, Skalenniveaus, Datenqualität, Grenzen | Bezugsgruppe und Nenner sichtbar; keine Kausal- oder Repräsentativitätsbehauptung aus freiwilligen Live-Antworten  |
|   W02 | LI05–LI08             | absolute/relative Häufigkeit, Nenner, Diagrammwahl, Mittelwert/Median, robuste Lage, kumulative Wiederholung W01                 | Prozentwerte und Lagewerte nachrechnen; nominale und metrische Darstellungen trennen                               |
|   W03 | LI06–LI08, LI24       | Streuung, Varianz mit `n`/`n−1`, Standardabweichung, Quartile, Boxplot, Ausreißer, p95/p99                                       | Einheiten und Konvention nennen; REPO-Latenzwerte nicht zu Rohdaten oder Produktivqualität überdehnen              |
|   W04 | LI09–LI10             | Ereignis/Gegenereignis, Baum- und Multiplikationsregel, bedingte und inverse Wahrscheinlichkeit, Basisrate, Confidence           | alle Tafelsummen und Nenner reproduzieren; Confidence ordinal und freiwillig behandeln                             |
|   W05 | LI11–LI12             | Zufallsvariable, Binomial-/Normalmodell, Standardisierung, Stichprobenvariabilität, Generalisierungsgrenzen                      | Modellbedingungen explizit prüfen; Simulationspopulation und reale Zielpopulation trennen                          |
|   W06 | LI12–LI14             | Punkt-/Intervallschätzung, Standardfehler, Intervallbreite, frequentistische Interpretation, Wald-/Wilson-Grenzen                | Intervallverfahren, `n`, Erfolge/Misserfolge und Präzision reproduzieren; Repräsentativität getrennt beurteilen    |
|   W07 | LI14–LI16             | Null-/Alternativhypothese, Alpha, p-Wert, Fehlerarten, praktische Relevanz, gepaarte Vorher-Nachher-Daten                        | Differenzrichtung und vollständige Paarzahl prüfen; keine Wahrscheinlichkeit für H₀ und keine Kausalität behaupten |
|   W08 | LI17–LI19             | Streudiagramm, Pearson-Korrelation, lineare Regression, Steigung, Vorhersage, Residuum, Modellgüte, Extrapolation                | Regressionsrechnungen und Einheit reproduzieren; Beobachtungsbereich und Kausalitätsgrenze sichtbar halten         |
|   W09 | LI20–LI22             | Train/Test, Overfitting, Leakage, Domain Shift, Confusion Matrix, Accuracy, Precision, Recall, F1, Coverage                      | positive Klasse und jeden Nenner festlegen; Fehlkosten und nicht klassifizierte Fälle ausdrücklich berücksichtigen |
|   W10 | LI14, LI16, LI23–LI24 | integrierte Verfahrenswahl, Statistikbefund, Quellenstatus, Reproduzierbarkeit, adressatengerechte Aussage und Grenze            | keine neue Pflichtmethode; Zahlen und Aussagen auf LEHRDATEN oder klar begrenzte REPO-Nachweise zurückführen       |

Die redaktionellen IDs L01 bis L10 folgen der tatsächlichen Arrayreihenfolge. IR führt außerhalb des Import-JSON je ID Lernziel, primäre Lernrolle und höchste Risikoprüfung. Die Summe aus mittleren und schweren Fragen beträgt je Woche zehn; leichte Fragen und nicht curricular begründete Zusatzitems sind ausgeschlossen.

## 5. Runden-, Feedback- und Steuerungsregeln

### 5.1 Unbewertete Typen

- FREETEXT, SURVEY und RATING besitzen keine richtige Lösung, keine Lösungsquote und keine Punktefunktion für fachliche Auswertungen.
- LD berichtet bei diesen Typen ausschließlich Anzahl, Verteilung beziehungsweise kuratierte Themen und benennt den freiwilligen Charakter.
- Offene Beiträge werden vor Projektion oder Weiterverwendung moderiert. Wörtliche Freitexte werden nicht ungeprüft exportiert.

### 5.2 Bewertbare Typen und Peer Instruction

1. Lösung, Referenz oder korrekte Struktur bleibt bis zum Schließen von Runde 1 verborgen.
2. Bei didaktisch geeigneten Fragen folgen 60 bis 120 Sekunden Einzelbegründung beziehungsweise Peer-Austausch.
3. Runde 2 verwendet dieselbe fachliche Frage oder eine isomorphe Transferfassung desselben Typs.
4. `n_round1` und `n_round2` werden getrennt berichtet; für Scoring und Aggregation gilt die Effective-Vote-Regel.
5. Veränderung der Aggregate ist ein Lernsignal, kein Kausalnachweis und keine individuelle Kompetenzmessung.
6. Die Auflösung erklärt nicht nur die richtige Lösung, sondern kontrastiert den häufigsten plausiblen Fehler oder die häufigste fehlerhafte Struktur.

### 5.3 Numerische und strukturierte Fragen

- Für jede numerische Schätzung sind Referenzwert, Einheit, Eingabeformat, Wertebereich und Toleranz vor dem Import unabhängig reproduziert.
- Das Toleranzband bewertet die Schätzung und wird niemals als Konfidenzintervall bezeichnet.
- Matching-Paare, Ordering-Folge und Categorization-Zielkategorien werden vor der Freigabe von einer zweiten Person vollständig gelöst.
- Bei strukturierten Fragen wird nur eine vollständig richtige Struktur als vollständig korrekt ausgewiesen; Teilinformationen dürfen in der Besprechung lernförderlich genutzt, aber nicht als andere Volltrefferquote ausgegeben werden.

## 6. Export- und Lehrsteuerungsregeln

Nach `FINISHED` folgt der Ablauf des [Lehrenden-Runbooks](./P0-03_Lehrenden_Runbook.md#5-export--und-datenübergabe).

Zulässige bereinigte Felder sind:

- Paketversion, Woche, redaktionelle ID und Lauf,
- Fragetyp und Modus,
- Runde beziehungsweise Aggregationsrunde,
- `n_responses`, `correct_count` und `correct_share` nur für bewertbare Typen,
- Options-, Rating- oder Strukturhäufigkeiten in ausreichend großen Aggregaten,
- gegebenenfalls Confidence-Gruppe nach Unterdrückungsregel,
- kuratierte Freitextthemen ohne ungeprüfte Originalbeiträge,
- `source_kind` und `collection_mode`.

Nicht übernommen werden Name, Nickname, E-Mail-Adresse, Session-Code, Host-Token, Bonus, Rang, Score, individuelle Antwortzeit oder ungeprüfter Freitext. Bei Multiple Choice werden Optionsnennungen nicht als disjunkte Personengruppen behandelt. Survey- und Ratingverteilungen werden nicht als fachliche Richtigkeitsmaße interpretiert.

## 7. Technische und fachliche Freigabe

Eine Wochen-Datei ist erst freigegeben, wenn:

1. die JSON-Datei genau zehn Fragen enthält;
2. `order` lückenlos von 0 bis 9 reicht und den redaktionellen IDs L01 bis L10 entspricht;
3. jeder der zehn Enum-Typen `MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `FREETEXT`, `SHORT_TEXT`, `SURVEY`, `RATING`, `NUMERIC_ESTIMATE`, `MATCHING`, `ORDERING` und `CATEGORIZATION` genau einmal vorkommt;
4. jede Frage `difficulty=MEDIUM` oder `difficulty=HARD` und `timer=null` verwendet;
5. alle Einstellungen des Gamification-Profils aus Abschnitt 1.1 einschließlich `nicknameTheme=KINDERGARTEN` und der vier Team-Shortcut-Bezeichnungen im importierten Quiz geprüft sind;
6. Single Choice genau vier Optionen und genau eine richtige Lösung, Multiple Choice genau vier Optionen mit mindestens zwei richtigen und mindestens einer falschen Option sowie Survey genau vier unbewertete Optionen besitzt;
7. Auswahloptionen plausibel, eindeutig, grammatisch parallel und von vergleichbarer Länge sind und die Lösung nicht formal verraten;
8. Freitext, Rating, numerische Schätzung und strukturierte Typen keine gewöhnlichen Antwortoptionen enthalten; Short Text ausschließlich gültige, als richtig markierte Musterlösungen enthält;
9. Rating, numerische Schätzung, Matching, Ordering und Categorization ihre typgerechten Pflichtfelder und Grenzen erfüllen;
10. Referenzwerte, Berechnungen, Einheiten, Rundungen sowie Matching-, Ordering- und Categorization-Schlüssel unabhängig reproduziert sind;
11. Confidence nur bei unterstützten bewertbaren Typen aktiviert ist;
12. Frage, Optionen und strukturierte Elemente vorgelesen werden können, Farbe nicht allein codiert und Formeln beziehungsweise Tabellen auf Mobilgerät sowie Projektion verständlich sind;
13. die typgerechte untimierte Alternative für alle zehn Typen denselben Wortlaut, dieselben Elemente, dasselbe Lernziel und dieselbe Auflösung besitzt;
14. die Nutzung auf Lehrsteuerung und interne Modulverbesserung begrenzt ist und weder individuelle Bewertung noch Aussagen über Produktivqualität angelegt sind;
15. der vollständige Wochenpool in einer Probesession importiert, in Teilnehmer- und Hostansicht durchlaufen und nach dem Export gegen den Blueprint geprüft wurde.

Erst danach importiert LD die Datei für den realen Wochenlauf.
