# Absoluter Session-Lebenszyklus

**Stand:** 2026-09-18 · Epic #405, Slices #407, #409 und #412

## Fachlicher Vertrag

Jede Session besitzt eine aktivitätsunabhängige absolute Frist. Maßgeblich sind
die PostgreSQL-Felder:

- `createdAt`: unveränderlicher Erstellungszeitpunkt;
- `expiresAt`: globales Sessionende, standardmäßig exakt 24 Stunden nach
  `createdAt`;
- `qaClosesAt`: getrennte Q&A-Frist, immer kleiner oder gleich `expiresAt`.
  Eine bereits abgelaufene Q&A-Frist darf beim Bearbeiten ohne Wiederöffnen
  unverändert bleiben (Titel oder Moderation); neue Fristen und ein
  Wiederöffnen bleiben vollständig validiert, und die globale Session muss
  aktiv sein;
- `firstParticipantJoinedAt`: einmaliger Marker des ersten erfolgreich
  persistierten Beitritts;
- `endedAt`: kanonischer manueller oder automatischer Endzeitpunkt;
- `sessionLifecycleRevision`: monotone Revision jeder erfolgreichen Änderung
  von `expiresAt`, `endedAt` oder der Q&A-/Kanal-Konfiguration (`preferredChannel`,
  `qaEnabled`, `qaOpen`, `qaClosesAt`, `qaTitle`, `qaModerationMode`);
- `timeZone`: IANA-Zeitzone für Auswahl und Anzeige von Kalendertagen.

Aktiv ist eine Session nur, solange `endedAt IS NULL` und die Datenbankzeit vor
`expiresAt` liegt. Aktivität, Reload, Reconnect und Warnungsdialoge verschieben
keine Frist.

Vor dem ersten Beitritt kann ein Host die Anfangsfrist als Kalendertage oder als
absolutes Datum mit Uhrzeit festlegen. Kalendertage werden ab `createdAt` in der
angezeigten Sessionzeitzone gerechnet; nicht existente oder doppelte lokale
DST-Uhrzeiten werden abgelehnt. Der Server berechnet zunächst eine Vorschau mit
eindeutigem UTC-Zeitpunkt. Erst eine zweite ausdrückliche Bestätigung speichert
die Frist.

## Warnung und Verlängerung

Verbundene Hostclients warnen bei 30 und erneut bei 5 verbleibenden Minuten.
Der Dialog zeigt das absolute Sessionende samt Zeitzone. Nur der ursprüngliche
Host darf global verlängern; gekoppelte Hosts sehen die Frist und eine
Erklärung, erhalten aber keine bestätigbare Verlängerungsaktion. Host-Dialoge
zu Laufzeit, Q&A-Einrichtung, Fristbestätigung und Host-Zugangskarte nutzen dieselbe
abgehobene Overlay-Fläche (`session-lifecycle-dialog-panel`) mit kräftigerem
Scrim, damit sie sich vom Live-Hintergrund lösen. Beim Anlegen von der Startseite (`Q&A erstellen`) erscheinen Teilnahmeprofil
und Zugangskarte als Schritt 1 und 2 von 2. Die Einrichtung entfällt in dieser
Sequenz: `session.create` öffnet den Standalone-Q&A-Kanal sofort mit den
INITIAL-Defaults (Titel »Fragen & Antworten«, Vorab-Moderation an, Frist bis
Sessionende). Quiz-Sessions mit zusätzlichem Q&A-Kanal bleiben
`UNCONFIGURED`, bis der Host den Kanal ausdrücklich einrichtet. Abbrechen in
der Teilnahme legt keine Session an. Abbrechen in der Zugangskarte lässt Q&A
bereits eingerichtet; die Karte bleibt vorgemerkt. Ein erneuter Einstieg über
`Q&A-Einstellungen` öffnet wieder die Karte (Schritt 2 von 2), statt die
Einrichtung als Ersteinrichtung zu prüfen. **Fertig** in der Zugangskarte
beendet die Sequenz: `qaSetup` entfällt, die Einrichtung öffnet sich nicht
erneut als Startschritt, und eine reine Q&A-Session wechselt aus der Lobby
nach `ACTIVE` (Fragenwand), ohne denselben Start noch einmal als dritten
Schritt zu verlangen. Der Tastaturfokus liegt danach auf der
Fragenwand-Überschrift. Schlägt `startQa` fehl, bleibt die Session in `LOBBY`
und der bestehende Steuerungs-Callout fokussiert »Nochmal probieren«.
»Fragerunde starten« bleibt sichtbar, wenn die Session nach Reload noch in
`LOBBY` ist. Ältere, noch unkonfigurierte Standalone-Sessions
(`qaClosesAt IS NULL`) öffnen weiterhin die Einrichtung; Abbrechen dort
beendet die Session und kehrt zur Startseite zurück. Wird Q&A
später in einer bestehenden Session aktiviert, bleiben Einrichtung und
Zugangskarte Schritt 1 und 2 von 2; Abbrechen dort lässt die Session bestehen.
Spätere Q&A-Einstellungen und eine Zugangskarte nach Reload bleiben ohne
Schrittzahl, sobald die Karte bestätigt oder nicht mehr vorgemerkt ist.

