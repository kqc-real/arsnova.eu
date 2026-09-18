# Host-Recovery und Admin-Reset

Dieses Runbook beschreibt den produktiven Wiederzugang für mehrtägige
Q&A-Sessions aus Epic #405. Sessioncode, Join-Link, Host-Route und Support-ID
sind öffentliche Referenzen und **niemals** ein Berechtigungsnachweis.

## Regulärer Self-Service

arsnova.eu bindet Hosts nicht an ein Konto. Der Host-Zugang hängt am Browser,
in dem die Session erstellt wurde. Teilnehmende können von jedem Browser
beitreten. Bei der Sessionerstellung speichert der Browser eine sessiongebundene,
versionierte Browser-Capability. Den blockierenden Dialog zum Sichern der
Zugangskarte zeigt die Host-Ansicht erst, wenn Q&A aktiv ist — also beim
direkten Q&A-Start oder sobald der Host den Q&A-Kanal später einschaltet, nicht
beim reinen Quiz- oder Blitzlicht-Einstieg. Die Karte enthält:

- eine nicht geheime Session-Kennung (Support-ID) zum Auffinden der Session und
- einen getrennten geheimen Recovery-Code.

Der Browser stellt aus seiner Capability kurzlebige Host-Tokens aus. Tab- und
Browserneustart sowie Redis-Neustart oder Redis-Datenverlust zerstören deshalb
nicht den PostgreSQL-basierten Wiederzugang. Ist Redis nicht erreichbar, bleibt
der Zugriff fail-closed, bis Redis wieder verfügbar ist.

Besitzt der Browser eine eindeutige, zuletzt genutzte Host-Capability, öffnet
der erste Button der Live-Karte diese Host-Session direkt. Der Guard stellt den
kurzlebigen Host-Token aus der Capability aus. Der Textlink
»Host-Zugang wiederherstellen« auf der Startseite bleibt immer sichtbar, damit
verlorene Browserdaten, ein nur vorbereiteter Kandidat oder eine weitere
Session über `/<locale>/host-recovery` erreichbar bleiben. Der Live-Karten-CTA
erscheint nur bei genau einer bevorzugten aktivierten Capability; mehrere
ungeordnete Einträge oder nur ein Kandidat führen nicht auf eine zufällige
ältere Session.
Der Ablauf hat drei Schritte: Angaben prüfen (Prepare), neue Zugangsdaten
sichern und erst danach ausdrücklich aktivieren, anschließend bestätigter
Erfolg. Ein Download ist optional; eine Klartextnotiz mit Session-Kennung,
Wiederherstellungscode und Wiederherstellungslink reicht. Geheimnisse und die
CSPRNG-Exchange-ID werden ausschließlich im tRPC-Request-Body übertragen.

Prepare ist für höchstens 15 Minuten idempotent. Derselbe Recovery-Code und
dieselbe Exchange-ID liefern in diesem Fenster dasselbe verschlüsselt
vorgehaltene Response-Material. Die alte Credential-Generation bleibt bis zur
Aktivierung gültig. Erst Activate widerruft sie atomar. Nach Aktivierung oder
Ablauf wird das verschlüsselte Envelope gelöscht.

Geht die Aktivierungsantwort verloren, darf das Formular den alten Code nicht
erneut gegen Prepare senden. Der Browser speichert den Wiederaufnahmestatus
(Support-ID, Sessioncode, Phase, Exchange-Frist) in `localStorage`. Pending-
Kartenmaterial und die Exchange-ID werden mit der 15-Minuten-Frist bereinigt.
Eine bereits aktivierte Browser-Capability bleibt davon unberührt und kann
nach Tabwechsel oder nach Ablauf des Pending-Fensters erneut einen Host-Token
beziehen. Alter Browserzugang und neuer Kandidat werden getrennt geprüft; ein
gültiger Altzugang bestätigt nicht die Aktivierung des Kandidaten. Ein
vorübergehender Netzwerk- oder Serverfehler gilt nicht als Ablauf und löscht
keinen gültigen Kandidaten. Eine nie aktivierte Vorbereitung bleibt nach
Fristablauf ungültig; die vorherige Generation gilt weiter. Wurde Activate
nie serverseitig ausgeführt und der Kandidat danach autoritativ abgelehnt,
ist ein Neubeginn mit dem noch gültigen bisherigen Recovery-Code möglich.
Abgeschlossene Wiederherstellungen öffnen das Formular nicht erneut
automatisch. Der Guard aktiviert einen nur vorbereiteten Kandidaten nicht
automatisch.

