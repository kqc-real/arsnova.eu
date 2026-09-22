<!-- markdownlint-disable MD013 MD060 -->

# Session-Einstieg: Host und Vote

**Stand:** 2026-09-19

**Zweck:** Validierte Kombinationstabelle, wer mit welchem Nachweis welche
Session-Ansicht erreicht, verlässt und wieder betritt. Fachlicher
Lebenszyklus bleibt in [session-lifecycle.md](session-lifecycle.md);
Capabilities in [session-capabilities.md](session-capabilities.md);
Host-Wiederherstellung in
[HOST-RECOVERY-RUNBOOK.md](../operations/HOST-RECOVERY-RUNBOOK.md).

**Validierung:** Jede Zelle ist gegen Implementierung geprüft. Die Spalte
**Beleg** nennt die härteste vorliegende Evidenz, nicht eine live im Browser
durchgespielte Matrix.

| Beleg         | Bedeutung                                                                   |
| ------------- | --------------------------------------------------------------------------- |
| **Code+Test** | Implementierung und mindestens ein Unit-, PG-, Komponenten- oder Smoke-Test |
| **Code**      | Implementierung gelesen; kein direkter Test genau für diese Zelle           |
| **Browser**   | Plattformverhalten (Tab, `sessionStorage`); im Repo nicht isoliert testbar  |
| **Lücke**     | Benachbarte Pfade widersprechen sich, oder der Risikopfad hat keinen Test   |

Keine Zelle behauptet eine manuelle Browser-Abnahme vom 2026-09-19.

---

## 1. Rollen und Nachweise

Host und Vote sind getrennte Identitäten. Derselbe Browser darf beide
gleichzeitig halten. Ein Session-Code allein ist keine Berechtigung.

| Nachweis                  | Speicher                                                | Gilt für                                                                             |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Host-Token                | `sessionStorage` `arsnova-host-token:{CODE}`            | Host- und Present-Route, `x-host-token` nur auf `/session/:code/host` und `/present` |
| Host-Rolle                | `sessionStorage` `arsnova-host-role:{CODE}`             | `ORIGINAL_HOST` oder `PAIRED_HOST`                                                   |
| Host-Browser-Capability   | `localStorage` `arsnova-host-browser-capability-{CODE}` | Guard stellt Token nach Tab-/Browserneustart neu aus                                 |
| Zuletzt gehostete Session | `localStorage` `arsnova-last-hosted-session`            | Bevorzugter Home-CTA-Code                                                            |
| Teilnehmer-Capability     | `localStorage`, sessiongebunden                         | Rejoin derselben Session                                                             |
| Teilnehmer-ID             | `localStorage` `arsnova-participant-{CODE}`             | Vote-Submit, Presence                                                                |
| Letzte Sessions (Home)    | `localStorage` `home-recent-sessions`                   | Max. 3 **Join**-Codes, nicht Host-Create                                             |

Quellen: `host-session-token.ts`, `host-recovery-access.ts`,
`participant-session-access.ts`, `trpc.client.ts` (`resolveRouteHostSessionCode`).

---

## 2. Startseite: Host anlegen oder wieder öffnen

### 2.1 Gefüllte CTAs »Q&A-Session XXXXXX«

