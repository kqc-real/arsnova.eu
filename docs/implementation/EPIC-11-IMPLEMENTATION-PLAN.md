<!-- markdownlint-disable MD013 -->

# Epic 11 - Implementierungsplan: Verlagszugaenge und Redaktionsbackend (Westermann)

**Epic 11 - Verlagszugaenge & Redaktionsbackend (Westermann)**  
**Ziel:** Ein serverseitig geschuetzter Redaktionsbereich fuer 7 personalisierte Westermann-Verlagsaccounts, der sich in Erstellung und Verwaltung von Quizzen weitestgehend wie der bestehende `/quiz`-Flow anfuehlt. Die Umsetzung soll minimal-invasiv, performance-neutral und auf maximale Wiederverwendung bestehender Funktionen ausgelegt sein.

**Backlog-Bezug:** `Epic 11` in [`../../Backlog.md`](../../Backlog.md)  
**Status:** Planungsdokument / vor Implementierung / Angebotsoption  
**Abgrenzung:** Kein technischer Plattform-Admin (Epic 9), kein Lizenz-/Signaturmodell fuer geschuetzte Einzelimporte, keine zweite Live-Quiz-Infrastruktur.

---

## Kurzfassung

Die empfohlene Umsetzung baut **keinen zweiten Quiz-Editor** und **keine zweite Live-Session-Logik** auf.

Stattdessen werden drei vorhandene Staerken gezielt wiederverwendet:

1. `QuizStoreService` bleibt die bestehende lokale Bearbeitungs-Engine fuer Quizentwuerfe.
2. `QuizExportSchema` / `importQuiz(...)` / `exportQuiz(...)` bleiben das gemeinsame Dateiformat zwischen lokalem Editor und serverseitigem Redaktionsspeicher.
3. Der heutige Live-Start ueber `getUploadPayload(...)`, `quiz.upload` und `session.create` bleibt der einzige Pfad in die Live-Session.

Der neue Redaktionsbereich wird daher als **separater Workspace-Modus** ueber dieselben Quiz-Komponenten eingefuehrt:

- neuer Login- und Router-Namensraum fuer Verlagsaccounts
- neue serverseitige Persistenz fuer Verlagsquizze
- kleine Frontend-Fassade, die in Verlagsmodus dieselben Quiz-Komponenten mit servergespeicherten Daten speist
- lokale Entwurfsbearbeitung weiter ueber `QuizStoreService`, serverseitiges Speichern bewusst nur explizit

So bleibt der bestehende Local-First-Flow fuer normale Hosts unberuehrt, waehrend der Westermann-Redaktionsbereich optisch und fachlich moeglichst nah am heutigen Quiz-Flow bleibt.

---

## Harte Leitplanken

1. **Kein zweiter Editor-Stack.** `quiz-list`, `quiz-new`, `quiz-edit`, `quiz-preview` und `quiz.component` werden wiederverwendet.
2. **Kein Bruch im Local-First-Pfad.** Der bestehende `/quiz`-Bereich bleibt fuer normale Hosts unveraendert.
3. **Performance-neutral.** Keine serverseitige Autosave-Schleife pro Eingabe, kein Polling mit Voll-Dokumenten, keine neue Subscriptions-Last im Editor.
4. **Maximale Wiederverwendung.** Bestehende Import-/Export-, Validierungs- und Upload-Funktionen werden extrahiert oder gekapselt, nicht dupliziert.
5. **Klare Produktgrenze.** Verlagszugang ist ein eigener Bereich mit eigener Auth und eigener Persistenz, aber ohne neue Bearbeitungs-UX.
6. **Kein Yjs-Zwang fuer v1.** Der Redaktionsmodus benoetigt in der ersten Ausbaustufe keine Multi-Device-Sync- oder Kollaborationslogik.

---

## Wiederverwendbare Bausteine

