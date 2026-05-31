<!-- markdownlint-disable MD013 -->

# ADR-0011: Delegierbare Moderatorrolle für Live-Sessions

**Status:** Accepted  
**Datum:** 2026-03-16  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

arsnova.eu hat bereits eine klare Trennung zwischen Teilnehmenden- und Host-Zugriff:

- Teilnehmende nutzen den **6-stelligen Session-Code**
- Host-Funktionen duerfen **nicht** ueber den Session-Code freigeschaltet werden
- Live-Sessions vereinen mehrere Kanaele unter einem gemeinsamen Veranstaltungskontext

Im realen Einsatz entsteht jedoch ein zusaetzlicher Bedarf:

1. Eine Lehrperson moechte auf einem Geraet praesentieren und auf einem anderen Geraet moderieren oder steuern.
2. Eine Tutor:in oder Assistenz soll **nur Q&A moderieren** koennen.
3. Diese Person soll **keinen Vollzugriff** auf Quiz-Steuerung, Session-Ende oder andere Host-Aktionen erhalten.
4. Gleichzeitig darf das Sicherheitsmodell die Live-Nutzung nicht so stark verlangsamen oder verkomplizieren, dass der Einsatz im Hoersaal unpraktikabel wird.

Ohne eigene Architekturentscheidung drohen zwei Probleme:

- Moderatorrechte werden implizit mit Host-Rechten vermischt.
- Sicherheits- und Performance-Folgen der Delegation bleiben undokumentiert.

Dieses ADR baut auf `ADR-0006` (Rollen, Routen und Autorisierung) und `ADR-0009` (einheitliche Live-Session mit mehreren Kanaelen) auf.

## Entscheidung

### 1. Moderator ist eine eigenstaendige Live-Rolle

Neben `Host`, `Present`, `Join` und `Vote` gibt es fachlich eine eigene Rolle:

- **Moderator**

Die Moderatorrolle ist keine kosmetische Variante des Hosts, sondern eine **eigenstaendig begrenzte Delegationsrolle**.

### 2. Moderatorrechte sind strikt kanalgebunden

Die Moderatorrolle ist in der ersten Ausbaustufe auf **Q&A-Moderation** begrenzt.

Moderator:innen duerfen:

- Q&A-Fragen laden
- Fragen freigeben
- Fragen hervorheben
- Fragen archivieren
- Fragen loeschen

Moderator:innen duerfen **nicht**:

- Quiz-Fragen starten oder aufloesen
- Blitzlicht-Runden starten, beenden oder veraendern
- die Session beenden
- Host-Einstellungen oder globale Session-Konfiguration aendern
- Zugriff auf Vollfunktionen der Host-Rolle erhalten

### 3. Delegation erfolgt ueber ein eigenes Moderator-Token

Moderatorrechte werden ausschliesslich ueber ein **eigenes Moderator-Token** vergeben.

- Der Session-Code reicht dafuer niemals aus.
- Das Host-Token wird nicht an Moderator:innen weitergegeben.
- Das Moderator-Token wird serverseitig erzeugt, nur als **Hash** gespeichert und an genau eine Session gebunden.
- Das Moderator-Token ist **widerrufbar** und bei Bedarf **rotierbar**.

### 4. Eigener Zugangspfad fuer Moderation

Die Moderatorrolle erhaelt einen eigenen Zugangspfad:

- `/session/:code/moderate`

Diese Route ist keine vollwertige Host-Shell, sondern eine **reduzierte Moderationsoberflaeche**.

Ziel:

- weniger Risiko versehentlicher Rollenvermischung
- klarere mentale Trennung zwischen `Host`, `Presenter` und `Moderator`
- kleinere und fokussiertere Live-Oberflaeche fuer Tutor:innen

### 5. Presenter bleibt read-only und getrennt vom Moderator

`Presenter` und `Moderator` sind zwei verschiedene Delegationsrollen:

- **Presenter:** lesen und anzeigen
- **Moderator:** lesen und kanalgebunden handeln

Beide Rollen duerfen nicht implizit ineinander uebergehen.

Insbesondere gilt:

- Ein Presenter-Link ist **kein** Moderator-Link.
- Ein Moderator-Link ist **kein** Presenter-Link mit Schreibrechten.
- Nur der Host behaelt die kanaluebergreifende Vollkontrolle.

### 6. Sicherheits- und Performance-Spannungsfeld ist Teil der Entscheidung

Die Moderatorrolle ist bewusst kein rein technisches Convenience-Feature, sondern eine Sicherheitsentscheidung mit Performance-Kosten.