Kurzfristiger Support: Besitzt der Browser die bereits aktivierte Capability,
kann `/<locale>/session/<code>/host` über den Guard einen Token ausstellen.
Das ist ein bedingter Workaround und keine Autorisierung durch die URL. Für
ungeklärte Fälle Support-ID, Credential-Generation, offenen Exchange und
Fehlerphase prüfen; keine Rohgeheimnisse protokollieren. Ein Admin-Reset folgt
nicht automatisch, sondern dem verifizierten Prozess unten.

## Berechtigungsgrenzen

- Bis zum effektiven globalen Sessionende gelten die normalen Hostrechte.
- Danach sind ausschließlich read-only Q&A-Nachbereitungsrechte bis exakt
  `endedAt + 14 Tage` zulässig.
- Die Recovery verlängert weder `expiresAt` noch Session oder Nachbereitung.
- Nach `postProcessingEndsAt` werden Token-Ausstellung, Recovery und Admin-Reset
  abgelehnt, auch wenn ein Legal Hold den Sessionkern technisch noch erhält.
- Mit dem Session-Purge verschwinden Credentials, Pairings, Pending-Austausche
  und Support-ID. Eine endgültig gelöschte Session ist nicht wiederherstellbar.

## Admin-Reset bei vollständigem Verlust

Zuerst den Self-Service prüfen. Eine fehlende heruntergeladene Zugangskarte
bedeutet nicht automatisch, dass separat notierte Zugangsdaten unbrauchbar
sind.

Der Admin-Reset ist nur über die authentifizierte Admin-Oberfläche und die
Shared-Zod-geschützte `admin.resetSessionHostAccess`-tRPC-Prozedur zulässig.
Die Admin-Suche findet die Session über den sechsstelligen Sessioncode **oder**
die vollständige Session-Kennung `ARS-XXXX-XXXX`. Eine Session-Kennung darf
nicht still auf sechs Zeichen gekürzt werden.

Der Operator erhält ausschließlich eine Übergabe-Capability, keine dauerhafte
Host-Capability. Die 15 Minuten gelten für die **erste Einlösung** dieses
Übergabecodes. Nach erfolgreichem Prepare beginnt ein separates
Aktivierungsfenster von 15 Minuten. »Einmalig« bezeichnet einen
Wiederherstellungsvorgang; technisch zulässige Wiederholungen derselben
Operation bleiben möglich. Der gesamte Ablauf muss nicht binnen 15 Minuten
nach dem Admin-Klick abgeschlossen sein.

Dieselbe noch offene Operations-ID liefert dasselbe verschlüsselt vorgehaltene
Ergebnis und widerruft nicht erneut. Wurde die Operation ersetzt, eingelöst
oder abgelaufen, bleibt die Operationsreferenz ohne Rohgeheimnis erhalten;
eine Wiederholung führt dann keinen neuen Widerruf aus. Ein bewusst neuer
Reset braucht eine neue Operations-ID und eine ausdrückliche Bestätigung.
Rohgeheimnisse gehören weder ins Audit-Log noch in URLs.

Support-ID und Übergabecode werden getrennt an den bereits verifizierten Host
übermittelt. Die getrennte Übermittlung ersetzt nicht die Prüfung des
Empfängers; die Session-Kennung ist kein zweiter geheimer Faktor. Der Host
schließt den normalen Prepare-/Activate-Austausch auf der
Wiederherstellungsseite über »Ich habe einen Code vom Support« ab.

Vor dem Reset müssen **beide** Aussagen unabhängig belegt sein:

1. die Identität der anfragenden Person und
2. deren Berechtigung zur Übernahme genau der bezeichneten Session.

Zulässig sind ausschließlich:

- ein bereits vor dem Verlust eröffneter Supportvorgang eines verifizierten
  organisatorischen Kontakts, der die konkrete Session oder Support-ID bereits
  diesem Host beziehungsweise dieser Veranstaltung zuordnet, oder
- eine Bestätigung über einen unabhängig ermittelten offiziellen Kontaktweg
  der Organisation durch eine für diesen Fall autorisierte Person.

Nicht ausreichend sind Sessioncode, Support-ID, öffentliche Sessionmerkmale,
Kenntnis von Inhalten, eine erst im Resetvorgang angegebene Kontaktadresse oder
bloße Organisationszugehörigkeit. Fehlt ein belastbarer Bezug zur konkreten
Session, wird der Reset abgelehnt und an die für Datenschutz und
Informationssicherheit verantwortliche Betriebsrolle eskaliert.