| Ausgangslage                                                 | Wirkung                                                                                                                                                                                                                                                                                                                                   | Beleg     | Quelle                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------ |
| Keine aktivierte Browser-Capability                          | Keine Host-CTA-Reihe                                                                                                                                                                                                                                                                                                                      | Code+Test | `listStoredHostBrowserCapabilityCodes`     |
| Nur Recovery-Kandidat, keine aktivierte Capability           | Keine Host-CTA-Reihe                                                                                                                                                                                                                                                                                                                      | Code+Test | `home.component.spec.ts` (Kandidat allein) |
| Eine oder mehrere aktivierte Capabilities                    | Lookup bis 32 Codes; nur Sessions mit eingerichtetem Q&A (`qaClosesAt` bzw. Kanal nicht `DISABLED`/`UNCONFIGURED`); Sortierung offen zuerst (zuletzt gehostete, sonst frühestes Offen-bis), dann geschlossen (frühestes Zugang-bis); Anzeige höchstens 8; gefüllt nur das erste offene Forum                                              | Code+Test | `loadHostSessionCtas`, Spec                |
| Capability nur für Quiz oder Blitzlicht ohne Q&A-Einrichtung | Kein Host-CTA; Wiederöffnen der beendeten Session von der Startseite aus nicht angeboten                                                                                                                                                                                                                                                  | Code+Test | `isQaConfiguredForHostResume`, Spec        |
| `getInfo` schlägt fehl oder Zugangsfrist vorbei              | Dieser Code entfällt; Frist und Offen-Status gegen `serverTime`/`serverNow` der Antwort, nicht gegen die Geräteuhr                                                                                                                                                                                                                        | Code+Test | `loadHostSessionCtas`                      |
| CTA-Klick                                                    | `/session/{code}/host?tab=qa`                                                                                                                                                                                                                                                                                                             | Code+Test | `home.component.html`, Spec                |
| Eimer-Icon rechts neben dem CTA                              | Bestätigung: Hauptaktion **Session löschen** (frisches `issueHostAccessToken`, allein `session.end`, lokales Vergessen); Ausnahme **Nur Schnellzugang entfernen**; parallele Löschungen gesperrt; Fokus nach Entfernen auf nächsten Eimer oder neuen Q&A-Button; CTA verschwindet sofort und bleibt nach veralteter `getInfo`-Antwort weg | Code+Test | `removeHostSessionCta`, Spec               |
| Zweite Zeile                                                 | »Zugang bis {Frist}« aus `postProcessingEndsAt` sonst `expiresAt`; Fallback »Zugang als Host«                                                                                                                                                                                                                                             | Code+Test | `hostSessionCtaDescription`                |
| Dritte Zeile                                                 | »Offen bis {Frist}« aus `qaClosesAt` sonst `expiresAt`; nach Ablauf »Forum geschlossen«                                                                                                                                                                                                                                                   | Code+Test | `hostSessionCtaOpenDescription`            |
| Vierte Zeile                                                 | »{n} Fragen« bzw. »1 Frage«: teilnehmendensichtbare Q&A-Fragen (`ACTIVE`/`PINNED`/`ARCHIVED`) aus `getInfo.qaQuestionCount` (Live-Count, nicht der Seed-Zähler); ohne Zähler keine Zeile                                                                                                                                                  | Code+Test | `hostSessionCtaQuestionDescription`        |
| Textlink »Host-Zugang wiederherstellen« auf der Live-Karte   | Entfernt                                                                                                                                                                                                                                                                                                                                  | Code+Test | `home.component.spec.ts`                   |

Diese CTAs legen nichts an. Die alte Session endet nicht.

### 2.2 Tonale Live-Buttons

| Aktion                                            | Wirkung                                                                                                                                                                                                                                                                                                                                                                                                                          | Beleg     | Quelle                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------- |
| **Live-Quiz**                                     | Wie Blitzlicht: vorhandene Host-Session öffnen (`?tab=quiz`), sonst `session.create` ohne `quizId`. Host öffnet die Quizauswahl, wenn der Quizkanal noch fehlt oder nach FINISHED ein Folgeqiz möglich ist. Kurzbeschreibung **Aus Sammlung wählen**. Eigenes letztes Quiz: Filled-CTA **Letztes Quiz starten** auf derselben Live-Karte (`?startLiveQuiz=`), nicht auf Vorbereiten. Sammlung bleibt über die Vorbereiten-Karte. | Code+Test | `openHeroHostTab('quiz')`, `home-live-last-quiz`  |
| **Q&A** / **Neue Q&A**                            | Ohne Host-CTA **Q&A**, mit mindestens einem Host-CTA **Neue Q&A**. Immer Teilnahme-Dialog, dann `session.create`. Vorhandene Host-Sessions bleiben offen und als CTA stehen.                                                                                                                                                                                                                                                     | Code+Test | `openHeroHostTab('qa')`, `home.component.spec.ts` |
| **Q&A** Dialog abbrechen                          | Kein Create                                                                                                                                                                                                                                                                                                                                                                                                                      | Code+Test | Spec                                              |
| **Blitzlicht** mit Host-Token in Feld oder Recent | Wieder öffnen: `/session/{code}/host`, außer die Session ist `FINISHED` ohne joinbares Q&A – dann neues Create                                                                                                                                                                                                                                                                                                                   | Code+Test | `resolveHeroHostCode`, Spec                       |
| **Blitzlicht** ohne Host-Token                    | Sofort `session.create` (`quickFeedbackEnabled: true`), kein Teilnahme-Dialog. Snack **Neue Blitzlicht-Session gestartet.** nur nach Create, nicht nach Resume.                                                                                                                                                                                                                                                                  | Code+Test | Spec                                              |
| Parallel zweiter Start                            | Blockiert (`hostSessionStarting`)                                                                                                                                                                                                                                                                                                                                                                                                | Code+Test | Spec                                              |
| PWA `?host=qa`                                    | Entfernt Query, legt neue Q&A-Session an                                                                                                                                                                                                                                                                                                                                                                                         | Code      | `launchHostShortcutIfRequested`                   |