Verfügbar sind:

- um eine Stunde;
- um einen Kalendertag;
- um sieben Kalendertage;
- bis zu einem absoluten Datum mit Uhrzeit.

Relative Verlängerungen rechnen ab dem bisherigen `expiresAt`. Die
warnungsbasierte Aktion ändert ausschließlich `expiresAt`. Insbesondere bleiben
`qaClosesAt`, der Q&A-Öffnungszustand und andere Kanalzustände unverändert. Die
Bestätigung stellt altes und neues Sessionende sowie den unveränderten
Q&A-Schluss gegenüber. Q&A-bedingte Erstöffnung und Neuplanung werden getrennt
in Slice #417 umgesetzt.

## Obergrenzen und Berechtigungen

`MAX_SESSION_DURATION` begrenzt die gesamte Dauer ab `createdAt`. Unterstützt
werden `PT24H`, `P14D` sowie die Kurzformen `24h` und `14d`. Zulässig sind
24 Stunden bis 30 Tage. Leer, ungültig oder außerhalb dieses Bereichs fällt auf
den Betreiberdefault von 14 Tagen zurück. Zusätzlich erzwingt PostgreSQL stets
das harte 30-Tage-Cap.

Globale Verlängerungen benötigen neben einem gültigen Hostnachweis ausdrücklich
den Nachweis des ursprünglichen Hosts. Route, Sessioncode, URL, Clientzustand
und Participant-ID sind keine Berechtigungsquelle. Anfangskonfigurationen
werden nach `firstParticipantJoinedAt` dauerhaft gesperrt, auch wenn später alle
Teilnahmen gelöscht wurden.

## Linearisierung und Ausfallverhalten

Sessionende und Friständerungen werden über den Session-Row-Lock serialisiert.
Die Datenbank prüft ihre Uhr erst nach einem möglichen Lock-Wait:

- gewinnt eine Verlängerung vor der bisherigen Frist, wird die neue Frist mit
  höherer Revision atomar sichtbar;
- gewinnt ein manuelles Ende, speichert der Trigger genau einen
  datenbankseitigen Endzeitpunkt;
- liegt der Linearisierungspunkt bereits am oder nach `expiresAt`, wird
  `endedAt = expiresAt` kanonisch materialisiert;
- ein später Commit kann weder einen späteren Endzeitpunkt erzeugen noch eine
  beendete Session wiederbeleben.

Trigger schützen persistente fachliche Writes auf Sessions, Teilnahmen, Teams,
Stimmen und Q&A-Datensätzen auch bei alten App-Images. Das aktuelle Backend
prüft zusätzlich Redis-basierte Live-Kanäle unmittelbar. Autorisierte Admin-,
Audit-, Legal-Hold- und Bereinigungsvorgänge bleiben getrennt und dürfen weder
Inhalte reaktivieren noch Fristen verlängern.

Der Cleanup läuft minütlich, wählt höchstens 200 abgelaufene Sessions mit
`FOR UPDATE SKIP LOCKED` und verwendet ausschließlich die PostgreSQL-Uhr. Ein
verzögerter oder ausgefallener Cleanup öffnet kein Schreibfenster, weil
Mutationen und Teilnehmer-Q&A-Reads den effektiven Endzustand unabhängig von
der Materialisierung beachten.

## Client-Fallback

Teilnehmer- und unauthentifizierte Present-Verträge liefern `serverNow`,
`expiresAt` und `sessionLifecycleRevision`. Der Client schreibt die bestätigte
Serverzeit mit `performance.now()` monoton fort und vertraut nicht auf die
Geräte-Wanduhr. Am Deadlinepunkt werden aktive Quiz-, Q&A-, Blitzlicht- und
Projektionsdaten fail-closed entfernt. Hintergrund-/Sleep-Resume prüft die
Frist vor neuem Rendern.

Verspätete oder widersprüchliche Lifecycle-Snapshots dürfen die fortgeschriebene
Serverzeit nicht zurücksetzen. Nach lokalem Ende kann nur ein aktiver,
serverautorisierter Snapshot mit höherer Revision die Ansicht wieder öffnen
und den Timer auf die bestätigte neue Frist setzen.

