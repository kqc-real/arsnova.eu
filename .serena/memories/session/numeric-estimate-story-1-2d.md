# Story 1.2d: Numerische Schätzfrage

Stand aus PR-/Review-Arbeit am 2026-06-17. `NUMERIC_ESTIMATE` ist als eigener didaktischer Fragentyp zu behandeln, nicht als Variante von `SHORT_TEXT`.

## Funktionale Kernregeln

- Der Typ muss konsistent in Shared Types, Backend, Datenmodell, Quiz-Editor, Session-Flow, Host-Ansicht und Vote-Flow integriert sein.
- Lehrkräfte müssen Schätzfragen vollständig anlegen können: Integer/Decimal, maximale Nachkommastellen, erlaubter Eingabebereich `numericMin`/`numericMax`, Toleranzmodus und optionaler Referenzwert.
- Komma- und Punkt-Eingaben müssen konsistent geparst werden; Whitespace wie `1 000` soll unterstützt werden.
- Integer-Fragen dürfen keine Dezimalwerte akzeptieren; Decimal-Fragen müssen die maximale Zahl der Nachkommastellen client- und serverseitig einhalten.
- Toleranzmodi:
  - `ABSOLUTE_INTERVAL`: linke und rechte Grenze, `L < R` erzwingen.
  - `RELATIVE_PERCENT`: Referenzwert `V` und Prozentwert `p`; `V = 0` muss verständlich und robust verhindert werden.
- Erlaubter Eingabebereich ist nicht dasselbe wie richtiges Toleranzintervall; die UI muss diese Begriffe klar trennen.
- Serverseitige Validierung ist maßgeblich. Manipulierte oder ungültige Client-Eingaben dürfen nicht gespeichert werden.
- Eine Antwort ist genau dann richtig, wenn der geparste numerische Wert im aufgelösten Toleranzintervall liegt.
- `numericReferenceValue` darf auch bei absolutem Intervall erhalten bleiben, weil Ergebnisansicht, Referenzlinie, Fehlermaße und Rundenvergleich ihn nutzen können.

## Zwei-Runden-Flow

- Ziel-Flow: Runde 1 -> optionale Diskussion -> Runde 2 -> Ergebnisfreigabe -> Auswertung.
- Lehrkraft muss jederzeit erkennen: aktuelle Runde, wer abstimmen darf, Status Diskussion/Abstimmung/Ergebnisanzeige, ob Ergebnisse freigegeben sind, ob Runde 2 aktiv/optional ist.
- Runde 1 und Runde 2 müssen getrennt gespeichert werden.
- Paarweise Auswertung braucht stabile Zuordnung pro Teilnehmer/in; Teilnehmende mit nur einer Runde müssen robust behandelt werden.
- Frage muss auch ohne zweite Runde als einfache Schätzfrage funktionieren.
- Leere Runde 2 und Teilabgaben dürfen die Ergebnisansicht nicht brechen.

## Datenschutz und Herdeneffekt

- Während `ACTIVE` und vor Ergebnisfreigabe dürfen weder Host noch Teilnehmende Schätzlagen sehen.
- Erlaubt sind nur neutrale Fortschrittsinformationen wie `submittedCount`, `participantCount`, Status und Runde.
- Nicht vor Freigabe senden oder anzeigen: Histogramm, Buckets, Rohwerte, Min/Max der Abgaben, Median, Mittelwert, Toleranztreffer, Korrektheitsindikatoren, Peer-Instruction-Empfehlungen auf Basis von Lösungsnähe.
- Teilnehmende dürfen während aktiver Abstimmung nicht erfahren, ob ihre Eingabe nah am Referenzwert oder im Toleranzband liegt.
- Live-Ansichten sollen nur aggregierte Daten zeigen und keine personenbezogenen Einzelwerte öffentlich machen.
