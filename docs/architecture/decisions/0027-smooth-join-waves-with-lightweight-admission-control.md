<!-- markdownlint-disable MD013 -->

# ADR-0027: Join-Wellen mit leichtgewichtiger Admission Control glätten

**Status:** Accepted  
**Datum:** 2026-05-09  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

arsnova.eu muss bei Live-Veranstaltungen nicht nur dauerhafte Parallelitaet aushalten, sondern auch kurzfristige Lastspitzen, wenn viele Teilnehmende nahezu gleichzeitig einer Session beitreten.

Solche Join-Wellen sind fuer die Plattform besonders kritisch, weil sie mehrere Lastarten kombinieren:

- viele gleichzeitige `getInfo`-Abfragen
- Nickname- und Teilnehmerlistenabfragen
- eigentliche `join`-Operationen
- nachgelagerte Status- und Session-Updates

Bei grossen Veranstaltungen, insbesondere im Bereich von mehreren hundert Teilnehmenden, entsteht dadurch keine gleichmaessige Last, sondern eine kurze, steile Spitze.

Diese Spitze ist architektonisch problematischer als eine etwas hoehere, aber gleichmaessige Dauerlast. Sie kann:

- Datenbank und Redis kurzfristig ueberfahren
- Join-Latenzen sichtbar erhoehen
- Folgeeffekte auf Vote- und Realtime-Pfade ausloesen
- den Eindruck erwecken, die Plattform sei instabil, obwohl spaeter wieder Normalbetrieb moeglich waere

Wir brauchen deshalb eine verbindliche Entscheidung, wie Join-Wellen kuenftig behandelt werden: nicht erst reaktiv durch groessere Infrastruktur, sondern proaktiv durch kontrollierte Lastglattung.

## Entscheidung

### 1. Join-Wellen werden kuenftig proaktiv geglaettet

arsnova.eu fuehrt fuer grosse gleichzeitige Beitrittswellen ein Konzept der **leichtgewichtigen Admission Control** ein.

Ziel ist nicht, Nutzende in eine sichtbare harte Warteschlange zu zwingen, sondern:

- die Lastspitze beim Beitritt zeitlich leicht zu entkoppeln
- Join-Vorgaenge in kleinen Gruppen oder kurzen Zeitscheiben zu glatten
- den eigentlichen Session-Betrieb vor Beitritts-Spikes zu schuetzen

Die Plattform darf Teilnehmende dabei **leicht verzoegert, aber kontrolliert** aufnehmen.

### 2. Bevorzugt wird ein Soft-Queue-/Batch-Modell statt einer harten Warteschlange

Fuer arsnova.eu wird kein klassisches Queue-Modell mit langen Wartezeiten, Platznummern oder explizitem "Bitte warten, bis Sie an der Reihe sind" bevorzugt.

Stattdessen gilt:

- Teilnehmende sollen moeglichst frueh das Gefuehl haben, bereits im Beitrittsprozess zu sein
- die schwere Aufnahme in die Session darf intern leicht gestaffelt erfolgen
- die Verzoegerung soll kurz und moeglichst unauffaellig bleiben

Bevorzugtes Zielbild:

- schneller Vorpruefungs- oder Ankommensschritt
- danach kontrollierte Aufnahme in kleinen Batches
- erst danach volle Session-Teilnahme mit allen Folgedaten

### 3. Join wird logisch in leichte und schwere Schritte getrennt

Der Join-Prozess soll kuenftig bevorzugt so entworfen werden, dass er nicht als ein einziger schwerer, synchroner Gesamtvorgang behandelt wird.

Stattdessen sind mindestens zwei Schichten zu unterscheiden:

1. **leichte Vorstufe**
   - Session-Code pruefen
   - Session offen/gueltig pruefen
   - minimale UI-Info liefern

2. **kontrollierte Vollaufnahme**
   - Nickname-Vergabe
   - Teilnehmeranlage
   - detailliertere Session-Zustaende
   - nachgelagerte Folgeschritte

Damit wird festgelegt, dass die Plattform den teuren Teil des Join-Prozesses kontrolliert staffeln darf, ohne den Nutzerfluss unnoetig zu unterbrechen.

### 4. Admission Control soll bevorzugt kurz, transparent und UX-schonend sein

Wenn Join-Wellen geglaettet werden, gelten folgende UX-Leitplanken:

- keine unnötig technischen Begriffe wie Queue, Slot oder Admission im UI
- klare, ruhige Rueckmeldung wie:
  - "Du wirst gerade mit der Session verbunden."
  - "Die Session wird vorbereitet."
- keine langen Blockierdialoge ohne Fortschrittswahrnehmung
- Wartezeiten nur so lang wie technisch notwendig

Eine kurze Verzoegerung von wenigen Sekunden ist fuer Grossveranstaltungen akzeptabel, wenn sie Lastspitzen deutlich reduziert und den Gesamtbetrieb stabilisiert.

### 5. Admission Control wird bevorzugt durch Batching, Jitter oder Join-Tickets umgesetzt

Die konkrete technische Umsetzung ist offen, soll sich aber an folgenden bevorzugten Mustern orientieren:

1. **Batching**
   Join-Aufnahmen werden in kleinen Gruppen verarbeitet.

2. **Jitter**
   kurze, server- oder clientseitig gesteuerte Mikroverzoegerung, um Gleichzeitigkeit aufzubrechen.

3. **Join-Tickets / Slots**
   ein leichter Vorab-Schritt gibt frei, wann die volle Join-Verarbeitung stattfinden darf.

4. **gestufter Join**
   minimale Session-Sicht vor voller Teilnahme.

