# Host-Recovery und Admin-Reset

Dieses Runbook beschreibt den produktiven Wiederzugang für mehrtägige
Q&A-Sessions aus Epic #405. Sessioncode, Join-Link, Host-Route und Support-ID
sind öffentliche Referenzen und **niemals** ein Berechtigungsnachweis.

## Regulärer Self-Service

arsnova.eu bindet Hosts nicht an ein Konto. Der Host-Zugang hängt am Browser,
in dem die Session erstellt wurde. Teilnehmende können von jedem Browser
beitreten. Bei der Sessionerstellung speichert der Browser eine sessiongebundene,
versionierte Browser-Capability. Den blockierenden Dialog zum Sichern der
Notfallkarte zeigt die Host-Ansicht erst, wenn Q&A aktiv ist — also beim
direkten Q&A-Start oder sobald der Host den Q&A-Kanal später einschaltet, nicht
beim reinen Quiz- oder Blitzlicht-Einstieg. Die Karte enthält:

- eine nicht geheime Session-Kennung (Support-ID) zum Auffinden der Session und
- einen getrennten geheimen Recovery-Code.

Der Browser stellt aus seiner Capability kurzlebige Host-Tokens aus. Tab- und
Browserneustart sowie Redis-Neustart oder Redis-Datenverlust zerstören deshalb
nicht den PostgreSQL-basierten Wiederzugang. Ist Redis nicht erreichbar, bleibt
der Zugriff fail-closed, bis Redis wieder verfügbar ist.

Bei verlorenen Browserdaten öffnet der Host die Wiederherstellungsseite,
gibt die Session-Kennung (Support-ID) und den Recovery-Code ein und sichert die neu ausgegebene
Notfallkarte. Geheimnisse und die CSPRNG-Exchange-ID werden ausschließlich im
tRPC-Request-Body übertragen.

Prepare ist für höchstens 15 Minuten idempotent. Derselbe Recovery-Code und
dieselbe Exchange-ID liefern in diesem Fenster dasselbe verschlüsselt
vorgehaltene Response-Material. Die alte Credential-Generation bleibt bis zur
Aktivierung gültig. Erst Activate widerruft sie atomar. Nach Aktivierung oder
Ablauf wird das verschlüsselte Envelope gelöscht.

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

Der Admin-Reset ist nur über die authentifizierte Admin-Oberfläche und die
Shared-Zod-geschützte `admin.resetSessionHostAccess`-tRPC-Prozedur zulässig.
Der Operator erhält ausschließlich eine höchstens 15 Minuten gültige,
einmalige Übergabe-Capability, keine dauerhafte Host-Capability. Support-ID und
Übergabecode werden getrennt an den bereits verifizierten Host übermittelt.
Dieser schließt den normalen Prepare-/Activate-Austausch auf der
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

### Fehlgeschlagener Nummern-Backfill (P3018)

`20260915100000_host_recovery_participant_capabilities` nummeriert bestehende
Teilnahmen. Der Write-Guard aus der Lifecycle-Migration lehnt das auf
beendeten Sessions ab. Die Datei setzt den Trigger
`Participant_guard_active_session` für diesen Backfill aus und ist für eine
teilweise angewandte DDL idempotent.

Wenn `_prisma_migrations` die Datei als fehlgeschlagen zeigt (`finished_at`
leer, Spalten schon da, `HostCredential` fehlt): nicht
`migrate resolve --applied`. Nach Ausrollen dieses Stands zuerst

```bash
./scripts/prod-compose.sh run --rm --no-deps --entrypoint "" app \
  /app/node_modules/.bin/prisma migrate resolve \
  --rolled-back 20260915100000_host_recovery_participant_capabilities \
  --schema /app/prisma/schema.prisma
```

mit dem **neuen** Image, danach `./scripts/deploy.sh`. `deploy.sh` allein bleibt
bei P3018 stehen, solange die Failed-Zeile existiert.