| Bedarf               | Bestehende Funktion                                                 | Geplante Wiederverwendung                                                       |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Quiz-Editor          | `apps/frontend/src/app/features/quiz/*`                             | dieselben Shell-, Listen-, Edit-, New- und Preview-Komponenten                  |
| Lokale Bearbeitung   | `QuizStoreService`                                                  | bleibt Entwurfs- und Bearbeitungs-Engine, auch fuer Redaktionsentwuerfe         |
| Import               | `importQuiz(...)`, `normalizeQuizImportPayload(...)`                | Remote-Quiz wird fuer die Bearbeitung mit stabiler Server-ID lokal hydratisiert |
| Export               | `exportQuiz(...)`, `QuizExportSchema`                               | identisches Format fuer serverseitiges Speichern und accountbezogenen Export    |
| Live-Start           | `getUploadPayload(...)`, `quiz.upload`, `session.create`            | einziger Pfad fuer aus Verlagsspeicher gestartete Sessions                      |
| Admin-Session-Muster | `adminAuth.ts`, `adminProcedure`, Token-Verwaltung im `trpc.client` | nur das Session-Token-Muster wiederverwenden, nicht das Shared-Secret-Modell    |
| Login-UI-Muster      | `admin.component.ts`                                                | einfacher Login-Screen mit eigener Auth, aber ohne Admin-Dashboard-Komplexitaet |

---

## Optionen und Empfehlung

### Option A - Separates Redaktionsfrontend

Eigene Komponenten fuer Liste, Editor, Vorschau und Veroeffentlichung.

**Vorteil**

- klare Trennung

**Nachteile**

- hoher doppelter Pflegeaufwand
- hohes Regressionsrisiko
- unnoetig weit weg vom bestehenden Quiz-Flow

**Bewertung:** verwerfen

### Option B - Direkter Ersatz von `QuizStoreService` im Verlagsrouting

Die bestehenden Komponenten injizieren weiter `QuizStoreService`, im Verlagsrouting wird dieselbe Klasse durch einen Server-Store ersetzt.

**Vorteil**

- wenige Aenderungen an den Komponenten

**Nachteile**

- `QuizStoreService` ist heute zu stark auf Local-First, Storage und Yjs ausgerichtet
- ein serverseitiger Ersatz muesste grosse Teile der Klasse nachbauen
- hohes Risiko, Verhalten der lokalen Sammlung unbeabsichtigt mitzubewegen

**Bewertung:** technisch moeglich, aber zu sprengstoffhaltig

### Option C - Empfohlen: Workspace-Fassade ueber dem bestehenden Editor

Die bestehenden Quiz-Komponenten werden auf einen schmalen `QuizWorkspaceFacade`-Vertrag umgestellt.  
`LocalQuizWorkspaceFacade` delegiert nahezu 1:1 an `QuizStoreService`.  
`PublisherQuizWorkspaceFacade` kombiniert `QuizStoreService` fuer lokale Bearbeitung mit `publisher.*`-APIs fuer Login, Laden, Speichern, Link und Gesamtexport.

**Vorteile**

- minimale Aenderung an der UI
- Redaktionsbereich fuehlt sich wie `/quiz` an
- Local-First-Flow bleibt isoliert
- serverseitiges Speichern kann explizit und performance-neutral bleiben

**Bewertung:** empfohlene Zielarchitektur

---

## Zielarchitektur

## 1. Backend: neuer Verlagsbereich, keine Aenderung am normalen Host-Flow

### 1.1 Auth

Neuer Auth-Baustein analog zum Admin-Session-Muster, aber accountbasiert:

- neue Datei `apps/backend/src/lib/publisherAuth.ts`
- Login nicht ueber `ADMIN_SECRET`, sondern ueber persoenliche Accounts
- Session-Token in Redis mit TTL, analog zu Admin/Host
- neuer `publisherProcedure` in `apps/backend/src/trpc.ts`
- separater Header, z. B. `x-publisher-token`

**Wichtig:** Wiederverwendet wird nur das Session-Token-Muster, nicht das bestehende Shared-Secret-Konzept.

### 1.2 Persistenz

Minimaler Prisma-Schnitt fuer v1:

#### `PublisherAccount`

- `id`
- `username`
- `displayName`
- `passwordHash`
- `active`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

#### `PublisherQuiz`

- `id`
- `ownerAccountId`
- `name`
- `description`
- `questionCount`
- `document Json`
- `publicLinkSlug`
- `launchAccessMode`
- `launchSecretHash`
- `createdAt`
- `updatedAt`
- `createdByAccountId`
- `updatedByAccountId`