## Q&A-Teilnahmeprofil

Eine Session verwendet genau eines der drei Profile
`PRESET_PSEUDONYM`, `CUSTOM_NICKNAME` oder `ANONYMOUS`. Der Host legt es
beim direkten Q&A-Start fest. Der kanonische Zustand liegt in den
`onboarding*`-Feldern der Session; Frontendzustand und Teilnehmer-ID sind keine
Berechtigungs- oder Konfigurationsquelle.

Die Backendmutation `session.configureParticipationProfile` akzeptiert nur
effektiv aktive Q&A-Sessions vor `firstParticipantJoinedAt`. Der Datenbankmarker
wird beim ersten erfolgreichen Join atomar und genau einmal gesetzt und bleibt
auch nach dem Löschen aller Teilnahmen bestehen. Damit sperren paralleler
Erstbeitritt, Reload, Reconnect und Gerätewechsel die Konfiguration dauerhaft.
Teamkonfiguration und andere Onboardingfelder werden bei einer Profiländerung
nicht verändert.

Ein bereits laufender Quiz- oder Blitzlichtkanal schaltet Q&A nicht über
`enableQaChannel` frei. Dieser Legacy-Schalter liefert nur noch einen bereits
fristgebunden eingerichteten Kanal. Die erste Einrichtung und jede Neuplanung
laufen über `configureQaChannel` inklusive serverseitiger Fristprüfung beim
Bestätigen, nicht über einen zweiten Vorschaudialog. Die Host-UI zeigt die
ausgerechnete Teilnahmefrist und eine eventuelle Sessionverlängerung direkt im
Einrichtungsformular. Beim späteren Aktivieren in einer bestehenden Session
gehört das Teilnahmeprofil zur Einrichtung; beim Anlegen von der Startseite
bleibt es in Schritt 1. Frist und optionales Teilnahmeprofil gelten vor dem
ersten Beitritt.

Im Anonymmodus liefert der Teilnehmervertrag keine sichtbare
`authorNickname`-Angabe. Technische Session-, Teilnehmer- und
Missbrauchsschutzdaten bestehen zweckgebunden weiter; die UI bezeichnet den
Modus daher nicht als vollständige Anonymisierung.

## Nachbereitung und technische Löschung

`endedAt` startet ein 14-tägiges Host-Nachbereitungsfenster. Währenddessen
dürfen validierte Hosts bestehende Q&A-Inhalte ausschließlich lesen und
exportieren. Teilnehmerreads und sämtliche fachlichen Schreibpfade bleiben
nach dem effektiven Sessionende geschlossen. Nach
`postProcessingEndsAt = endedAt + 14 Tage` endet auch der Inhaltszugriff des
Hosts.

Die Join-Kapsel neben dem QR-Code bleibt kompakt: Code und Teilnehmerzahl,
ohne Sessionende und ohne Löschtermin. Das absolute Sessionende bleibt
in der Q&A-Fristzeile. Host und Vote zeigen dieselbe offene-bis-Zeile mit
relativer Restzeit; Q&A-Einstellungen bleiben host-only. Quiz- und
Blitzlichtansicht behalten dieselbe kompakte Kapsel. Die 30- und 5-Minuten-Warnung gilt weiter sessionweit. Die Aktionen
„Maximales Q&A-Ende“ und „Löschtermin anzeigen“ sitzen nur im Q&A-Kanal in der
unteren Host-Action-Bar neben „Session beenden“, nicht in der
Kopfzeile. „Maximales Q&A-Ende“ bezeichnet die Obergrenze des Q&A-Kanals,
nicht das Quiz- oder Blitzlichtende. „Löschtermin anzeigen“ öffnet die
Nachbereitungs- und Löschtermine in einem Dialog.

Der Lifecyclevertrag projiziert und liefert:

- `postProcessingEndsAt`: Ende des Host-Lese-/Exportfensters;
- `purgeEligibleAt`: frühester regulärer Löschzeitpunkt des Sessionkerns;
- `expectedDeletionAt`: `purgeEligibleAt` oder ein späterer aktiver Legal Hold;
- `deletionDelayedByLegalHold`: Hinweis auf die technische Verzögerung;
- `hostContentAccessAllowed`: serverseitig berechnete Inhaltsfreigabe.

Ein Legal Hold verändert ausschließlich die technische Löschreife. Er öffnet
keinen Host- oder Teilnehmerzugriff und reaktiviert keine Schreibmutation.
Reguläre Purges invalidieren Host- und Pairing-Nachweise vor der
DB-Transaktion. Scheitert die Entwertung, bleibt der Sessionkern für einen
Retry bestehen.