Hero-Create schreibt **nicht** in »Letzte Sessions«.

---

## 3. Startseite: Vote beitreten

| Ausgangslage                                                   | Wirkung                                                               | Beleg     | Quelle                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | --------- | ---------------------------------------------------- |
| Gültiger Code, kein aktives Blitzlicht, Session nicht terminal | `/join/{code}`, Code in Recent (max. 3)                               | Code+Test | `joinSession`, `resolveJoinTarget`                   |
| Aktives Standalone-/Kanal-Blitzlicht (Resolver)                | `/feedback/{code}/vote`                                               | Code+Test | Spec »Blitzlicht-Abstimmung«                         |
| `FINISHED` und Q&A nicht joinbar                               | Fehler »Diese Session ist bereits beendet.«; Code aus Recent entfernt | Code+Test | Query-Pfad getestet; Submit nutzt denselben Resolver |
| `FINISHED` und Q&A joinbar (`qaJoinable: true`)                | `/join/{code}`                                                        | Code+Test | Spec »Quiz-FINISHED ins Q&A-Onboarding«              |
| Recent-Chip                                                    | `joinSessionByCode` → **Join/Vote**, nie Host                         | Code      | `joinSessionByCode`                                  |
| Host-Create-Code in Recent                                     | Nur wenn zuvor über Home **beigetreten** wurde                        | Code      | `addToRecentSessionCodes` nur im Join-Pfad           |
| Parallel-Join                                                  | Zweiter Klick ignoriert                                               | Code+Test | Spec                                                 |
| Lookup-Fehler                                                  | Fehler, Recent entfernt                                               | Code+Test | Spec                                                 |

### 3.1 Recent-Liste gegen Join-Gatter

| Pfad                                          | `FINISHED` + offenes Q&A                 | Beleg     |
| --------------------------------------------- | ---------------------------------------- | --------- |
| `resolveJoinTarget`                           | Join erlaubt (`qaJoinable`)              | Code+Test |
| `session.join` Backend                        | Join erlaubt                             | Code+Test |
| `isSessionVisitable` / Idle-Validation (~2 s) | Chip bleibt (`qaJoinable` wie beim Join) | Code+Test |

Join, Backend und Recent-Liste nutzen dasselbe Gatter: `FINISHED` ohne offenes
Q&A fliegt raus, `FINISHED` mit offenem Q&A bleibt.

---

## 4. Direkte Routen

