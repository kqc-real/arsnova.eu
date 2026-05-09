# Produktionslasttest 500 Teilnehmende fuer Session 6LTFZF am 2026-05-09

## Zweck

Dieses Dokument haelt den am 2026-05-09 gegen die Produktionsinstanz `https://arsnova.eu` durchgefuehrten realen 500er-Lasttest fuer die Session `6LTFZF` fest.

## Zielsession

- Join-URL: `https://arsnova.eu/de/join/6LTFZF?join=6LTFZF`
- Session-Code: `6LTFZF`
- Session-ID: `f64bdc32-107e-41db-9396-4510093e633b`
- Modus zum Testzeitpunkt: `LOBBY`
- Quizname: `Praxis-Showcase: Live-Teamdemo`

Vor dem Lastlauf wurde geprueft:

- Produktions-Health-Endpoint erreichbar
- Join-Seite erreichbar
- `session.getInfo` liefert gueltige Sessiondaten

## Gefahrener Lauf

### Join-Welle

- Lastgenerator: `k6`
- Skript: `scripts/load/k6-session-hotpaths-500vu.js`
- Modus: `join-wave`
- Last: 500 VUs
- Dauerfenster: 15 Sekunden Polling nach erfolgreichem Join
- Zielsystem: `https://arsnova.eu`

## Ergebnis

- 500 VUs komplett durchgelaufen
- 0 HTTP-Fehler
- 0 Check-Fehler
- Session danach mit `participantCount = 500` bestaetigt

### Gemessene Werte

- `http_req_duration avg = 1.25 s`
- `http_req_duration median = 997.57 ms`
- `http_req_duration p90 = 2.81 s`
- `http_req_duration p95 = 3.57 s`
- `http_req_duration max = 6.7 s`
- `http_req_failed = 0.00 %`

## Interpretation

Der Produktionslauf zeigt:

- **funktional bestanden**
  - alle 500 Joins wurden erfolgreich verarbeitet
  - keine HTTP-Fehler
  - die Session hielt danach tatsaechlich 500 Teilnehmende

- **qualitativ im Grenzbereich**
  - das bisher angesetzte Ziel `p95 < 3 s` wurde mit `3.57 s` verfehlt
  - die Join-Welle ist damit auf Produktion zwar moeglich, aber bereits klar im Grenzbereich

## Fachliche Bewertung

Fuer die Bewertung der Plattformreichweite ist das Ergebnis stark:

- 500 reale gleichzeitige Joins auf der Produktionsinstanz sind machbar

Fuer die Bewertung der Nutzererfahrung bleibt aber ein Vorbehalt:

- die Join-Latenz ist unter realer Produktionslast bereits deutlich erhoeht
- damit ist die Plattform fuer einen 500er-Join nicht instabil, aber sichtbar belastet

## Noch nicht durchgefuehrte Folgephasen

Ein realer Produktionsfolge-Lauf fuer

- aktive Frage
- Statuswechsel unter Host-Steuerung
- Vote-Spike

wurde **noch nicht** gefahren.

### Grund

Fuer diese Folgephasen fehlen aktuell mindestens eine der folgenden Voraussetzungen:

- Host-Steuerung fuer genau diese Session
- Host-Token fuer Statuswechsel (`nextQuestion`, `revealAnswers`, `revealResults`)
- reale Teilnehmer-IDs oder ein kontrollierter Testkontext fuer denselben Fragepfad
- aktiver Fragekontext mit bekannter `questionId` und `answerId`

Ohne diese Daten waere ein weiterer Produktionslauf nicht mehr sauber kontrolliert und wuerde den Status der Session nicht reproduzierbar beeinflussen.

## Beobachtungen aus dem anschliessenden realen Host- und Teilnehmerbetrieb

Nach dem Join-Lauf wurde die Session real weiterbenutzt. Dabei traten mehrere wichtige Produktionsbefunde auf.

### 1. Session liess weiterhin weitere Teilnehmende zu

Beobachtung:

- ein weiterer realer Teilnehmer konnte nach dem 500er-Lauf noch als `501.` beitreten
- der Beitritt gelang ueber ein Tier-Icon-Pseudonym im Team `Apfel`
- im Host wurden anschliessend zeitweise `502` Teilnehmende insgesamt, aber nur `2` verbundene Clients angezeigt
- obwohl die Session auf das Kindergarten-Pseudonymset konfiguriert war, trugen die `500` per `k6` erzeugten Lasttest-Teilnehmenden synthetische Namen vom Muster `k6-...`
- fuer den zusaetzlichen realen Tier-Icon-Teilnehmenden war auf der Teamkarte kein sichtbarer Foyer-Einflug zu sehen

Einordnung:

- die Plattform besitzt derzeit **keine harte Session-Obergrenze bei 500**
- das ist technisch konsistent mit dem Pseudonym-Fallback nach Erschoepfung des Ursprungssatzes
- fuer Lasttests bedeutet das: `500` ist aktuell kein hartes Cap, sondern nur die Zielgroesse des Tests
- die beiden Host-Werte beschreiben unterschiedliche Groessen:
  - `Teilnehmende gesamt` zaehlt die in der Session vorhandenen Teilnehmerobjekte
  - `verbunden` zaehlt nur die zum Messzeitpunkt noch aktiv erkannten Clients
- die Kombination `502 gesamt`, aber nur `2 verbunden` ist fuer diesen Lasttest plausibel, weil die erzeugten Lasttest-Clients nach dem Join nur kurz aktiv waren und danach nicht als dauerhaft verbundene Live-Clients in der Session verblieben
- die hohe Gesamtzahl bei sehr kleiner Zahl verbundener Clients ist daher kein Hinweis auf verlorene Teilnehmende, sondern auf die notwendige semantische Trennung zwischen Session-Gesamtzahl und aktueller Live-Verbindung
- die synthetischen `k6-...`-Namen wurden im Kindergarten-Theme nicht als Tier-Icons erkannt; sie erschienen deshalb nur als normale Text-/Kurzlabel auf den Teamkarten
- der fehlende Einflug des realen Tier-Icon-Teilnehmers ist in diesem Lastbild dennoch **kein eigener Fehlerbefund**, weil die Teamfoyer-Animation bei grossen Join-Wellen bewusst global gedrosselt bzw. unterdrueckt wird
- fuer Produktionsbeobachtungen nach einem 500er-Join ist deshalb korrekt zu erwarten:
  - Teamkarten aktualisieren sich weiter
  - einzelne spaete reale Beitritte koennen sichtbar auf der Karte erscheinen
  - ein animierter Einflug ist unter dieser Hochlast aber gerade **nicht** mehr garantiert

### 2. Reading-Ready-Anzeige auf dem Host wirkte fachlich irrefuehrend

Beobachtung:

- der reale Teilnehmer konnte eine Lesebestaetigung ohne Probleme abgeben
- auf dem Host wurde dies jedoch bereits als sinngemaess `alle bereit` angezeigt, obwohl offensichtlich nicht alle 500+ Teilnehmenden bestaetigt hatten

Technische Einordnung:

- die Reading-Ready-Logik bewertet nicht alle Session-Teilnehmenden, sondern die aktuell als verbunden erkannten Clients
- dadurch kann `1 von 1 bereit` fachlich korrekt, aber fuer Grossveranstaltungen semantisch irrefuehrend sein

Bewertung:

- kein zwingender Persistenzfehler
- aber ein **UX- und Betriebsproblem** fuer grosse Sessions

### 3. Host-Vote-Fortschritt blieb waehrend ACTIVE sichtbar stale

Beobachtung:

- auf dem Teilnehmer-Client kam die Frage sofort an
- die Antwort konnte problemlos abgegeben werden
- die persoenliche Punktebewertung war korrekt
- auf dem Host blieb der Fortschritt jedoch auch nach Countdown-Ende bei `0 von 501 haben abgestimmt`

Technische Einordnung:

- die Stimme wurde sehr wahrscheinlich korrekt persistiert und gewertet
- der Host-Pfad fuer Frage-/Vote-Daten wurde waehrend `ACTIVE` jedoch nicht zeitnah genug aktualisiert
- damit ist der Host-Fortschritt in diesem Produktionsszenario **nicht verlaesslich live**