Beim Purge löscht PostgreSQL Teilnehmer, Stimmen, Q&A-Fragen und Upvotes
kaskadierend. Bonusnachweise und Sessionbewertungen werden für ihre eigene
90-Tage-Frist entkoppelt; Session- und Teilnehmer-IDs werden auf `NULL`
gesetzt. Administrative Audits behalten für höchstens 365 Tage nur einen
SHA-256-basierten pseudonymen Sessionbezug. Sessiongebundene
Produktfeedback-Invite-Jobs werden entfernt. Diese Fristen sind Höchstfristen,
keine Zusage eines zusätzlichen Zugriffs.

## Migration, Rolling Deployment und Rollback

Die Migration `20260915080000_session_absolute_lifecycle` füllt Bestandsdaten
deterministisch:

- `createdAt = startedAt`;
- `expiresAt = startedAt + 24 Stunden`;
- bei aktiviertem Q&A zunächst `qaClosesAt = expiresAt`;
- `firstParticipantJoinedAt = MIN(Participant.joinedAt)`;
- Zeitzone `UTC`, Revision `0`.

DB-Defaults machen alte Images bei neuen Sessions weiterhin lauffähig.
Lifecycle-Felder in den öffentlichen Create-/Statusverträgen sind während des
Rolling Deployments optional; neue Clients bleiben mit alten Antworten
kompatibel. Die Trigger schützen neue Invarianten auch während noch ein altes
Image schreibt.

Die Migration ist vorwärtsgerichtet und wird bei einem App-Rollback nicht
zurückgerollt. Für alte Cleanup-Logik wird `startedAt` bei einer Friständerung
auf `max(createdAt, expiresAt - 24 Stunden)` nachgeführt. Dadurch verkürzt ein
Rollback auf ein Image mit der früheren 24-Stunden-Regel eine bereits
bestätigte längere Frist nicht. Ein späteres Absenken von
`MAX_SESSION_DURATION` ändert bestehende `expiresAt`-Werte ebenfalls nicht
rückwirkend.

`20260915090000_session_retention` stellt die Set-Null-Beziehungen und
minimierten Auditfelder her.
`20260916140000_qa_title_moderation_lifecycle_revision` erlaubt eine
Revision bei Titel- oder Moderationsänderung des Q&A-Kanals; eine erhöhte
Revision ohne eines dieser Felder bleibt verboten.
`20260915091000_session_retention_rolling_bridge` hält den früheren, auf
`startedAt + 24h` basierenden Cleanup bis zum Ende der 14-tägigen
Nachbereitung beziehungsweise eines Legal Holds zurück. Ein DB-Trigger
minimiert Auditbezüge und entfernt Invite-Jobs auch dann, wenn während eines
Rolling Deployments noch ein altes Image den Sessionkern löscht. Der weiterhin
minütliche alte Feedback-Cleanup dient als TTL-Bridge für entkoppelte
Bewertungen und Admin-Audits.

Alle drei Migrationen bleiben bei einem App-Rollback vorwärts angewandt. Ein
Schema-Downgrade ist nicht vorgesehen; das Rückrollen erfolgt ausschließlich
über das App-Image.

## Verifikation

Der CI-Migrationsjob führt nach `prisma migrate deploy` und Driftprüfung den
opt-in PostgreSQL-Test
`session.absolute-lifecycle.pg.test.ts` und `session.retention.pg.test.ts` aus.
Sie decken Defaults,
Unveränderlichkeit, die `startedAt`-Rollback-Brücke, Child-Write-Sperren,
automatische Endmaterialisierung sowie Verlängerung-/Ende-Races über mehrere
DB-Verbindungen, Q&A-Titel-/Moderationsrevisionen sowie Cascade/SetNull,
Legal-Hold-Bridge, Audit-Minimierung und die getrennten TTLs ab.

Lokal:

```bash
RUN_PG_SESSION_LIFECYCLE_TESTS=1 \
  npm run test -w @arsnova/backend -- \
  --run src/__tests__/session.absolute-lifecycle.pg.test.ts \
        src/__tests__/session.retention.pg.test.ts

BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
  npm run smoke:epic-405-host-qa-lifecycle -w @arsnova/frontend
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
  npm run smoke:epic-405-participant-qa -w @arsnova/frontend
```

Controlled-Clock-Tests prüfen Zeitzonen, DST, Operator-/Hard-Cap und den
monotonen Clientfallback. Frontend-Komponententests prüfen beide Warnschwellen,
Fristisolation und die inhaltsfreie Teilnahme-/Present-Ansicht ohne
Terminalevent.