| URL                       | Nachweis im Browser               | Wirkung                                                       | Beleg     |
| ------------------------- | --------------------------------- | ------------------------------------------------------------- | --------- |
| `/session/:code`          | Host-Token vorhanden              | Redirect `/session/:code/host`                                | Code+Test |
| `/session/:code`          | Kein Host-Token                   | Redirect `/join/:code`                                        | Code+Test |
| `/session/:code/host`     | Host-Token                        | Host-Ansicht                                                  | Code+Test |
| `/session/:code/host`     | Nur aktivierte Capability         | Guard: `issueHostAccessToken`, dann Host                      | Code+Test |
| `/session/:code/host`     | Nur Recovery-Kandidat             | Guard versucht Issue/Activate, sonst `/host-recovery`         | Code+Test |
| `/session/:code/host`     | Weder Token noch Capability       | `/host-recovery`                                              | Code+Test |
| `/session/:code/vote`     | Egal ob Host-Token liegt          | Vote-Route. **Kein** `x-host-token` (nur `host`/`present`)    | Code+Test |
| `/session/:code/present`  | Host-Token oder IndexedDB-Restore | Present; sonst Join-Umleitung                                 | Code+Test |
| `/join/:code`             | Auch mit Host-Token               | Bleibt Join. Kein Host-Redirect.                              | Code+Test |
| `/join/:code` ohne Locale | —                                 | Redirect `/{preferredLocale}/join/{code}`                     | Code      |
| `/host-recovery`          | —                                 | Formular (Support-ID + Geheimnis), **keine** Capability-Liste | Code+Test |
| `/feedback/:code`         | Kein Feedback-Host-Token          | Redirect `/feedback/:code/vote`                               | Code      |
| `/feedback/:code/vote`    | —                                 | Standalone-Blitzlicht-Vote                                    | Code      |

QR und Deep-Link `/join/CODE` sind der vorgesehene Weg, als Host die **eigene**
Session als Vote zu betreten. Nacktes `/session/CODE` führt denselben Browser
zurück zum Host.

---

## 5. Rollenwechsel

Session A = offene Host-Session dieses Browsers. Session B = andere Session.

| Von            | Nach              | Tab-Lage                                                       | Session A endet? | Sicht                                                                | Beleg                      |
| -------------- | ----------------- | -------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------- | -------------------------- |
| Host A         | Host A (CTA)      | Gleicher Tab                                                   | Nein             | Host, Tab Q&A                                                        | Code+Test                  |
| Host A         | Neue Host-Session | Tonal **Q&A** ohne Token                                       | **Nein**         | Neue Host-Session; CTA zeigt neuen Code                              | Code+Test                  |
| Host A         | Vote A            | Gleicher Tab nach »Zur Startseite« (Q&A offen), dann `/join/A` | Nein             | Teilnehmer-UI; echte Teilnahme                                       | Code                       |
| Host A         | Vote A            | Zweiter Tab, URL getippt (leeres `sessionStorage`)             | Nein             | Wie jeder Vote                                                       | Code + Browser             |
| Host A         | Vote A            | Duplizierter Host-Tab                                          | Nein             | Bleibt Host (`sessionStorage` kopiert)                               | Browser                    |
| Host A         | Vote B            | Home »Los geht’s« oder `/join/B`                               | Nein             | Vote B; Host-Nachweis A bleibt                                       | Code                       |
| Vote A         | Host A            | Home-CTA oder `/session/A/host`                                | —                | Host. Teilnehmer-Capability bleibt liegen                            | Code                       |
| Vote A         | Vote B            | Anderer Code                                                   | A bleibt         | Neue oder gespeicherte Teilnahme in B                                | Code+Test                  |
| Paired Host A  | Host A            | Token `PAIRED_HOST`                                            | —                | Host-Steuerung ja; keine globale Verlängerung, kein Pairing-Manage   | Code+Test                  |
| Paired Host A  | Vote A / Vote B   | Wie Original-Host                                              | Nein             | Kein Frontend-Block                                                  | Code                       |
| Vote ohne Join | `/session/A/vote` | Deep-Link                                                      | —                | Frage lesbar ohne UUID; Submit braucht Teilnahme (Auto-Join-Versuch) | Code / Auto-Join: **Code** |

Host als Vote sieht **keine** Host-Steuerung und **keine** `isCorrect`-Daten
während `ACTIVE` (`getCurrentQuestionForStudent`). Die Person erscheint im
Host-Verzeichnis unter dem gewählten Nickname und zählt in Zähler, Team,
Rangliste und Export.