Die Admin-Oberfläche verlangt Referenzen für Identitätsprüfung,
sessionbezogenen Berechtigungsnachweis, Supportvorgang und Begründung. Der
Reset erhöht die Credential-Version, widerruft alte Browser-/Recovery-Zugänge,
kurzlebige Host-Tokens und Pairings und protokolliert den Vorgang ohne
Geheimnisse oder Q&A-/Teilnahmeinhalte.

## Audit und Aufbewahrung

Recovery-Credentials gehören zum Sessionkern und folgen dessen Purge. Der
Admin-Auditdatensatz wird getrennt bis zu 365 Tage für Missbrauchsaufklärung
und Nachweis des privilegierten Betreiberhandelns aufbewahrt. Zugriff haben nur
authentifizierte Admins beziehungsweise die dafür benannten Betriebs- und
Datenschutzrollen. Für den öffentlichen Dienst gilt wie für die
Sicherheitsverarbeitung der Live-Session Art. 6 Abs. 1 lit. f DSGVO
(berechtigtes Interesse an sicherem Betrieb, Missbrauchsaufklärung und
Nachweis privilegierter Eingriffe); bei Self-Hosting legt der jeweilige
Verantwortliche die einschlägige Rechtsgrundlage fest. Beim Session-Purge werden direkte Sessionbezüge
pseudonymisiert; der Auditdatensatz blockiert den Purge nicht.

## Deployment und Rotation

`CAPABILITY_ENVELOPE_KEY_BASE64` muss in Produktion ein separat erzeugter,
exakt 32 Byte langer Base64-Schlüssel sein:

```bash
openssl rand -base64 32
```

Das Backend bricht den Produktionsstart ohne gültigen Schlüssel ab. Eine
Rotation erst durchführen, wenn keine höchstens 15 Minuten alten
Host-Austausche und keine höchstens 10 Minuten alten Join-Replays mehr offen
sind; sonst kann nur deren verschlüsseltes Replay-Material nicht mehr gelesen
werden. Die zugrunde liegenden gehashten Capabilities bleiben gültig.

Beim Rolling Deployment vergibt ein PostgreSQL-Trigger Teilnehmernummern für
ältere Images. Neue Host-Tokens werden zusätzlich kurzzeitig in das alte
Redis-Lookup gespiegelt. Ein Rollback setzt die Migration nicht zurück:
PostgreSQL-Credentials bleiben erhalten; ältere Images können das neue
Recovery-Formular jedoch nicht anbieten. Nach erneutem Roll-forward ist der
persistente Recovery-Pfad wieder verfügbar.

### Fehlgeschlagene 405-Backfills (P3018 / P3009)

`20260915100000_host_recovery_participant_capabilities` nummeriert bestehende
Teilnahmen. Der Write-Guard aus der Lifecycle-Migration lehnt das auf
beendeten Sessions ab. Die Datei setzt den Trigger
`Participant_guard_active_session` für diesen Backfill aus und ist für eine
teilweise angewandte DDL idempotent.

Wenn `_prisma_migrations` eine 405-Datei als fehlgeschlagen zeigt (`finished_at`
leer): nicht `migrate resolve --applied`. Nicht `prod-compose.sh run … app
prisma migrate resolve`: `deploy.sh` schreibt `.env.arsnova-image` erst nach
erfolgreichem Healthcheck, und `prod-compose.sh` überschreibt `ARSNOVA_IMAGE`
mit diesem alten Digest. Prisma im alten Image kennt die Migration nicht
(P3017).

Dieselbe Guard-Klasse: `20260915100000` (Participant) und
`20260915120000` (QaQuestion-Backfill). Beide Dateien sind für bereits
angewandte Teil-DDL idempotent (`ADD COLUMN IF NOT EXISTS` usw.).
`20260915110000` setzt den Session-Trigger bereits aus; MOTD
`20260916103000` und die Revisionsfunktion `20260916140000` schreiben keine
beendeten Live-Zeilen. Nicht zuerst Objekte per Hand droppen.

Failed-Zeile über Postgres löschen, ohne App-Image:

```bash
./scripts/prod-compose.sh exec postgres \
  psql -U arsnova_user -d arsnova_v3
```

```sql
DELETE FROM _prisma_migrations
WHERE finished_at IS NULL
  AND migration_name IN (
    '20260915100000_host_recovery_participant_capabilities',
    '20260915120000_qa_scale_counters'
  );
```

Erwartet: `DELETE 1` (oder `DELETE 2`, falls beide Failed-Zeilen noch stehen).
Danach diesen Stand mergen und den Deploy-Job auf `main` laufen lassen oder
erneut anstoßen. `deploy.sh` bleibt bei P3009/P3018 stehen, solange eine
Failed-Zeile existiert.