**Begruendung fuer `document Json`:**

- vermeidet ein zweites relationales Quiz-Datenmodell
- speichert direkt das bestehende Exportformat
- erlaubt Wiederverwendung von `QuizExportSchema`
- vermeidet Mapping- und Drift-Risiken zwischen lokalem und Verlagsspeicher

`name`, `description` und `questionCount` werden fuer Listen und Suche denormalisiert mitgefuehrt, damit Listenansichten keine grossen JSON-Dokumente laden muessen.

### 1.3 Router

Neuer Router `apps/backend/src/routers/publisher.ts` mit drei Ebenen:

#### Oeffentliche Procedures

- `publisher.login`
- `publisher.getLaunchInfo`
- `publisher.startProtectedSession`

#### Session-Geschuetzte Procedures

- `publisher.logout`
- `publisher.whoami`

#### Geschuetzte Redaktions-Procedures

- `publisher.listQuizzes`
- `publisher.getQuiz`
- `publisher.createQuiz`
- `publisher.saveQuiz`
- `publisher.deleteQuiz`
- `publisher.exportAccount`

### 1.4 Live-Start ueber bestehende Infrastruktur

Der Verlagslink soll keine eigene Session-Engine bekommen.

Empfohlener Pfad:

1. Redaktionsbackend speichert `QuizExport`-kompatibles JSON in `PublisherQuiz.document`.
2. Oeffentlicher Quizlink verweist auf einen kleinen Launch-Flow.
3. Optionaler Passwort-/Token-Schutz wird serverseitig geprueft.
4. Backend baut aus dem gespeicherten Dokument ein bestehendes `QuizUploadInput`.
5. Danach wird derselbe interne Pfad genutzt wie heute beim normalen Live-Start: `quiz.upload` plus `session.create`.

Dafuer wird ein gemeinsamer Helper benoetigt, der ein `QuizExport`-Dokument in `QuizUploadInput` ueberfuehrt. Diese Logik soll **aus `QuizStoreService.getUploadPayload(...)` extrahiert** werden, damit Frontend und Backend dieselbe Abbildung nutzen.

---

## 2. Frontend: gleicher Quiz-Flow, anderer Workspace

### 2.1 Routing

Neuer Routenbaum:

- `/publisher/login`
- `/publisher/quiz`
- `/publisher/quiz/new`
- `/publisher/quiz/:id`
- `/publisher/quiz/:id/preview`

Die bestehenden Komponenten werden wiederverwendet:

- `QuizComponent`
- `QuizListComponent`
- `QuizNewComponent`
- `QuizEditComponent`
- `QuizPreviewComponent`

Der bestehende lokale Bereich `/quiz` bleibt unveraendert.

`quiz/sync/:docId` wird im Verlagsmodus in v1 bewusst **nicht** angeboten. Das spart Komplexitaet und vermeidet, einen nicht angefragten Sync-Anspruch mitzutragen.

### 2.2 Workspace-Kontext

Neue schmale Frontend-Abstraktion:

- `QuizWorkspaceMode = 'LOCAL' | 'PUBLISHER'`
- `QuizWorkspaceFacade`
- `LocalQuizWorkspaceFacade`
- `PublisherQuizWorkspaceFacade`

Die bestehenden Quiz-Komponenten injizieren kuenftig nicht mehr direkt `QuizStoreService`, sondern die Fassade.

#### `LocalQuizWorkspaceFacade`

- delegiert fast vollstaendig an `QuizStoreService`
- aendert kein heutiges Verhalten

#### `PublisherQuizWorkspaceFacade`

- nutzt `QuizStoreService` weiterhin als lokale Bearbeitungs-Engine
- laedt und speichert Daten zusaetzlich ueber `publisher.*`
- kapselt alle Verlagsspezifika wie Login-Zustand, Serverliste, Speichern und Linkdaten

**Zentrale Wiederverwendung:**

- `publisher.getQuiz` liefert ein gespeichertes `QuizExport`
- dieses wird lokal ueber `quizStore.importQuiz(payload, overrideId)` mit stabiler Server-ID hydratisiert
- Bearbeitung laeuft danach in denselben Komponenten und denselben Update-Methoden
- `publisher.saveQuiz` nutzt `quizStore.exportQuiz(quizId)` als serverseitig validiertes Dokumentformat

