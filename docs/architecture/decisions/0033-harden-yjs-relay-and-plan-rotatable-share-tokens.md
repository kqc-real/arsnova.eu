<!-- markdownlint-disable MD013 -->

# ADR-0033: Yjs-Relay härten und rotierbare Share-Tokens vorbereiten

**Status:** Accepted  
**Datum:** 2026-07-25  
**Entscheider:** Projektteam  
**Letzter Repo-Abgleich:** 2026-07-25

## Kontext

Die Quiz-Sammlung ist local-first und accountfrei. Ihr Yjs-Relay wurde bisher über
den unveränderten Entry von `@y/websocket-server` als Child-Prozess gestartet.
Dieser Entry akzeptiert beliebige Dokumentnamen und setzt weder Payload- noch
Verbindungs- oder Ratenlimits. Zugleich ist die zufällige Raum-UUID im Sync-Link
der einzige Bearer-Nachweis.

Kurze Token-TTLs oder enge IP-Limits passen nicht zum Produkt: Bibliotheken müssen
nach Offline-Phasen und auf gemeinsam genutzten Einrichtungsnetzen wieder
verbinden können. Eine sofortige Token-Einführung würde Frontend, Linkformat,
Rotation und Recovery gleichzeitig verändern und wäre für einen Relay-Slice zu
groß.

## Entscheidung

### 1. Relay-Grenze in W2.2

Der Backend-Prozess betreibt einen eigenen Yjs-Relay und verwendet
`@y/websocket-server/utils` nur noch für das kompatible Yjs-Protokoll:

- ausschließlich Pfade `quiz-library-room-<UUID>`,
- kanonische Kleinschreibung der UUID als interner Dokumentname,
- konfigurierbares Einzelpayload-Limit von standardmäßig 16 MiB (hartes
  Code-Maximum 32 MiB), damit die als ein Yjs-String serialisierte
  Quiz-Sammlung nicht bereits nach zwei größeren Quiz-Uploads dauerhaft vom
  Reconnect ausgeschlossen wird,
- großzügige globale und raumbezogene Verbindungscaps,
- globale und raumbezogene Upgrade-Budgets sowie gestufte Nachrichten- und
  Bytebudgets je Verbindung, Raum und Backend-Prozess,
- ein 15-MiB-Cap je zusammengeführtem In-Memory-Dokument und ein globales
  256-MiB-Dokumentbudget; Reservierungen wachsen nicht mit dem Zeitfenster
  zurück und werden beim Löschen des letzten Raum-Clients freigegeben,
- gestufte Budgets für tatsächlich versendete Bytes (32 MiB je Verbindung,
  256 MiB je Raum und 1 GiB global pro zehn Sekunden), damit kleine
  Sync-Anfragen keinen unbeschränkten großen Zustand vervielfachen,
- protokollseitige Parserfehler ohne attacker-kontrollierte Logausgabe mit
  Diagnosezähler und sofortiger Verbindungstrennung,
- keine IP-basierten Yjs-Buckets,
- Freigabe ungenutzter In-Memory-Dokumente nach der letzten Verbindung,
- schema-definierte Diagnosemetriken für aktive Räume/Verbindungen und
  Ablehnungen.

Die Raum-UUID bleibt in Slice A der Bearer-Nachweis. Query-Parameter werden
fail-closed abgewiesen, bis ein Tokenformat tatsächlich implementiert ist.

### 2. Zielbild für Share-Tokens und manuelle Rotation

Ein späterer Slice B führt einen vom Raum getrennten, signierten Share-Nachweis
ein. Das Zielbild ist:

1. Ein Share-Token enthält mindestens Formatversion, Raum-UUID und
   Rotationsgeneration und wird mit einem eigenen serverseitigen Signing-Key
   authentifiziert.
2. Der Token ist langlebig. Es gibt keine kurze Session-TTL, die Offline-Nutzung
   oder einen späteren Reconnect überraschend beendet.
3. Für Widerrufbarkeit hält der Server nur minimale Share-Metadaten
   (Raumreferenz, aktuelle Generation und Hash einer separaten
   Rotations-Capability), keine Quiz-Inhalte.
4. Die Rotations-Capability wird clientseitig erzeugt und nur auf dem
   Ursprungsgerät gehalten. Eine manuelle Rotation erhöht die Generation und
   gibt einen neuen Share-Token aus; ältere Generationen werden beim nächsten
   Relay-Upgrade abgewiesen. Bereits verbundene Clients halten ihre beim
   Upgrade geprüfte Generation; der Relay terminiert sie bei einer Rotation,
   bevor der neue Token ausgegeben wird.
