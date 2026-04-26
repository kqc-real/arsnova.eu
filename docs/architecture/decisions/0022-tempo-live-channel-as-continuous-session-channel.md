<!-- markdownlint-disable MD013 -->

# ADR-0022: Tempo-Livekanal als kontinuierlicher Session-Kanal

**Status:** Accepted  
**Datum:** 2026-04-26  
**Entscheider:** Projektteam

## Kontext

Mit `ADR-0009` wurde arsnova.eu als **eine Live-Session mit mehreren Kanälen** modelliert. Der aktuelle Produktstand deckt dabei insbesondere folgende Modi ab:

- **Quiz** mit statusgetriebenen Fragen und Ergebnissen
- **Q&A** mit schriftlicher Einreichung und Moderation
- **Blitzlicht** als kurze, punktuelle Live-Abfrage

Für den Live-Einsatz in Vorträgen, Seminaren und Lehrveranstaltungen fehlt jedoch ein weiterer, fachlich eigenständiger Kanal:

- Teilnehmende sollen **jederzeit** mit einem Tap rückmelden können, ob das Tempo passt.
- Die Rückmeldung soll **kontinuierlich**, **anonym** und **änderbar** sein.
- Die Lehrperson soll nur **aggregierte** Signale sehen, keine individuellen Meldungen.
- Der Kanal soll **parallel** zu Quiz, Q&A und Blitzlicht laufen, ohne deren Lebenszyklen zu übernehmen.

Das bestehende Blitzlicht ist dafür fachlich ungeeignet:

- Blitzlicht ist **punktuell**, nicht dauerhaft.
- Blitzlicht ist heute technisch auf **Runden**, **Lock/Reset**, **Einmal-Vote** und teils **Vergleichsrunden** ausgelegt.
- Die vorhandene `quickFeedback`-Logik würde den Tempo-Kanal semantisch in die falsche Richtung ziehen.

Gleichzeitig muss die Lösung zu den bestehenden Architekturleitplanken passen:

- **ein Session-Code, eine Session, eine Shell** (`ADR-0009`)
- **keine Rechte aus URL oder Session-Code** (`ADR-0006`, `ADR-0019`)
- **mobile-first Host- und Vote-IA** (`ADR-0014`)
- **Datensparsamkeit und Hotpath-Disziplin** (`docs/architecture/handbook.md`)

## Entscheidung

### 1. Tempo wird als vierter Session-Kanal eingeführt

Der Tempo-Livekanal wird als **eigenständiger vierter Kanal** innerhalb derselben Live-Session modelliert.

Er erweitert das Zielbild aus `ADR-0009` wie folgt:

- **Quiz**
- **Q&A**
- **Blitzlicht**
- **Tempo**

Der Tempo-Kanal nutzt denselben **Session-Code**, dieselben **Teilnehmenden** und dieselbe **Session-Shell**.

Er wird **nicht** als:

- Blitzlicht-Typ,
- Quizfrage,
- Bewertungsfeature,
- Gamification-Mechanik

modelliert.

### 2. Tempo ist kontinuierlich, nicht rundengebunden

Der Tempo-Kanal ist fachlich ein **kontinuierlicher Zustandskanal**.

Das bedeutet:

- keine explizite Frage
- kein Submit-Button
- keine Runden
- kein Lock/Unlock als Antwortphase
- kein Vergleichsrunden-Modell
- keine Korrektheit oder Auswertung im Quiz-Sinn

Teilnehmende können ihren Zustand jederzeit setzen, ändern oder optional wieder entfernen.

### 3. Session-only in der ersten Ausbaustufe

Der Tempo-Kanal wird in der ersten Ausbaustufe **nur innerhalb laufender Sessions** angeboten.

Es gibt bewusst:

- **keinen** separaten Standalone-Pfad analog zu `/feedback/:code`
- **keinen** Startseiten-Shortcut
- **keinen** zweiten Besitz- oder Token-Kontext außerhalb der Session

Damit bleibt der Kanal eng an die vereinheitlichte Session-Architektur gebunden und erzeugt keinen zusätzlichen Parallelmodus.

### 4. Unterschiedliche UI-Verträge für Host und Teilnehmende

#### Host

Für Hosts ist Tempo ein **eigener Kanal** innerhalb der Session-Shell.

- Der Host erhält einen eigenen Kanal-Einstieg `Tempo`.
- Die Host-Ansicht zeigt nur **aggregierte Live-Werte**:
  - Verteilung der vier Zustände
  - Prozentwerte
  - optional absolute Zahlen
  - zusammenfassende Tendenz