So bleibt der Editor selbst unveraendert schnell und reagibel; nur Laden und Speichern werden ergaenzt.

### 2.3 UI-Verhalten

Zielbild fuer Redakteur:innen:

- Listenansicht sieht wie heutige Quiz-Sammlung aus
- neuer Button-/Textzustand fuer "im Verlag speichern" statt ausschliesslich lokal
- Editor, Vorschau, Import und Export verhalten sich gleich
- direkte Linkanzeige nach erfolgreichem Speichern/Veroeffentlichen
- Passwort-/Token-Konfiguration als zusaetzlicher Block in bestehenden Einstellungs-/Preview-Bereichen

Es sollen **keine neuen grossen Spezialseiten** fuer das Redaktionsbackend gebaut werden. Unterschiede zum lokalen Flow werden nur als kleine Workspace-spezifische Zusatzaktionen sichtbar.

---

## 3. Zugriffsschutz und Quizlink

Der Angebotsumfang verlangt keinen Importschutz fuer Lehrkraefte, sondern einen Startschutz fuer quizbasierte Links.

Minimaler v1-Schnitt:

- `launchAccessMode = NONE | PASSWORD | TOKEN`
- `launchSecretHash` nur serverseitig gespeichert
- `publicLinkSlug` pro Quiz stabil

Oeffentlicher Ablauf:

1. Lehrkraft oeffnet den Quizlink.
2. Backend liefert Metadaten des Verlagsquiz ohne Frageninhalt.
3. Falls Schutz aktiv ist, wird Passwort oder Token abgefragt.
4. Server prueft den Schutz und erstellt danach eine neue Live-Session ueber den bestehenden Upload-/Create-Pfad.

**Wichtig:** Der Schutz wird serverseitig erzwungen. Im Frontend wird nur die Eingabe eingesammelt.

---

## 4. Performance- und Invasivitaetsstrategie

### 4.1 Performance-neutral

- kein serverseitiges Autosave pro Eingabefeld
- lokale Bearbeitung bleibt im RAM und im bisherigen Local-Store
- Speichern in den Verlagsspeicher nur explizit durch Nutzeraktion
- Listen laden nur Summary-Felder, nicht das volle Quiz-JSON
- Voll-Dokumente werden nur bei Oeffnen, Speichern, Export und Startschutz-Konfiguration uebertragen
- keine neue Dauer-Subscription im Editor
- kein Yjs im Verlagsmodus v1

### 4.2 Minimal-invasiv

- bestehende Quiz-Komponenten bleiben erhalten
- bestehende Shared-Types fuer Quiz-Import/Export bleiben das Hauptvertragsformat
- `QuizStoreService` bleibt Bearbeitungszentrum
- neue Funktionalitaet wird ueber Fassade, Route-Context und wenige neue API-Bausteine angekoppelt
- keine Aenderung an der normalen Host-/Teilnehmenden-Route-Struktur

### 4.3 Wiederverwendung vor Neuentwicklung

Explizit wiederzuverwenden statt neu zu schreiben:

- `normalizeQuizImportPayload(...)`
- `importQuiz(...)`
- `exportQuiz(...)`
- `getUploadPayload(...)` bzw. extrahierte gemeinsame Mapping-Logik
- `QuizExportSchema`, `QuizUploadInputSchema`
- Admin-/Host-Token-Muster in Redis

---

## Implementierungsphasen

## Phase 1 - Vertrags- und Auth-Grundlage (Story 11.1)

Ziel: persoenliche Verlagsaccounts koennen sich anmelden; bestehende App-Pfade bleiben unberuehrt.