Deshalb gilt:

1. **Mehr Sicherheit erhoeht die Komplexitaet im Hotpath.**  
   Token-Pruefung, Widerrufbarkeit, TTLs und Rollen-Middleware machen Live-Zugaenge sicherer, aber nicht billiger.

2. **Mehr Bequemlichkeit schwächt die Rollentrennung.**  
   Jede Loesung nach dem Muster "Moderator nutzt einfach den Host-Link" waere performanter und einfacher, aber fachlich und sicherheitlich falsch.

3. **Widerrufbarkeit kostet Serverbindung.**  
   Wenn Moderatorzugriffe wirksam entzogen werden sollen, braucht es serverseitigen Zustand und Pruefpfade. Das steht im Spannungsfeld zum Wunsch nach maximal direkter, local-first-artiger Nutzung.

4. **Fokussierte UIs sind auch Performance-Schutz.**  
   Eine reduzierte Moderator-UI ist nicht nur sicherer, sondern senkt auch UI- und Datenlast, weil sie nicht die komplette Host-Shell laden und pflegen muss.

Die Entscheidung lautet daher nicht "maximale Sicherheit" oder "maximale Performance", sondern:

- **ausreichend starke Rollentrennung**
- bei moeglichst geringer Reibung im Live-Betrieb

### 7. Prioritaet der Schutzgueter

Im Zweifel gilt fuer die Moderatorrolle:

1. **Rollentrennung vor Bequemlichkeit**
2. **Widerrufbarkeit vor maximaler Direktheit**
3. **Reduzierte Spezial-UI vor impliziter Host-Wiederverwendung**

## Konsequenzen

### Positiv

- Tutor:innen koennen sinnvoll eingebunden werden, ohne Vollzugriff auf die Session zu erhalten.
- Die Architektur trennt Host-, Presenter- und Moderatorrolle sauber.
- Sicherheitsreview, Tests und UI-Design bekommen einen klaren Scope.
- Die Q&A-Moderation wird als delegierbare Live-Aufgabe produktseitig glaubwuerdig.

### Negativ / Risiken

- Zusaetzliche Rolle bedeutet zusaetzliche Route, zusaetzliche Token-Logik und zusaetzliche Tests.
- Host-, Presenter- und Moderatorzustand muessen im Frontend klar unterscheidbar sein.
- Mehr serverseitige Pruefungen koennen den Live-Hotpath komplexer machen.
- Widerruf und Rotation muessen sorgfaeltig mit Session-Laufzeit und Reconnect zusammenspielen.

## Alternativen (geprueft)

- **Moderator nutzt denselben Host-Link:** verworfen, weil das Vollzugriff freischaltet oder zu gefaehrlichen Grauzonen fuehrt.
- **Moderator ueber Session-Code freischalten:** verworfen, weil Teilnehmende denselben Code kennen.
- **Moderator als blosses UI-Flag im Host-Frontend:** verworfen, weil echte Sicherheit serverseitige Rollentrennung braucht.
- **Nur Presenter erlauben, aber keine Moderation delegieren:** verworfen, weil das reale Einsatzszenario mit Tutor:innen oder Assistenz nicht abdeckt.

## Umsetzungsleitplanken

- Moderatorrechte werden ueber eigene serverseitig gepruefte Procedures abgesichert.
- Die reduzierte Moderator-UI zeigt nur den fuer die Rolle noetigen Kanal und Status.
- Jeder neue Moderationsbefehl muss explizit gegen die Frage geprueft werden: `Darf das ein Moderator oder nur ein Host?`
- Performance-Optimierungen fuer den Moderatorpfad sind willkommen, solange sie **keine** Rollentrennung oder Widerrufbarkeit abbauen.

## Umsetzungsstand (2026-05-31)

Diese ADR beschreibt weiterhin das Zielbild. Im aktuellen Repo gibt es noch keine eigene Angular-Route `/session/:code/moderate`, kein Moderator-Token und keine dedizierte Moderator-UI. Q&A-Moderation existiert produktiv, ist aber weiterhin hostgebunden: `qa.moderate` und verwandte Moderationspfade laufen serverseitig ueber `hostProcedure`, die Host-Ansicht uebergibt `moderatorView: true` fuer die Moderationssicht.

---

**Referenzen:** [ADR-0006: Rollen, Routen und Autorisierung](./0006-roles-routes-authorization-host-admin.md), [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md), `Backlog.md` Story `2.1c`, `Backlog.md` Story `8.5`.