Nicht bevorzugt sind:

- lange explizite Warteschlangen
- aufwendige Queue-Positionen im UI
- komplexe Fairness-Logik, wenn eine einfache Lastglattung ausreicht

### 6. Join-Glattung ist eine primaere Antwort vor Infrastruktur-Upgrades

Wenn Join-Wellen Lastprobleme verursachen, ist die bevorzugte Reaktion:

1. Join-Pfad glatten
2. Nebenabfragen reduzieren
3. Join-Folgelasten staffeln oder cachen
4. erst danach Infrastruktur vergroessern

Damit wird explizit festgelegt:

- ein groesserer Server kann helfen,
- ersetzt aber keine saubere Behandlung kurzer extremer Parallelspitzen.

### 7. Die Wirkung wird szenariobasiert fuer Grossveranstaltungen bewertet

Admission Control fuer Join-Wellen gilt nur dann als erfolgreich, wenn sie in realistischen Szenarien wirkt, insbesondere:

- 100 Teilnehmende in kurzer Zeit
- 250 Teilnehmende in kurzer Zeit
- 500 Teilnehmende in kurzer Zeit

Zu pruefen sind dabei mindestens:

- Join-Latenz
- Erfolgsquote
- Fehlerrate
- Datenbank- und Redis-Spitzenlast
- Folgeeffekte auf laufende Session- und Vote-Pfade

Damit wird festgelegt, dass Join-Glattung kein rein theoretisches Muster bleibt, sondern messbar gegen reale Lastprofile bewertet wird.

## Konsequenzen

### Positiv

- Join-Spitzen werden abgeflacht, bevor sie Datenbank, Redis oder Hotpaths ueberfahren.
- Grosse Veranstaltungen werden stabiler, auch wenn die absolute Infrastruktur unveraendert bleibt.
- Die Plattform behandelt Beitrittslast als eigenen Architekturfall statt als Nebeneffekt.
- Der Nutzerfluss bleibt weicher als bei einer klassischen harten Warteschlange.

### Negativ / Risiken

- Mehr Komplexitaet im Join-Prozess.
- Zusatzzustaende und zeitliche Staffelung muessen sauber modelliert werden.
- Bei schlechter UX kann eine auch kurze Verzoegerung als "haengt" wahrgenommen werden.
- Admission Control muss fair und robust gegen Wiederholungen, Reloads und Reconnects sein.

## Alternativen (geprueft)

- **Join sofort und ungeglattet verarbeiten:** verworfen, weil gerade kurze Parallelspitzen so am teuersten sind.
- **Nur Infrastruktur vergroessern:** verworfen, weil dies Spitzen glattet, aber das strukturelle Problem nicht loest.
- **Klassische harte Warteschlange mit Positionsanzeige:** verworfen, weil sie fuer den typischen arsnova.eu-Join zu schwergewichtig ist.
- **Nur clientseitiger Zufalls-Delay ohne serverseitige Kontrolle:** verworfen, weil dies allein zu unpraezise und leicht umgehbar ist.

## Umsetzungsleitplanken

- Join-Wellen fuer grosse Sessions duerfen kontrolliert geglaettet werden.
- Die schwere Vollaufnahme in die Session muss nicht fuer alle gleichzeitig erfolgen.
- Das UI soll kurze technische Verzoegerungen als ruhigen Verbindungszustand kommunizieren.
- Nickname-, Teilnehmer- und Session-Nebenabfragen sind im Join-Kontext getrennt auf ihre Lastwirkung zu betrachten.
- Lasttests fuer Grossveranstaltungen muessen Join-Wellen explizit als eigenes Szenario enthalten.

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-05-09:

- Join-Wellen sind als einer der primaeren roten Hotpaths identifiziert.
- Ein leichtgewichtiger Admission-Control-Mechanismus ist serverseitig umgesetzt.
- Neue Joins werden pro Session in kurzen Zeitfenstern kontrolliert geglaettet, statt ungefiltert gleichzeitig in den schweren Create-Pfad zu laufen.
- Rejoins mit gueltigem `rejoinToken` bleiben davon bewusst ausgenommen.
- Die Join-Glattung wurde am 2026-05-09 in einem realen lokalen 500er-Lastlauf verifiziert:
  - 500 VUs
  - 0 Fehler
  - `p95 http_req_duration = 204.3 ms` im Hauptlauf
  - `p95 http_req_duration = 147.52 ms` im Post-Fix-Rerun
- Die ADR ist damit nicht mehr nur richtungsgebend, sondern bereits konkret implementiert und erfolgreich gegen reale Parallelitaet getestet.

Stand 2026-05-31:

- Der Implementierungsstand bleibt gueltig; `joinAdmission.ts` ist der fachliche Ort fuer die leichtgewichtige Glattung.
- Rejoins mit gueltigem Rejoin-Token bleiben ausgenommen, damit Recovery nicht kuenstlich gebremst wird.
- Der Join-Pfad aktualisiert Plattform- und Tagesrekorde weiterhin fire-and-forget, ohne die eigentliche Aufnahme zu blockieren.

---

**Referenzen:** [ADR-0013: k6 und Artillery fuer Last- und Performance-Tests](./0013-use-k6-and-artillery-for-load-and-performance-testing.md), [ADR-0025: Zukuenftige Erweiterungen standardmaessig als performance-kritisch behandeln](./0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md), [ADR-0026: Performance-Hotpaths priorisieren und Telemetrie-Nebenlast konsequent entkoppeln](./0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md), [session.ts](../../../apps/backend/src/routers/session.ts), [join.component.ts](../../../apps/frontend/src/app/features/join/join.component.ts).
