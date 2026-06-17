# Routes & Stories – Vollständige Referenz

> **Konvention:** Alle Routen auf Englisch, kurz, prägnant. Die URL zeigt eindeutig **wo** man ist und **welche Rolle** (Host vs. Teilnehmende).
> **Architektur-Entscheidungen:** [ADR-0006: Rollen, Routen und Autorisierung (Host, Teilnehmer, Admin)](../architecture/decisions/0006-roles-routes-authorization-host-admin.md).
>
> **Wichtig:** Diese Datei beschreibt primär den **aktuellen Angular-Router und den Repo-Ist-Stand**. Die konkrete Härtung des Host- und Sammlungszugriffs ist zusätzlich in [ADR-0019](../architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md) beschrieben.

---

## 1. Rollen-Trennung in der URL

| Rolle             | Bedeutung              | URL-Segment(e)                                                  |
| ----------------- | ---------------------- | --------------------------------------------------------------- |
| **Host**          | Lehrperson (Steuerung) | `/session/:code/host`                                           |
| **Present**       | Beamer / Projektion    | `/session/:code/present`                                        |
| **Join**          | Teilnehmenden-Einstieg | `/join/:code`                                                   |
| **Vote**          | Teilnehmende aktiv     | `/session/:code/vote`                                           |
| **Feedback Host** | Blitzlicht-Steuerung   | `/feedback/:code`                                               |
| **Feedback Vote** | Blitzlicht-Abgabe      | `/feedback/:code/vote`                                          |
| **Admin**         | Admin/Betreiber        | `/admin` (Login; danach u. a. Sessions + **MOTD**-Tab, Epic 10) |

- **`/join/:code`** = Ziel des QR-Codes (Story 2.1b). Nach Nickname (oder anonym) → Redirect auf `/session/:code/vote`.
- **`/session/:code`** ohne Segment: Im aktuellen Router **rollenabhängiger Redirect**: mit Host-Token → `/session/:code/host`, sonst `/join/:code`.
- Locale-Präfixe wie `/de/...`, `/en/...` usw. werden über denselben Router aufgelöst; fachlich ist also z. B. `/de/session/ABC123/host` dieselbe Route wie `/session/ABC123/host`.

---

## 1.1 Host-Autorisierung: aktueller Repo-Stand

**Problem:** Wenn die URL `/session/:code/host` öffentlich ist, wie verhindern wir, dass sich jemand einfach dorthin navigiert und sich als Host ausgibt?

**Aktueller Stand:** Host-Rechte werden über ein **Host-Token** vergeben, nicht über die URL.

- **Wer ist Host?** Nur, wer `session.create` erfolgreich aufruft, erhält ein **Host-Token**.
- **Token-Speicherung:** Host-Tokens liegen pro Session-Code in `sessionStorage`; Standalone-Blitzlicht nutzt separat gespeicherte Feedback-Host-Tokens.
- **Host-Route aufrufen:** `/session/:code/host` und `/session/:code/present` sind clientseitig tokengebunden; ohne Token Redirect auf `/join/:code` oder Zugriff verweigert.
- **Backend-Schutz:** Zentrale Session-Steuerung, Export, Bonus-Liste, Q&A-Moderation und session-gebundenes Blitzlicht laufen serverseitig über `hostProcedure` bzw. rollenbezogene Token-Prüfung. Fuer Q&A gilt das auch auf Lesepfaden: `qa.list` und `qa.onQuestionsUpdated` mit `moderatorView: true` verlangen serverseitig gueltige Host-Authentifizierung.
- **Fazit:** Die **URL-Struktur** trennt Ansichten, die **Rechte** kommen aus Token-Prüfung und nicht aus der Route.

Zusätzliche Details und die besitzgebundene Absicherung der Quiz-Sammlung stehen in [ADR-0019](../architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md).

## 1.1a Quiz-Sammlung: besitzgebundene Historie statt öffentlicher `quizId`

Für die Quiz-Liste gilt zusätzlich:

- `lastServerQuizId` allein reicht **nicht** mehr als Leseschlüssel für Sammlungs-Historie.
- Historienzugriffe wie `Bonus-Codes`, `letztes Session-Feedback` und `aktive Live-Markierung` nutzen einen **`accessProof`** zur hochgeladenen Quizkopie.
- Der Proof wird lokal zusammen mit `lastServerQuizId` gespeichert und serverseitig gegen die gespeicherte Quiz-Kopie geprüft.

---

## 1.2 Admin-Autorisierung: Niemand wird „per URL“ zum Admin

**Problem:** Wie verhindern wir, dass sich jemand über die URL `/admin` Admin-Rechte verschafft?

**Lösung: Admin-Authentifizierung (Credentials), nicht die URL.**

| Aspekt                                       | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wer ist Admin?**                           | Nur Nutzer mit gültiger **Admin-Authentifizierung** (z. B. Admin-Token/API-Key aus Umgebung, oder separates Admin-Login mit Passwort/SSO). Kein Account für normale Nutzer nötig — Admin ist eine **Betreiber-Rolle** (Plattform, Support, rechtliche Verantwortung).                                                                                                                                                                       |
| **Route `/admin`**                           | Aufruf von `/admin` ohne gültige Admin-Credentials → aktuelle UI zeigt auf derselben Route die Login-Maske. Alle Admin-tRPC-Prozeduren (`admin.listSessions`, `admin.deleteSession`, `admin.exportForAuthorities` o. ä.) prüfen serverseitig die Admin-Berechtigung; bei Fehlen → `UNAUTHORIZED`.                                                                                                                                           |
| **Einsatz:**                                 | Sessions und Quiz-Inhalte anderer (anonym erstellter Hosts) inspizieren, bei rechtlichen Gründen löschen (Story 9.2), Auszug für Behörden/Staatsanwaltschaft exportieren (Story 9.3). Audit-Log für Lösch- und Export-Aktionen.                                                                                                                                                                                                             |
| **Wie bekommt der Admin seine Credentials?** | Vom **Betreiber** der Plattform (out-of-band). Technisch: geheimer Admin-Schlüssel in der Server-Umgebung (z. B. `ADMIN_SECRET`); Betreiber teilt ihn nur berechtigten Admins mit. Admin gibt den Schlüssel auf der Login-Seite unter `/admin` ein; Backend vergleicht und vergibt ein Session-Token. Keine Selbstregistrierung, keine Admin-Benutzerdatenbank im aktuellen Modell. Details: Backlog Epic 9, Abschnitt „Admin-Credentials“. |

**Ergebnis:** Die URL `/admin` kennzeichnet nur die **Admin-Ansicht**. Ob der Nutzer berechtigt ist, entscheidet die **Admin-Authentifizierung** (Token/Login), nicht die URL. Passt zur bestehenden Architektur: Host = Token bei Session-Erstellung; Admin = separates, betreiberseitiges Credential.

Technische Ablauf- und Betriebsdetails (Login, Token, Delete/Export, Troubleshooting):  
[`docs/implementation/ADMIN-FLOW.md`](./implementation/ADMIN-FLOW.md)

### Absicherung der Admin-Route (technisch)