| #   | Task                   | Beschreibung                                                                                                              | Hauptorte                                    |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1.1 | Shared Types erweitern | Schemas fuer `PublisherLogin`, `PublisherWhoAmI`, `PublisherQuizSummary`, `PublisherQuizDetail`, `PublisherAccountExport` | `libs/shared-types/src/schemas.ts`           |
| 1.2 | Prisma-Modelle anlegen | `PublisherAccount`, `PublisherQuiz`                                                                                       | `prisma/schema.prisma`                       |
| 1.3 | Publisher-Auth bauen   | Passwortpruefung, Token-Erzeugung, Token-Invalidierung                                                                    | `apps/backend/src/lib/publisherAuth.ts`      |
| 1.4 | tRPC absichern         | `publisherProcedure` ergaenzen                                                                                            | `apps/backend/src/trpc.ts`                   |
| 1.5 | Login-Router           | `login`, `logout`, `whoami`                                                                                               | `apps/backend/src/routers/publisher.ts`      |
| 1.6 | Frontend-Tokenhandling | `get/setPublisherToken`, Header-Injektion analog zu Admin                                                                 | `apps/frontend/src/app/core/trpc.client.ts`  |
| 1.7 | Login-UI               | einfacher Verlagslogin, Stil nah am vorhandenen Admin-Login                                                               | `apps/frontend/src/app/features/publisher/*` |
| 1.8 | Route Guard            | `requirePublisherToken` und Verlagsrouten                                                                                 | `apps/frontend/src/app/app.routes.ts`        |

**Akzeptanz fuer Phase 1**

- 7 Verlagsaccounts koennen serverseitig angemeldet werden
- `/quiz` bleibt unveraendert
- `/publisher/quiz` ist nur mit gueltigem Verlagstoken erreichbar

## Phase 2 - Serverseitiger Verlagsspeicher (Story 11.2)

Ziel: Quizdokumente koennen serverseitig pro Account gelistet, geladen, gespeichert und geloescht werden.

| #   | Task                            | Beschreibung                                                                                                      | Hauptorte                                     |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 2.1 | Dokumentformat festziehen       | Server speichert validiertes `QuizExport` als JSON                                                                | `apps/backend/src/routers/publisher.ts`       |
| 2.2 | Summary-Felder pflegen          | Name, Beschreibung, Frageanzahl aus Dokument ableiten                                                             | `apps/backend/src/routers/publisher.ts`       |
| 2.3 | CRUD-APIs                       | `listQuizzes`, `getQuiz`, `createQuiz`, `saveQuiz`, `deleteQuiz`; Liste nur als Summary-Endpunkt mit Paging/Suche | `apps/backend/src/routers/publisher.ts`       |
| 2.4 | Passwort-Hashing                | accountbasiert, ohne neue schwere Runtime-Abhaengigkeit; bevorzugt `crypto.scrypt`                                | `apps/backend/src/lib/publisherAuth.ts`       |
| 2.5 | Initiale Account-Bereitstellung | kleiner Seed-/Provisioning-Pfad fuer 7 Accounts                                                                   | `apps/backend/scripts/*` oder DB-Provisioning |

**Akzeptanz fuer Phase 2**

- Listen laden nur Summary-Daten
- Einzelquiz laedt genau ein Dokument
- Daten sind accountbezogen getrennt

## Phase 3 - Workspace-Fassade und Routenreuse (Stories 11.1 und 11.2)

Ziel: dieselben Quiz-Komponenten koennen lokal oder im Verlagsmodus betrieben werden.

| #   | Task                          | Beschreibung                                                                               | Hauptorte                                                                     |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 3.1 | Workspace-Vertrag extrahieren | schmale `QuizWorkspaceFacade` fuer die heute benoetigten UI-Methoden                       | `apps/frontend/src/app/features/quiz/data/*`                                  |
| 3.2 | Lokale Fassade                | delegiert an `QuizStoreService`                                                            | `apps/frontend/src/app/features/quiz/data/local-quiz-workspace.facade.ts`     |
| 3.3 | Publisher-Fassade             | kombiniert `QuizStoreService` und `publisher.*`                                            | `apps/frontend/src/app/features/quiz/data/publisher-quiz-workspace.facade.ts` |
| 3.4 | Komponenten umstellen         | `quiz-list`, `quiz-new`, `quiz-edit`, `quiz-preview` injizieren Fassade statt Store direkt | bestehende Quiz-Komponenten                                                   |
| 3.5 | Routen kontextfaehig machen   | `QuizComponent` und Router-Links duerfen nicht hart auf `/quiz` verdrahtet bleiben         | `quiz.component.ts`, Listen-/Editor-Komponenten                               |

**Akzeptanz fuer Phase 3**