`vote.submit` lehnt `status === FINISHED` **immer** ab — auch bei offenem Q&A.
Nach durchgespieltem Quiz kann der Host-als-Vote im Forum schreiben, aber
keine Quiz-Stimme mehr abgeben.

---

## 6. Verlassen

### 6.1 Host

| Ausgangslage                                     | Wirkung                                                                                                                                              | Beleg     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Q&A offen (`enabled`+`open`+`state` OPEN/undef.) | Exit-Anker **Zur Startseite**. `canDeactivate` ohne `session.end`. Offenes Blitzlicht wird geschlossen, damit Home-Join nicht nach Feedback hijackt. | Code+Test |
| Q&A nicht offen, Session aktiv                   | Dialog **Gesamte Session beenden?**; Bestätigung → `session.end`                                                                                     | Code+Test |
| Navigation Host → `/join/A` ohne offenes Q&A     | Dieselbe `canDeactivate`-Kette; ohne Bestätigung keine Navigation                                                                                    | Code      |
| Logo in der Toolbar                              | Verlässt Vollbild; `routerLink` `/` löst `canDeactivate` aus                                                                                         | Code      |
| Session bereits `FINISHED`                       | Leave erlaubt; Token bleibt für Product-Feedback auf Home                                                                                            | Code+Test |
| Bestätigtes Session-Ende                         | Token bleibt bis Dismiss des Host-Product-Feedback                                                                                                   | Code+Test |

### 6.2 Vote

| Ausgangslage                                                   | Wirkung                                                                                                                        | Beleg     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Laufende oder verlängerte Session (`expiresAt` in der Zukunft) | **Kein** Button »Zur Startseite«. Nur Logo (Toolbar bleibt sichtbar: `hideAppChrome` gilt nicht für Vote) oder Browser-Zurück. | Code      |
| Session-End-Gate / Abschlussaktionen                           | Primäraktion **Zur Startseite** (`continueToHomeAfterSessionEnd`)                                                              | Code+Test |
| Verlassen (Logo, Zurück, Navigate)                             | Kein `canDeactivate`. `markParticipantOffline` (Presence weg, Datensatz bleibt).                                               | Code+Test |
| `FINISHED` + Q&A noch joinbar                                  | Kein End-Gate; Quiz-Bewertung auf dem Vote; Q&A/Blitzlicht bleiben per Kanalwahl erreichbar                                    | Code+Test |
| `FINISHED` + Q&A zu, oder `expiresAt` erreicht                 | End-Gate; Quiz-Bewertung nur wenn `quizStarted` und nicht `hostEnded`                                                          | Code+Test |
| Host `session.end`                                             | End-Gate ohne Quiz-Bewertung; Bonus-Code bleibt sichtbar                                                                       | Code+Test |

Verlängerung (`changeExpiration`) ändert nur `expiresAt`. Sie fügt keinen
Vote-Exit hinzu und ändert Q&A-Öffnung nicht
([session-lifecycle.md](session-lifecycle.md)).

---

## 7. Wiederbeitritt und Doppelstimme

| Weg                                                        | Teilnahme                                                                                                      | Quiz-Stimme dieselbe Frage/Runde                                                                                    | Beleg     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| Logo → Home → Join, gleicher Nickname / Kindergarten-Index | Dieselbe `participantId`                                                                                       | Nein. Unique `(session, participant, question, round)`; Duplikat gibt die alte `voteId` zurück, überschreibt nicht. | Code+Test |
| Join mit anderem Nickname (Token wird nicht mitgesendet)   | **Dieselbe** Teilnahme, wenn dieselbe `anonymousClientId` (Browser) bereits gebunden ist; sonst neue Teilnahme | Nein bei gleichem Browser; Ja nur mit neuem Client/Gerät/geleertem Storage                                          | Code+Test |
| Incognito / Storage geleert / anderes Gerät                | Neue Teilnahme                                                                                                 | Ja                                                                                                                  | Code+Test |
| Capability von Session A in Session B                      | Neue Teilnahme in B                                                                                            | Unabhängig                                                                                                          | Code+Test |
| Peer Instruction Runde 2                                   | Dieselbe Teilnahme                                                                                             | Zweite Stimme **erlaubt** (andere `round`)                                                                          | Code+Test |
| Q&A-Upvote                                                 | Pro Frage ein Toggle                                                                                           | Kein zweites dauerhaftes Upvote                                                                                     | Code+Test |
| Session-Feedback                                           | Einmal; sonst »Du hast bereits bewertet.«                                                                      | —                                                                                                                   | Code+Test |
| Standalone-Blitzlicht                                      | Redis `ALREADY_VOTED`                                                                                          | Nein                                                                                                                | Code      |