| Ebene                | Maßnahme                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend (Route)** | Im aktuellen Repo gibt es **keinen separaten Angular-Route-Guard** für `/admin`. Stattdessen entscheidet die `AdminComponent` selbst: **ohne Token** nur Login-Maske auf derselben Route, **mit Token** Dashboard/Listen/Detail.                                                                                                                                                                                                                                                                                                                                               |
| **Frontend (API)**   | Jeder tRPC-Aufruf in den Admin-Prozeduren sendet das Admin-Session-Token mit (z. B. im Request-Header `Authorization: Bearer <token>` oder in einem kontextspezifischen Header). Der Auth-Service liest das Token aus dem Speicher und hängt es bei Aufrufen an den `admin.*`-Router an.                                                                                                                                                                                                                                                                                       |
| **Backend**          | **Jede** Admin-Prozedur (`admin.listSessions`, `admin.getSessionByCode`, `admin.deleteSession`, `admin.exportForAuthorities` usw.) prüft zuerst die Admin-Berechtigung: Token aus Header/Context lesen, Gültigkeit prüfen (Signatur bei JWT, oder Lookup in Redis bei opakem Token). Ungültig oder fehlend → sofort `UNAUTHORIZED` (z. B. tRPC `TRPCError` mit Code `UNAUTHORIZED`), keine Daten zurückgeben. Eine gemeinsame **adminProcedure** (Middleware) im tRPC-Router kann diese Prüfung zentral durchführen, sodass keine einzelne Procedure vergisst, sie anzuwenden. |
| **Zusammenfassung**  | Die Admin-Route ist praktisch **zweifach** abgesichert: (1) die Komponente zeigt ohne Token nur die Login-UI; (2) das Backend prüft bei jedem Admin-API-Zugriff das Token und lehnt unbefugte Anfragen ab. Ohne gültiges Token bringt weder der Aufruf von `/admin` noch das direkte Aufrufen einer Admin-API Zugriff auf Admin-Daten.                                                                                                                                                                                                                                         |

**Was ruft der Admin auf? Kann jede Person `/admin` aufrufen?**

- **Ja**, der Admin ruft **`/admin`** auf (das ist die Admin-URL).
- **Ja**, jede:r kann **`/admin`** im Browser öffnen — die URL ist nicht geheim. Das ist bewusst so (keine Sicherheit durch Verstecken der URL).
- **Aber:** Wer `/admin` **ohne** gültigen Admin-Login aufruft, sieht **nur die Login-Seite** (Eingabe des Admin-Schlüssels). Das **Dashboard** (Session-Liste, Code-Eingabe, Löschen, Export) wird **nicht** angezeigt und ist **nicht** erreichbar, weil die Komponente ohne Token nur die Login-Maske rendert. Nach erfolgreichem Login (gültiges Token) zeigt dieselbe URL `/admin` dann das geschützte Admin-Panel.
- **Fazit:** Jeder kann die **Adresse** `/admin` aufrufen; der **Inhalt** (Admin-Funktionen und -Daten) ist nur nach Login sichtbar und die API nur mit gültigem Token nutzbar.

---

## 2. Vollständige Routen-Liste (englisch, kurz)

| #   | Route                    | Rolle        | Kurzbeschreibung                                                                                                                                                           |
| --- | ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                      | alle         | Home: Session-Code, Preset-Toast, „Quiz starten“, Tempo-Feedback, Server-Status                                                                                            |
| 2   | `/join/:code`            | Teilnehmende | Einstieg (QR/Link): Session-Info, Nickname (oder anonym), dann → vote                                                                                                      |
| 3   | `/quiz`                  | Host         | Quiz-Liste, Kontextmenü, „Quiz erstellen“                                                                                                                                  |
| 4   | `/quiz/new`              | Host         | Neues Quiz anlegen                                                                                                                                                         |
| 5   | `/quiz/:id`              | Host         | Quiz bearbeiten (Fragen, Antworten, Konfiguration, Presets)                                                                                                                |
| 6   | `/quiz/:id/preview`      | Host         | Quiz-Preview, Inline-Schnellkorrektur, Hotkeys                                                                                                                             |
| 7   | `/quiz/sync/:docId`      | Host         | Quiz per Sync-Link auf anderem Gerät öffnen (Yjs)                                                                                                                          |
| 8   | `/session/:code/host`    | Host         | Lobby + Präsentations-Steuerung, Bonus-Liste, Export, Q&A-Moderation                                                                                                       |
| 9   | `/session/:code/present` | Host         | Beamer: Lobby, Lesephase, Frage, Countdown, Ergebnisse, Leaderboard, Word-Cloud, Effekte                                                                                   |
| 10  | `/session/:code/vote`    | Teilnehmende | Lobby/Warten, Fragen, Abstimmung, Scorecard, Bonus-Code, Q&A einreichen/upvoten                                                                                            |
| 11  | `/feedback/:code`        | Host         | Blitzlicht/Quick-Feedback hosten: Runde starten, Tempo-Feedback nutzen, Typ wechseln, sperren, zurücksetzen, Vergleichsrunde                                               |
| 12  | `/feedback/:code/vote`   | Teilnehmende | Blitzlicht/Quick-Feedback abstimmen, bei Tempo-Feedback aktuelle Rückmeldung setzen, wechseln oder entfernen                                                               |
| 13  | `/admin`                 | Admin        | Code-Eingabe (6-stellig) zum direkten Abruf von Session/Quiz; Session-Liste, Session-Detail (Quiz-Inhalt), Löschen (rechtlich), Auszug für Behörden; zusätzlicher MOTD-Tab |
| 14  | `/help`                  | alle         | Hilfe                                                                                                                                                                      |
| 15  | `/news-archive`          | alle         | Archiv der Startseiten-Meldungen (MOTD), prerenderbar                                                                                                                      |
| 16  | `/legal/imprint`         | alle         | Impressum                                                                                                                                                                  |
| 17  | `/legal/privacy`         | alle         | Datenschutz                                                                                                                                                                |