Bewertung:

- **echter Live-Update-Bug im Host-Pfad**
- fuer einen Konferenzbetrieb mit 500 Teilnehmenden kritisch

### 4. Teamwertung blieb trotz korrekter Einzelwertung bei null

Beobachtung:

- die persoenliche Wertung des realen Teilnehmers war korrekt
- die Teamwertung wurde jedoch nicht sichtbar erhoeht
- bei beiden Teams blieben die angezeigten Werte auf `0`

Technische Einordnung:

- die Teamwertung wird als normalisierte Durchschnittswertung ueber die Teamgroesse berechnet
- bei sehr grossen Teams und nur wenigen bereits gewerteten Antworten kann diese Normalisierung frueh auf `0` runden
- dadurch wird die Teamwertung fuer grosse Teams im Fruehstadium faktisch unsichtbar

Bewertung:

- kein zwingender Vote-Verlust
- aber die aktuelle Teamscore-Logik ist fuer fruehe Live-Phasen mit grossen Teams **fachlich und UX-seitig untauglich**

## Zusammenfassende Bewertung der Folgebeobachtungen

Die Produktionsbeobachtungen nach dem Join-Lauf zeigen:

- **Join auf Produktion:** technisch moeglich
- **Reading-Ready auf Produktion:** semantisch fuer Grosslast irrefuehrend
- **Host-Vote-Fortschritt waehrend ACTIVE:** aktuell nicht verlaesslich
- **Teamwertung bei grossen Teams:** aktuell nicht aussagekraeftig

Damit ist die 500er-Faehigkeit aktuell sehr differenziert zu bewerten:

- **Join-Reichweite:** ja
- **stabiler und glaubwuerdiger Live-Moderationsbetrieb mit Teammodus:** derzeit nicht belastbar bestaetigt

## Fazit

Der reale Produktions-Join-Test fuer `6LTFZF` ist technisch erfolgreich verlaufen.

Die Plattform hat 500 gleichzeitige Join-Vorgaenge auf Produktion ohne Fehler getragen, liegt dabei aber bei der Join-Latenz bereits im Grenzbereich. Fuer eine belastbare Gesamtfreigabe eines 500er-Konferenzszenarios fehlen weiterhin:

- ein produktionsnah oder real gefahrenes Active-Question-Szenario,
- ein Vote-Spike auf derselben Produktionsumgebung,
- und idealerweise Monitoringdaten von CPU, RAM, PostgreSQL, Redis und Netzwerk waehrend des Laufs.

Zusaetzlich muessen vor einer positiven Gesamtbewertung mindestens diese Punkte bereinigt oder neu verifiziert werden:

- Host-Vote-Fortschritt waehrend `ACTIVE`
- Semantik der Reading-Ready-Anzeige bei Grosslast
- Teamscore-Darstellung und Teamwertungslogik fuer grosse Teams

## Abgeleitete Fix-Punkte

Aus den Produktionsbefunden vom 2026-05-09 ergeben sich folgende konkreten Arbeitspakete.

### Prioritaet A: vor einer positiven 500er-Gesamtfreigabe

1. **Host-Vote-Fortschritt waehrend `ACTIVE` live nachziehen**

- Der Host muss den Fortschritt `x von n haben abgestimmt` waehrend aktiver Fragen verlaesslich aktualisieren.
- Stimmen duerfen nicht nur fuer die persoenliche Wertung korrekt verarbeitet werden, sondern muessen auch im Moderationspfad sichtbar ankommen.
- Ziel:
  - bei eingehenden Votes eventgetriebene Aktualisierung des Host-Fragestatus
  - keine dauerhaft stale Fortschrittsanzeige bei laufendem Countdown

2. **Reading-Ready semantisch korrekt fuer Grosslast darstellen**