---

## 8. Lebenszyklus-Gatter

| Zustand                                      | Home-Join | `session.join` | Vote-UI live           | Quiz-`vote.submit`  | Q&A lesen/schreiben | Host-UI                                                                                                                                 |
| -------------------------------------------- | --------- | -------------- | ---------------------- | ------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `LOBBY` / `ACTIVE`, vor `expiresAt`          | Join      | Ja             | Ja                     | Ja (Phase `ACTIVE`) | Wenn Q&A offen      | Steuern                                                                                                                                 |
| Quiz `FINISHED`, Q&A `OPEN`, vor `expiresAt` | Join      | Ja             | Q&A, kein End-Gate     | **Nein** (FINISHED) | Ja                  | Q&A + Kanalwahl; **Nächstes Quiz in diesem Raum** / Blitzlicht öffnet neu (`canStartAnotherQuiz`)                                       |
| `FINISHED`, Q&A zu                           | Fehler    | `BAD_REQUEST`  | End-Gate               | Nein                | Nein                | Nachbereitung lesen/exportieren                                                                                                         |
| Host `session.end` (Startseite »löschen«)    | Fehler    | `BAD_REQUEST`  | End-Gate (alle Kanäle) | Nein                | Nein                | Q&A und Blitzlicht werden mitbeendet; `hostEnded` blendet die Quiz-Bewertung aus, Bonus-Code bleibt; Join-URL und Recent-Join entfallen |
| `expiresAt` erreicht                         | Fehler    | `BAD_REQUEST`  | End-Gate               | Nein                | Nein                | Abgelaufen                                                                                                                              |
| Nachbereitung (`postProcessingEndsAt`)       | —         | Nein           | End-Gate               | Nein                | Nein                | Host-Zugang bis Frist, ohne Live-Steuerung                                                                                              |

Quellen: `session.ts` `join`, `vote.ts` `submit`, `isQaOpenForParticipants`,
`qaHostWritesAllowed`, `handleSessionFinished`,
`session.absolute-lifecycle.pg.test.ts`, `session.join.test.ts`,
`session-vote.component.spec.ts`.

---

## 9. Tabs, Geräte, Storage

| Situation                             | Host-Token       | Capability        | Typischer Weg                                                             | Beleg               |
| ------------------------------------- | ---------------- | ----------------- | ------------------------------------------------------------------------- | ------------------- |
| Gleicher Tab nach »Zur Startseite«    | Bleibt           | Bleibt            | CTA → Host; `/join/CODE` → Vote                                           | Code                |
| Neuer Tab, URL getippt                | Leer             | Bleibt            | `/session/CODE/host` stellt Token aus Capability aus; `/join/CODE` → Vote | Code+Test / Browser |
| Duplizierter Tab                      | Kopiert          | Geteilt           | Bleibt Host                                                               | Browser             |
| Anderes Gerät / Incognito             | Fehlt            | Fehlt             | Host nur über Wiederherstellungscode; Vote = neue Teilnahme               | Code+Test           |
| Vote-Join löscht Host-Token **nicht** | Bleibt           | Bleibt            | Dual-Rolle im selben Browser                                              | Code                |
| Host-Product-Feedback dismissen       | `clearHostToken` | Capability bleibt | CTA kann über Capability wieder erscheinen                                | Code                |

---

## 10. Recovery und Pairing