- Der Host kann den Kanal aktivieren, schließen und wieder öffnen.

#### Teilnehmende

Für Teilnehmende ist Tempo **kein exklusiver Tab-Zwang**.

Stattdessen wird der Kanal als **persistentes Live-Widget** innerhalb der Session-Vote-Ansicht dargestellt, vorzugsweise im unteren Bereich der Session.

Begründung:

- Tempo soll parallel zu Quiz, Q&A und Blitzlicht nutzbar sein.
- Ein eigener Teilnehmer-Tab würde unnötige Kanalwechsel erzwingen.
- Das Ziel ist **ambient feedback**, nicht eine eigene Primäransicht.

### 5. Kanalzustand folgt dem Session-Modell `enabled + open`

Für die Session-Konfiguration wird Tempo analog zu den bestehenden Kanälen mit zwei Zuständen modelliert:

- `tempoEnabled`: Kanal ist Teil der Session-Konfiguration
- `tempoOpen`: Kanal ist aktuell für Teilnehmende sichtbar und nutzbar

Semantik:

- neue Sessions: standardmäßig `false`
- Aktivieren: setzt `tempoEnabled = true`, `tempoOpen = true`
- Schließen: lässt den Kanal fachlich bestehen, blendet das Teilnehmer-Widget aber aus
- Wiederöffnen: macht den Kanal ohne Neuinitialisierung erneut nutzbar

Damit bleibt das Modell kompatibel zur bestehenden Kanalarchitektur in `SessionChannelsDTO`.

### 6. Pro teilnehmender Person gibt es genau einen aktuellen Tempo-Zustand

Der Tempo-Kanal verwendet genau vier Zustände:

- `speed_up`
- `following`
- `slow_down`
- `lost`

Regeln:

- pro `participantId` gibt es höchstens **einen aktuellen Zustand**
- ein neuer Zustand ersetzt den bisherigen
- ein erneuter Tap auf denselben Zustand darf den Zustand optional entfernen
- für Hosts zählt immer nur der **aktuelle Snapshot**, nicht die Rohhistorie einzelner Personen

Ein internes Zustandsmodell auf Basis von `participantId` ist erlaubt, wird aber **nie** an Hosts oder andere Teilnehmende exponiert.

### 7. Datenhaltung: Session-Konfiguration in Postgres, Live-Zustand in Redis

Die Persistenz wird bewusst zweigeteilt:

- **PostgreSQL / Prisma** speichert die Session-Konfiguration (`tempoEnabled`, `tempoOpen`)
- **Redis** ist die Quelle der Wahrheit für den **Live-Zustand** des Tempo-Kanals

Redis hält mindestens:

- aktuellen Zustand je `participantId`
- aggregierte Zähler je Session
- Rolling-Window-Daten für Trendberechnung (z. B. 60 Sekunden)

Es werden **keine** Tempo-Events im Hotpath in PostgreSQL geschrieben.

Begründung:

- der Kanal ist hochfrequent und potenziell dauerhaft aktiv
- der Produktbedarf ist ein Live-Snapshot, keine personenbezogene Historie
- die Lösung soll die Datenbank nicht mit Schreiblast pro Tap belasten

Historische, personenbezogene oder analytische Langzeitpersistenz ist **nicht** Teil dieses Zielmodells.

### 8. Eigene tRPC- und DTO-Schnitt statt Wiederverwendung von Blitzlicht

Der Tempo-Kanal erhält eine **eigene API- und DTO-Schnitt**.

Verbindlich:

- `SessionChannelsDTO` wird um `tempo` erweitert
- Tempo erhält eigene Input-/Output-Schemas in `@arsnova/shared-types`
- Host-Aktionen laufen über **`hostProcedure`**
- Teilnehmeraktionen laufen über dedizierte öffentliche Procedures mit serverseitiger Prüfung von Session- und Teilnehmerkontext

Empfohlene DTO-Grenzen:

- eigener Teilnehmerzustand
- aggregierter Snapshot
- Trend-/Tendenz-Daten

Nicht zulässig:

- Wiederverwendung von `QuickFeedbackResult`
- Lock-/Runden-/Vergleichslogik aus Blitzlicht
- Host-Endpunkte, die individuelle Tempo-Zustände zurückgeben

### 9. Datenschutz und Datenminimierung sind harte Grenzen

Der Tempo-Kanal ist anonym im Produktsinn.

Daraus folgen verbindliche Regeln:

- Hosts sehen **keine individuellen Rückmeldungen**
- Hosts sehen **keine Listen pro Zustand**
- Teilnehmende sehen **keine Rückmeldungen anderer**
- Presenter- oder Admin-Pfade erhalten in der ersten Ausbaustufe **keine** personenbezogene Tempo-Historie

Die interne Nutzung von `participantId` zur Zustandsersetzung ist eine reine **technische Hilfskonstruktion** und kein UI- oder Export-Vertrag.

### 10. Tendenz ist ein abgeleiteter Aggregatzustand

Die Host-UI zeigt neben der Rohverteilung eine **zusammenfassende Tendenz**.

Die Tendenz wird aus:

- aktuellem Snapshot
- Rolling Window
- deterministischen Schwellen

abgeleitet.

Mindestens folgende Zustände sollen fachlich unterscheidbar sein:

- `Die Mehrheit kann folgen.`
- `Das Tempo wirkt zu hoch.`
- `Mehrere Teilnehmende sind abgehängt.`
- `Die Gruppe signalisiert Unterforderung.`
- `Die Gruppe ist heterogen.`

Die konkrete Schwellenlogik ist Implementierungsdetail, muss aber:

- nachvollziehbar,
- stabil,
- testbar

sein.

## Konsequenzen

### Positiv

- Der Tempo-Kanal erhält eine fachlich saubere Identität statt einer verbogenen Blitzlicht-Variante.
- Die Session bleibt dem Produktversprechen `eine Veranstaltung, ein Code, eine App` treu.
- Teilnehmende können kontinuierlich Feedback geben, ohne ihren Hauptfluss zu verlassen.
- Hosts erhalten eine niedrigschwellige, anonyme Live-Rückkopplung zum Vortragsrhythmus.
- Redis als Live-Quelle schützt PostgreSQL vor unnötiger Schreiblast im Dauerbetrieb.

### Negativ / Risiken

- Die bestehende Kanal-Shell ist aktuell noch auf drei Kanäle verdrahtet; die Erweiterung auf Tempo erzeugt Refactoring-Aufwand in DTOs, Routerlogik und Frontend-Unions.
- Das Teilnehmer-Layout wird komplexer, weil ein persistentes Zusatz-Widget mit bestehenden Bottom-Actions koordiniert werden muss.
- Trendlogik kann schnell beliebig oder unruhig wirken, wenn Schwellen und Zeitfenster nicht sorgfältig kalibriert werden.
- Die Trennung `Host-Tab` vs. `Teilnehmer-Widget` erhöht die konzeptionelle Komplexität gegenüber einem rein tab-basierten Modell.

## Alternativen (geprüft)

- **Tempo als neuer Blitzlicht-Typ:** verworfen, weil Blitzlicht punktuell, rundengebunden und technisch auf Einmal-Votes ausgelegt ist.
- **Tempo als Quizfrage oder Survey-Sonderform:** verworfen, weil der Kanal parallel zum Quiz laufen und keinen Frage-Lifecycle besitzen soll.
- **Tempo nur als weiterer Teilnehmer-Tab:** verworfen, weil das kontinuierliche Ambient-Feedback zu unnötigen Kanalwechseln zwingen würde.
- **Jedes Tempo-Event dauerhaft in PostgreSQL speichern:** verworfen, weil das Hotpath-Last, Datenschutzrisiko und Komplexität unnötig erhöht.
- **Tempo sofort auch als Standalone-Modus anbieten:** verworfen, weil die erste Ausbaustufe bewusst session-zentriert bleiben soll und keinen zweiten Produktpfad braucht.

## Referenzen

- `Backlog.md` Story `8.8`
- [ADR-0006: Rollen, Routen und Autorisierung](./0006-roles-routes-authorization-host-admin.md)
- [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md)
- [ADR-0010: Blitzlicht als Kernmodus mit konsistenter UX in Startseite und Live-Session](./0010-blitzlicht-as-core-live-mode.md)
- [ADR-0014: Mobile-first Informationsarchitektur fuer Host-Views](./0014-mobile-first-information-architecture-for-host-views.md)
- [ADR-0019: Host-Haertung und besitzgebundene Session-Zugriffe ohne Accounts](./0019-host-hardening-and-owner-bound-session-access.md)
- [ADR-0021: Trennung von Betriebsstatus und Laststatus mit Live-Telemetrie](./0021-separate-service-status-from-load-status-with-live-slo-telemetry.md)
- `docs/architecture/handbook.md`