- dieselbe Komponente laeuft unter `/quiz/...` und `/publisher/quiz/...`
- lokale und Verlagsroute koennen parallel existieren
- keine Regression im lokalen Quizfluss

## Phase 4 - Redaktionsbearbeitung ueber die bestehende Quiz-UX (Story 11.2)

Ziel: neue, bestehende und importierte Verlagsquizze lassen sich in derselben UX erstellen und pflegen.

| #   | Task                            | Beschreibung                                                                               | Hauptorte                            |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| 4.1 | Remote-Quiz lokal hydratisieren | `publisher.getQuiz` -> `quizStore.importQuiz(payload, overrideId)`                         | `publisher-quiz-workspace.facade.ts` |
| 4.2 | Explizites Verlagsspeichern     | `quizStore.exportQuiz(quizId)` -> `publisher.saveQuiz`                                     | `quiz-preview`, `quiz-list`, Fassade |
| 4.3 | Import weiterverwenden          | bestehender JSON-/Kompatibilitaetsimport bleibt unveraendert; nur Ziel ist Verlagsspeicher | `quiz-list`, Fassade                 |
| 4.4 | Export weiterverwenden          | Einzelquiz-Export im selben Format                                                         | `quiz-list`, Fassade                 |
| 4.5 | Unsaved-State klar markieren    | lokal bearbeitet, aber noch nicht in Verlag gespeichert                                    | `quiz-preview`, `quiz-edit`, Fassade |

**Akzeptanz fuer Phase 4**

- Redakteur:innen koennen ein Quiz neu anlegen, importieren, bearbeiten und speichern
- Import und Export verhalten sich wie heute
- Editor bleibt lokal schnell, unabhaengig von Serverlatenz

## Phase 5 - Veroeffentlichung, Quizlink und Startschutz (Stories 11.3 und 11.4)

Ziel: pro gespeichertes Verlagsquiz existiert ein direkter Link mit optionalem Passwort-/Token-Schutz.

| #   | Task                         | Beschreibung                                                                               | Hauptorte                               |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| 5.1 | Public-Link-Felder           | `publicLinkSlug`, `launchAccessMode`, `launchSecretHash`                                   | `prisma/schema.prisma`                  |
| 5.2 | Quizlink bereitstellen       | Link nach Save/Create in Liste und Vorschau anzeigen                                       | `quiz-list`, `quiz-preview`, Fassade    |
| 5.3 | Oeffentliche Quiz-Metadaten  | Metadaten fuer Launch-Seite ohne Fragentext                                                | `apps/backend/src/routers/publisher.ts` |
| 5.4 | Startschutz pruefen          | Passwort/Token serverseitig validieren                                                     | `apps/backend/src/routers/publisher.ts` |
| 5.5 | Live-Session aus Verlagsquiz | gespeichertes Dokument in `QuizUploadInput` umwandeln und bestehenden Session-Start nutzen | Backend-Helper + Router                 |

**Akzeptanz fuer Phase 5**

- jedes gespeicherte Verlagsquiz hat einen stabilen Link
- der Link kann optional durch Passwort oder Token geschuetzt werden
- Session-Start nutzt weiterhin den bestehenden Live-Pfad

## Phase 6 - Account-Gesamtexport, Tests und Harter Rueckschnitt (Story 11.4)

Ziel: accountbezogener Export und saubere Absicherung gegen unbeabsichtigte Regressionen.

| #   | Task                       | Beschreibung                                               | Hauptorte                                     |
| --- | -------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| 6.1 | Gesamtexport               | alle Quizdokumente eines Accounts gesammelt exportieren    | `apps/backend/src/routers/publisher.ts`       |
| 6.2 | Frontend-Exportaktion      | klar sichtbarer Gesamtexport im Redaktionsbereich          | `quiz-list` oder kleiner Publisher-Header     |
| 6.3 | Router- und Auth-Tests     | Login, Guard, Tokenablauf, Accounttrennung                 | Backend + Frontend Specs                      |
| 6.4 | Workspace-Regressionstests | lokaler `/quiz`-Flow darf nicht brechen                    | bestehende Quiz-Specs plus neue Fassade-Specs |
| 6.5 | Dokumentation              | Backlog, Routenuebersicht, ggf. ADR fuer Workspace-Fassade | `Backlog.md`, `docs/*`                        |