---

## 3. Tabelle: Route ↔ Stories (inkl. Epic 9 Admin)

Jede Zeile = eine Route; Spalte „Stories“ = alle Backlog-Story-IDs, die diese Route betreffen (inkl. Sub-Stories wie 1.2a, 2.1b, 3.5a, …).

| Route                        | Wer (Rolle)   | Stories (vollständig)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/`**                      | alle          | **0.4** (Server-Status), **1.11** (Presets), **1.15** (Preset-Export/Import), **3.1** (Code-Eingabe → Weiterleitung), **6.1** (Theme), **6.2** (i18n), **6.4**, **6.5**, **8.8** (Tempo-Feedback-Spotlight)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **`/join/:code`**            | Teilnehmende  | **2.1b** (QR-Code Ziel-URL `{baseUrl}/join/{sessionCode}`), **3.1** (Beitreten, Weiterleitung zur Lobby), **3.2** (Nicknames), **3.6** (anonym: kein Nickname-Schritt), **7.1** (Team-Zuweisung beim Beitreten)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **`/quiz`**                  | Host          | **1.1** (Quiz erstellen, Liste), **1.8** (Export-Button), **1.9** (Import-Button), **1.10** (Bearbeiten, Duplizieren, Löschen in Liste), **6.4**, **6.5**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **`/quiz/new`**              | Host          | **1.1** (Neues Quiz anlegen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **`/quiz/:id`**              | Host          | **1.2a** (MC/SC), **1.2b** (Freitext, Umfrage), **1.2c** (Rating), **1.2d** (numerische Schätzfrage: Referenzwert, Toleranz-/Plausibilitätsband, zwei Runden), **1.3** (Antworten & Lösungen), **1.4** (Sitzungs-Konfiguration), **1.7** (Markdown & KaTeX), **1.10** (Bearbeiten), **1.11** (Presets, Optionen), **1.12** (SC-Schnellformate), **1.6a** („Auf anderem Gerät öffnen“, Sync-Link/Code), **6.4**, **6.5**                                                                                                                                                                                                                                                                            |
| **`/quiz/:id/preview`**      | Host          | **1.13** (Quiz-Preview, Hotkeys, Inline-Schnellkorrektur, Validierung), **1.7** (Markdown/KaTeX in Preview)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **`/quiz/sync/:docId`**      | Host          | **1.6** (Yjs Multi-Device-Sync), **1.6a** (Sync-Link/Code öffnen), **1.6b** (Preset/Optionen beim Sync)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`/session/:code/host`**    | Host          | **2.1a** (Session erstellen, Quiz-Upload → hier landen), **2.2** (Lobby-Ansicht), **2.3** (Präsentations-Steuerung), **2.4** (Data-Stripping Backend), **1.2d** (Schätzfrage: Fortschritt ohne Verteilung, Runde 2, Histogramm/Statistik nach Freigabe), **4.2** (Session beenden, Cleanup), **4.6** (Bonus-Code-Liste, Export), **4.7** (Ergebnis-Export), **4.8** (Session-Bewertung: Auswertung sichtbar), **5.3** (Hintergrundmusik-Steuerung), **7.1** (Team-Modus Konfiguration), **8.1** (Q&A-Session), **8.4** (Q&A-Moderation), **6.4**, **6.5**                                                                                                                                          |
| **`/session/:code/present`** | Host (Beamer) | **2.1b** (QR-Code Anzeige), **2.5** (Beamer-Ansicht), **2.6** (Lesephase, zwei Phasen), **1.2d** (Schätzfrage: beamer-taugliches Histogramm, Referenzlinie, Toleranzband, Statistik), **3.5** (Countdown), **3.5a** (Finger-Countdown), **4.1** (Leaderboard), **4.4** (Ergebnis-Visualisierung), **4.5** (Freitext/Word-Cloud), **4.8** (Session-Bewertung anzeigen), **5.3** (Hintergrundmusik), **5.4** (Belohnungseffekte), **5.8** (Emoji-Reaktionen), **1.14** (Word-Cloud interaktiv + Export), **7.1** (Team-Leaderboard), **8.2**, **8.3** (Q&A-Fragen, Upvotes), **6.4**, **6.5**                                                                                                        |
| **`/session/:code/vote`**    | Teilnehmende  | **3.1** (nach Join → Lobby/Warten), **3.2** (Nickname bereits auf join), **3.3a** (Frage empfangen), **3.3b** (Abstimmung), **1.2d** (Schätzfrage: Zahleninput, rundenbezogene Abgabe, Ergebnis mit Referenz/Abstand/Punkten), **3.4** (Echtzeit-Feedback), **3.5** (Countdown), **3.5a** (Finger-Countdown), **3.6** (anonym), **4.1** (Leaderboard Rang auf Scorecard), **4.4** (Ergebnis-Anzeige), **4.6** (Bonus-Code Anzeige), **4.8** (Session-Bewertung abgeben), **5.4** (Belohnungseffekte), **5.5** (Answer Streak), **5.6** (Scorecard), **5.7** (Motivationsmeldungen), **5.8** (Emoji-Bar), **7.1** (Team-Anzeige), **8.2** (Fragen einreichen), **8.3** (Upvoting), **6.4**, **6.5** |
| **`/feedback/:code`**        | Host          | **0.3** (Blitzlicht/Quick-Feedback Infrastruktur), **2.8** (produktives Smartphone-Hosting für Live-Sessions), **8.8** (Tempo-Feedback als QuickFeedback-Template), bestehende Blitzlicht-/Vergleichsrunden-Flows aus dem Feedback-Kanal                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`/feedback/:code/vote`**   | Teilnehmende  | Blitzlicht-/Quick-Feedback-Abgabe im Feedback-Kanal inkl. **8.8** (Tempo-Rückmeldung setzen, wechseln oder entfernen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **`/admin`**                 | Admin         | **9.1** (Sessions & Quiz inspizieren), **9.2** (Session/Quiz löschen, Audit-Log), **9.3** (Auszug für Behörden/Staatsanwaltschaft), **10.3**, **10.4** (MOTD-Admin)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`/help`**                  | alle          | **6.2** (i18n), **6.4**, **6.5**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **`/news-archive`**          | alle          | **10.7** (MOTD-Archiv / Header-Icon / Lazy Load)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **`/legal/imprint`**         | alle          | **6.3** (Impressum, explizit im Backlog)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`/legal/privacy`**         | alle          | **6.3** (Datenschutz, explizit im Backlog)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 4. Stories ohne eigene Route (nur Verhalten/Backend/global)

Diese Stories bestimmen **keine** neue Page/URL, sondern Logik, Backend, globale UI oder Verhalten auf bestehenden Routen:

| Story   | Inhalt                                                      | Wo umgesetzt                           |
| ------- | ----------------------------------------------------------- | -------------------------------------- |
| 0.1–0.6 | Infrastruktur (Redis, tRPC WS, Yjs, Status, Rate-Limit, CI) | Backend / Home (0.4 Widget)            |
| 1.5     | Local-First Speicherung                                     | Quiz-Editor, IndexedDB/Yjs             |
| 1.6     | Yjs Multi-Device-Sync                                       | Backend + Quiz-Editor/Sync-Route       |
| 2.4     | Security / Data-Stripping                                   | Backend DTOs                           |
| 4.2     | Server aufräumen                                            | Backend (session.end)                  |
| 4.3     | WebSocket Reconnection                                      | Frontend (alle Session-Routen)         |
| 5.1     | Sound-Effekte                                               | Host + Present + Vote (konfigurierbar) |
| 6.1     | Dark/Light/System-Theme                                     | Global (Toolbar/Header)                |
| 6.2     | Internationalisierung                                       | Global + alle Routen                   |
| 6.4     | Mobile-First                                                | Alle Routen                            |
| 6.5     | Barrierefreiheit                                            | Alle Routen                            |

---

## 5. Kurz: Erreichbarkeit und Erkennbarkeit an der URL

- **Wo bin ich?** `/` = Home, `/quiz` = Quiz-Bereich, `/session/:code/...` = konkrete Session, `/feedback/:code...` = Blitzlicht, `/help`, `/news-archive`, `/legal/...`
- **Wer bin ich?** `host` = Host-Steuerung, `present` = Beamer, `vote` = Teilnehmende aktiv, `join` = Teilnehmenden-Einstieg
- **Klare Trennung Host vs. Teilnehmende?** Ja: `host`/`present` gegenüber `join`/`vote` auf URL-Ebene, plus tokenbasierte serverseitige Prüfung für Host-only-Aktionen.
- **Kann sich jemand per URL zum Host machen?** Nein. Die Route allein reicht nicht; es braucht ein gültiges Host-Token bzw. im Standalone-Blitzlicht ein gültiges Feedback-Host-Token.
- **Kann sich jemand per URL zum Admin machen?** Nein. Admin-Rechte hängen an **Admin-Authentifizierung** (Token/API-Key oder Admin-Login). Ohne gültige Credentials: `/admin` zeigt Login oder „Zugriff verweigert“, Backend lehnt alle Admin-Prozeduren ab. Siehe Abschnitt 1.2.
- **Routen englisch & prägnant?** Ja: home, join, quiz, new, preview, sync, host, present, vote, help, legal, imprint, privacy.
- **Backlog-Vorgaben erfüllt?** QR = `/join/:code` (2.1b), Beamer = `/session/:code/present` (2.5), Legal = `/legal/imprint`, `/legal/privacy` (6.3), News-Archiv = `/news-archive` (Epic 10).

---

## 6. Sub-Routes (Child Routes) – Empfehlung

- **`/quiz`**: Child Routes `''` (Liste), `new`, `:id`, `:id/preview`, `sync/:docId` (oder `sync/:docId` als Sibling).
- **`/session/:code`**: Child Routes `host`, `present`, `vote`; aktueller Default-Pfad `''` entscheidet tokenabhängig zwischen `host` und `join`.
- **`/admin`**: Im aktuellen Repo eine einzelne SPA-Ansicht mit Login, Liste, Detail und MOTD-Tab; Zugriff komponentenintern und über `adminProcedure` abgesichert.
- **`/legal`**: Child Routes `imprint`, `privacy` (oder weiterhin `:slug` mit erlaubten Werten).

Damit sind alle Stories abgedeckt, die eine Page/Route brauchen; die restlichen sind Verhalten auf diesen Routen oder Backend/Global.