- Die aktuelle Anzeige mischt faktisch `bereit von verbunden` mit einer Interpretation, die wie `bereit von allen Teilnehmenden` wirkt.
- Fuer Grossveranstaltungen muss klar getrennt werden zwischen:
  - allen Session-Teilnehmenden,
  - aktuell verbundenen Teilnehmenden,
  - davon bereit gemeldeten Teilnehmenden.
- Ziel:
  - Label, Tooltip und Zaehlweise fachlich eindeutig machen
  - keine implizite Aussage `alle bereit`, wenn nur `1 von 1 verbunden bereit` gemeint ist

3. **Teamscore fuer grosse Teams sichtbar und aussagekraeftig machen**

- Die aktuelle Normalisierung macht fruehe Teamwerte bei sehr grossen Teams praktisch unsichtbar.
- Fuer Live-Moderation ist das ungeeignet, weil erste echte Wertungsunterschiede nicht sichtbar werden.
- Ziel:
  - Teamwertung in fruehen Live-Phasen nicht auf `0` nivellieren
  - Anzeige und Berechnung so anpassen, dass auch grosse Teams frueh differenzierbar bleiben

### Prioritaet B: fuer belastbaren Host-Betrieb mit Teammodus

4. **Teamkarten-Aufbau auf dem Host stabilisieren**

- Wenn der Gesamtzaehler bereits `500` zeigt, duerfen Teamkarten nicht ueber Minuten weiter nachlaufen oder permanent sichtbar zucken.
- Der Team-/Teilnehmerpfad muss Update-Wellen besser buendeln.
- Ziel:
  - Teilnehmer-Updates fuer den Host zusammenfassen oder drosseln
  - unnötige Re-Renders der Teamkarten reduzieren
  - Teamdarstellung nach Join-Wellen innerhalb weniger Sekunden stabilisieren

5. **Produktions-Nachtest fuer Teammodus definieren**

- Nach Behebung der Punkte 1 bis 4 ist ein gezielter Produktions- oder produktionsnaher Nachtest noetig.
- Dieser Test muss ausdruecklich pruefen:
  - Reading-Ready bei vielen Teilnehmenden
  - Host-Vote-Fortschritt waehrend `ACTIVE`
  - Teamscore-Sichtbarkeit
  - Beruhigung der Teamkarten nach Join-Wellen

## Konsequenz fuer die aktuelle Bewertung

Bis zur Abarbeitung der Prioritaet-A-Punkte sollte fuer `arsnova.eu` folgende Bewertung gelten:

- **500 gleichzeitige Joins:** technisch moeglich
- **500 stabile Team-Live-Moderation:** aktuell nicht belastbar freigegeben
- **500er-Szenario ohne Teammodus:** wahrscheinlicher erreichbar als mit Teammodus, aber weiter nach Gesamtlasttest zu verifizieren

## Nachtrag: Umsetzungsstand nach lokalem Retest

Die Prioritaet-A-Punkte aus diesem Produktionsbefund wurden anschliessend lokal umgesetzt und erneut unter `500` Teilnehmenden getestet.

Lokal verifiziert:

- Host-Vote-Fortschritt waehrend `ACTIVE` aktualisiert sich live
- Reading-Ready unterscheidet nun sichtbar zwischen verbundenen und gesamten Teilnehmenden
- Teamwertung bleibt bei grossen Teams nach `RESULTS` sichtbar ungleich `0`
- Teamfoyer-Animationen werden bei grossen Join-Wellen gedrosselt bzw. unterdrueckt
- im Teammodus ist damit auch fuer echte Kindergarten-/Tier-Icon-Nutzende unter hoher Gesamtlast kein individueller Einflug mehr zu erwarten; die Beruhigung der Teamkarten hat Vorrang vor Show-Effekten

Damit ist dieser Produktionsbefund fachlich **nicht mehr der aktuelle lokale Entwicklungsstand**, sondern der Ausgangspunkt fuer den nun noetigen Produktions-Retest derselben Pfade.

Offen fuer Produktion:

- Sichtpruefung des Host-Fortschritts waehrend `ACTIVE`
- Sichtpruefung der Reading-Ready-Texte unter realer Grosslast
- Sichtpruefung der Teamwertung und der Beruhigung der Teamkarten nach einer Join-Welle