5. Bereits lokal gespeicherte Quizze bleiben bei ungültigem oder rotiertem Token
   offline verfügbar. Nur der erneute Netz-Sync endet, bis ein neuer Link
   importiert wird.
6. Signing-Key-Rotation und Share-Rotation sind getrennt. Die Server-Key-Rotation
   braucht eine dokumentierte Überlappungsphase für alte Signaturen; die
   nutzerinitiierte Share-Rotation widerruft gezielt eine Raumgeneration.
7. Tokens dürfen nicht in normalen App-/Proxy-Logs erscheinen. Transportformat,
   Nginx-Logging und Fehlertelemetrie müssen vor Implementierung gemeinsam
   festgelegt und getestet werden.
8. Die Migration auf Tokens darf keine First-Writer-Besitzübernahme alter
   UUID-Räume ermöglichen. Das Backend erzeugt beim Absichern deshalb stets
   eine neue Raum-UUID; bestehende Legacy-Origins rekeyen ihre lokale Sammlung
   über eine explizite Aktion. UUID-only-Upgrades persistieren keinen
   „gesehen“-Zustand.

Slice B benötigt eigene Threat-Model-, Migrations-, Recovery- und
Browser-Smoke-Abnahme. Dieses ADR autorisiert keine implizite Tokenprüfung und
keine Frontendänderung in W2.2.

## Konsequenzen

### Positiv

- Beliebige Dokumentnamen und ungebremste Ressourcenbelegung werden bereits ohne
  UX- oder Linkformatänderung begrenzt.
- Bestehende Yjs-Clients behalten Protokoll, Offline-Persistenz und
  Reconnect-Verhalten.
- Shared-NATs werden nicht durch enge IP-Limits benachteiligt.
- Das Token-Zielbild verbindet langlebige Freigaben mit gezielter manueller
  Widerrufbarkeit und minimalem Serverwissen.

### Negativ / Risiken

- Bis Slice B bleibt Kenntnis der Raum-UUID voller Schreibzugriff.
- Caps und Budgets sind pro Backend-Prozess; horizontale Skalierung benötigt
  gemeinsame Admission-Control und Yjs-Pub/Sub oder Sticky Sessions.
- 16 MiB sind eine bewusst großzügige, aber endliche Produktgrenze für die
  vollständig serialisierte Transportnachricht; der zusammengeführte
  Dokumentzustand bleibt mit 15 MiB etwas darunter. Sammlungen darüber können nicht
  synchronisiert werden; die Grenze kann betrieblich bis maximal 32 MiB
  angehoben werden. Eine spätere normalisierte CRDT-Struktur bleibt eine
  eigenständige Produkt-/Migrationsentscheidung.
- Das spätere Rotationsmodell benötigt langlebige minimale Metadaten und einen
  Recovery-Entscheid für verlorene Rotations-Capabilities.
- Ein Gerät mit altem Token arbeitet nach Rotation weiter lokal, kann seine
  Offline-Änderungen aber erst nach Import eines neuen Links synchronisieren.

## Alternativen (geprüft)

- **Unveränderter Paket-Entry:** verworfen, weil Pfade und Ressourcen nicht
  kontrollierbar oder im bestehenden Diagnosepfad sichtbar sind.
- **Kurze Share-Token-TTL:** verworfen, weil sie Offline-/Reconnect-Flows ohne
  Sicherheitsgewinn gegen bewusste Weitergabe bricht.
- **Enge IP-Limits:** verworfen, weil viele legitime Geräte dieselbe
  Einrichtungs-IP teilen.
- **Token und Frontend sofort mitliefern:** verworfen, weil Rotation, Migration,
  Logging und Recovery einen eigenen reviewbaren Slice benötigen.
- **Nur signierte zustandslose Tokens:** verworfen, weil eine gültige Signatur
  allein keine manuelle Sperrung eines geleakten langlebigen Links ermöglicht.

---

**Referenzen:** [ADR-0004](./0004-use-yjs-for-local-first-storage.md),
[Quiz-Sammlung – Synchronisierung](../quiz-library-sync.md),
[SECURITY-HARDENING-PLAN](../../SECURITY-HARDENING-PLAN.md).
