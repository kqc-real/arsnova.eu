# Numeric Estimate: UX-, Statistik- und Performance-Leitplanken

Erkenntnisse aus manueller Smoke-/Review-Arbeit zur Schätzfrage im Chat.

## Host-UX

- Die grafische Ergebnisdarstellung muss für Lehrveranstaltungen und Beamer verständlich sein; ein leeres oder kaum lesbares Referenz-/Toleranzband ist nicht akzeptabel.
- Bei Jahresfragen keine Dezimalpunkte anzeigen. Achsen, Referenzwert und Intervallenden müssen wie Jahreszahlen wirken.
- Referenzwert, besonders Beispiel 1789, muss direkt ablesbar sein; Count-Badge darf Referenz-Badge nicht überdecken.
- Histogramm nach Freigabe muss Referenzlinie, Toleranzband, Achsen und Balken klar unterscheidbar darstellen.
- Statistikwerte nicht symbolschwer in einer dichten Zeile zeigen. Besser: visuell ruhige Karten mit verständlichen Labels, optionalem Hilfetext und erst nach Nutzeraktion sichtbar.
- Detailstatistiken gehören in einen Expander/Button und nicht permanent in die Live-Hauptansicht.
- Host braucht Scoreboard/Teamstand, wenn Teammodus aktiv ist.

## Vote-UX

- Teilnehmende sollen sofort verstehen, dass eine Zahl geschätzt wird und welches Format erlaubt ist.
- Persönlicher Score muss nach Ergebnisfreigabe auf der Vote-Ansicht sichtbar sein.
- Während aktiver Abstimmung darf keine Lösungsnähe, kein Toleranztreffer und keine Verteilung sichtbar sein.
- Die Eingabe soll für Komma-Lokalen funktionieren: kein `input type="number"` für numerische Schätzfragen; stattdessen `type="text"` plus passendes `inputmode`.
- Zweite Runde darf nicht durch UI-Reste aus Runde 1 verwirren; lokale gespeicherte Antworten müssen rundenbezogen sein.

## Statistikbegriffe für UI

- `n`: Anzahl der abgegebenen Schätzungen in der betrachteten Runde.
- Mittelwert: Summe aller Schätzungen geteilt durch `n`; anfällig für Ausreißer.
- Median: mittlerer Wert der sortierten Schätzungen; robuster gegen Ausreißer.
- Standardabweichung `σ`: typische Streuung um den Mittelwert.
- IQR: Interquartilsabstand zwischen Q1 und Q3; zeigt Streuung der mittleren 50%.
- Anteil im Band: Prozent der Schätzungen, die im Toleranzintervall liegen.
- MAE: Mean Absolute Error, mittlerer absoluter Abstand zum Referenzwert; nur sinnvoll, wenn ein Referenzwert vorhanden ist.
- Toleranzgrenzen im absoluten Modus kommen direkt aus `numericIntervalLeft`/`numericIntervalRight`.
- Toleranzgrenzen im relativen Modus kommen aus `V ± abs(V) * p / 100`; `V = 0` ist fachlich zu vermeiden/zu validieren.

## Performance und Datenschutz bei ca. 200 Teilnehmenden

- Während `ACTIVE` nur neutralen Fortschritt aktualisieren, keine Ergebnisdaten berechnen oder ausliefern.
- Histogramm, Statistik und Paaranalyse erst nach Ergebnisfreigabe berechnen/rendern.
- Host-UI soll nicht bei jeder Stimmabgabe große Ergebnisobjekte neu rendern; teure Daten erst lazy nach Freigabe/Expander laden oder darstellen.
- Keine vollständigen Vote-Listen an Clients senden, wenn aggregierte Daten ausreichen.
- Runde-1/Runde-2-Auswertung möglichst aus gemeinsam geladenen Votes ableiten, nicht dieselben Votes mehrfach abfragen/sortieren.
- Unnötige Scorecard-Requests für unbewertete Typen vermeiden.
- Animationen nur nach Ergebnisfreigabe und `prefers-reduced-motion: reduce` berücksichtigen.

## Smoke-Test-Erwartung

- Der Smoke-Test soll Dark Theme, zwei Teams, Host und mehrere Clients abdecken.
- Für Review-Zwecke Screenshots pro Interaktion auf Host und Client erzeugen, inklusive geöffnetem Statistik-Expander in der Host-Ansicht.
- Relevantes Szenario: Frage nach dem Jahr der Französischen Revolution, ca. 20 simulierte Abstimmungen, zwei Runden, Prüfung dass Clients nach Ergebnisfreigabe Auswertung/persönlichen Score bekommen.