**Akzeptanz fuer Phase 6**

- accountbezogener Gesamtexport funktioniert
- der normale Host-/Quiz-Flow zeigt keine funktionale Regression
- DoD aus dem Backlog bleibt fuer betroffene Stories eingehalten

---

## Empfohlene Datei- und Schnittstellenliste

### Backend

- `prisma/schema.prisma`
- `apps/backend/src/lib/publisherAuth.ts` (neu)
- `apps/backend/src/routers/publisher.ts` (neu)
- `apps/backend/src/trpc.ts`
- `apps/backend/src/router.ts` oder entsprechender AppRouter-Zusammenbau
- kleiner Provisioning-/Seed-Pfad fuer Accounts

### Frontend

- `apps/frontend/src/app/core/trpc.client.ts`
- `apps/frontend/src/app/app.routes.ts`
- `apps/frontend/src/app/features/publisher/publisher-login.component.ts` (neu)
- `apps/frontend/src/app/features/quiz/quiz.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-list/quiz-list.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-new/quiz-new.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-preview/quiz-preview.component.ts`
- `apps/frontend/src/app/features/quiz/data/quiz-workspace.facade.ts` (neu)
- `apps/frontend/src/app/features/quiz/data/local-quiz-workspace.facade.ts` (neu)
- `apps/frontend/src/app/features/quiz/data/publisher-quiz-workspace.facade.ts` (neu)

### Shared Types

- `libs/shared-types/src/schemas.ts`

---

## Risiken und Gegenmassnahmen

### Risiko 1 - Zu viel Logik direkt in den bestehenden Komponenten

**Gegenmassnahme:** Workspace-Unterschiede in die Fassade schieben, nicht in Templates verstreuen.

### Risiko 2 - Serverspeicher fuehlt sich traege an

**Gegenmassnahme:** Weiter lokal bearbeiten, serverseitig nur explizit speichern.

### Risiko 3 - Drift zwischen Frontend-Upload und serverseitigem Verlagsstart

**Gegenmassnahme:** gemeinsame Mapping-Funktion aus `QuizExport` nach `QuizUploadInput` extrahieren und nur einmal pflegen.

### Risiko 4 - Local-First-Flow wird versehentlich mitgezogen

**Gegenmassnahme:** `/quiz` ueber eigene lokale Fassade unveraendert halten; Publisher-Modus strikt ueber separates Routing und separaten Token-Kontext.

### Risiko 5 - Scope-Drift durch Excel, Medien, Mehrfachlinks oder Voll-Audit

**Gegenmassnahme:** v1 auf JSON-basierte Wiederverwendung begrenzen; Excel, Audio/Video-Ausbau und erweitertes Audit nur als explizite Folgeauftraege.

---

## Offene Produktentscheidungen vor der Umsetzung

1. **Login-Identifier:** Username-only oder E-Mail/Username.
2. **Account-Provisionierung:** manuell im Backend, Seed-Script oder kleines internes Admin-Tool.
3. **Startschutz:** genau ein statisches Passwort/Token pro Quiz oder spaeter mehrere gueltige Tokens.
4. **Quizlink:** ein stabiler Link pro Quiz oder versionierte Links pro Freigabe.
5. **Excel-Import/-Export:** Teil von v1 oder separate Angebotsposition.
6. **Audio/Video im Editor:** direkt im ersten Schritt oder bewusst ausserhalb von v1.

Empfehlung fuer v1:

- Username plus Passwort
- Provisioning ueber Seed-/Ops-Pfad
- ein stabiler Link pro Quiz
- ein statischer Passwort-/Token-Schutz pro Quiz
- JSON als Kernumfang, Excel separat
- Audio/Video nicht im Minimalumfang

---

## Umsetzungsempfehlung in einem Satz

**Redaktionszugaenge als separaten, serverseitig authentifizierten Workspace einfuehren, dabei den bestehenden Quiz-Editor, das bestehende Import-/Exportformat und den bestehenden Live-Start unveraendert wiederverwenden und nur ueber eine schmale Workspace-Fassade an den Verlagsspeicher anbinden.**