| Situation                                      | Wirkung                                                                 | Beleg     |
| ---------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| Recovery-Seite                                 | Formular, kein Picker gespeicherter Capabilities                        | Code+Test |
| »Andere Session wiederherstellen«              | Formular zurücksetzen, kein Session-Wechsel-Menü                        | Code+Test |
| Genau ein offenes Resume                       | Auto-Fortsetzung                                                        | Code+Test |
| Gekoppelter Host                               | Host-Route ja; `GLOBAL_EXTENSION` `FORBIDDEN`; keine Pairing-Verwaltung | Code+Test |
| Host-Ansicht aller wieder aufrufbaren Sessions | Home-CTA-Reihe, Lookup 32, Anzeige höchstens 8                          | Code+Test |

---

## 11. Standalone-Blitzlicht gegen einheitliche Session

| Situation                                              | Wirkung                                                     | Beleg     |
| ------------------------------------------------------ | ----------------------------------------------------------- | --------- |
| Home-Join, Resolver `active`                           | `/feedback/:code/vote`                                      | Code+Test |
| Unified Vote, QF-Kanal                                 | Eingebettetes Blitzlicht, `voterId` = `participantId`       | Code      |
| `/feedback/:code/vote` bei noch laufender Quiz-Session | Redirect `/session/:code/vote?tab=quickFeedback`            | Code      |
| Host verlässt bei offenem Q&A                          | QF wird geschlossen, damit der nächste Join ins Forum fällt | Code+Test |

---

## 12. Bekannte Inkonsistenzen

1. **Höchstens acht Host-CTAs:** Der Lookup betrachtet bis zu 32 Capabilities.
   Der Rest bleibt im Speicher und erscheint nicht.
2. **Quiz-Vote nach `FINISHED`:** Forum ja, Stimme nein — auch für den
   Host-als-Teilnehmer.

---

## 13. DoS: 100 000 Sessions sind unkritisch

Session-**Anzahl** ist keine eigene DoS-Klasse. Öffentliches `session.create`
liegt bei 10/IP/h und 120 (Dev) bzw. 2 400 (Prod) global je Stunde; 100 000
Zeilen entstehen darüber nicht in einem Lastfenster. Die Home-CTA-Reihe ruft
höchstens 32 `session.getInfo` auf und zeigt acht Einträge. Lookups laufen über
den eindeutigen Code,
Purge in 100er-Batches. Ein DoD-Lasttest mit 100 000 Sessions ist nicht
erforderlich. Kritisch bleiben 500 gleichzeitige Hörsaal-Clients und das
Create-Globalbudget, nicht die historische Sessionzahl.

Hot-Path-Daten **in** einer Session (Fragen, Teilnahmen, Votes) sind ein
anderes Budget; siehe [qa-scaling.md](qa-scaling.md).

---

## 14. Quellen (Anker)

- Frontend Home: `apps/frontend/src/app/features/home/home.component.ts`
- Join: `apps/frontend/src/app/features/join/join.component.ts`
- Routen/Guards: `apps/frontend/src/app/app.routes.ts`,
  `session-host.guard.ts`, `present-view.guard.ts`
- Token/Capability: `apps/frontend/src/app/core/host-session-token.ts`,
  `host-recovery-access.ts`, `trpc.client.ts`
- Host-Leave: `session-host.component.ts` (`keepQaOpenOnHostLeave`,
  `canDeactivate`)
- Vote-Leave: `session-vote.component.ts` (`handleSessionFinished`,
  `continueToHomeAfterSessionEnd`, `ngOnDestroy`)
- Backend: `apps/backend/src/routers/session.ts` (`join`),
  `vote.ts` (`submit`), `lib/participantJoin.ts`
- Schema: `prisma/schema.prisma` (`Vote` unique, `QaUpvote` unique)
- Tests: `home.component.spec.ts`, `host-recovery-access.spec.ts`,
  `host-session-token.spec.ts`, `session-host.guard.spec.ts`,
  `join.component.spec.ts`, `session-vote.component.spec.ts`,
  `trpc.client.spec.ts`, `vote.test.ts`, `session.join.test.ts`,
  `session.capabilities.pg.test.ts`,
  `apps/frontend/scripts/check-unified-session-flow.mjs`
