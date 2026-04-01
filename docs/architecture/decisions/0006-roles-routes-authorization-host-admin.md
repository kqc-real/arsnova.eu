<!-- markdownlint-disable MD013 -->

# ADR-0006: Rollen, Routen und Autorisierung (Host, Teilnehmer, Admin)

**Status:** Accepted  
**Datum:** 2026-03-04  
**Entscheider:** Projektteam

## Kontext

Die App ist für Lehrende und Teilnehmende **accountfrei**; Sessions und Quiz-Daten werden über Codes und Tokens gesteuert. Es braucht klare Regeln:

1. **Rollen in der URL:** Wer ist wo? Ohne klare Trennung könnte jemand durch bloßes Aufrufen einer URL (z. B. `/session/ABC123/host`) Host-Rechte erlangen.
2. **Admin-Rolle:** Für rechtliche und operative Kontrolle (Inspektion, Löschen, Auszug für Behörden) wird eine **Admin-Rolle** benötigt – ohne Einführung von Nutzerkonten für normale Nutzende.
3. **Einheitliche Routen:** Alle Routen sollen englisch, kurz und prägnant sein; an der URL soll erkennbar sein, wo man ist und welche Rolle man hat.

## Implementierungsstatus im Repo (Stand 2026-04-01)

- **Routenstruktur:** `host`, `present`, `vote`, `join`, `admin`, `help`, `news-archive`, `legal/*` sind im Angular-Router vorhanden.
- **Admin-Modell:** Das Admin-Secret mit opakem Session-Token in Redis und zentraler `adminProcedure` ist umgesetzt.
- **Host-Modell:** Das in dieser ADR beschriebene **Host-Token-Zielbild** ist im aktuellen Backend noch **nicht** vollständig umgesetzt; zentrale Session-Steuerung läuft derzeit noch nicht über eine eigene `hostProcedure`.
- **`/session/:code` ohne Segment:** Der aktuelle Router leitet schlicht auf `host` um; der in dieser ADR beschriebene kontextabhängige Redirect ist noch kein Ist-Stand.
- **Moderator-Route:** Als Zielbild beschrieben, aber im aktuellen Frontend-Router noch nicht als eigene Route vorhanden.

## Entscheidung

### 1. Rollen und Routen (URL-Struktur)

| Rolle         | URL-Segment(e)            | Bedeutung                                                                                            |
| ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Host**      | `/session/:code/host`     | Lehrperson: Steuerung, Lobby                                                                         |
| **Present**   | `/session/:code/present`  | Lehrperson: Beamer/Projektion                                                                        |
| **Moderator** | `/session/:code/moderate` | Delegierte Live-Moderation mit eingeschränkten Rechten (Zielbild; aktuell nicht als Route umgesetzt) |
| **Join**      | `/join/:code`             | Teilnehmende: Einstieg (QR-Ziel), Nickname, dann Redirect auf Vote                                   |
| **Vote**      | `/session/:code/vote`     | Teilnehmende: Abstimmung, Scorecard                                                                  |
| **Admin**     | `/admin`                  | Admin: Dashboard, Session-Code-Eingabe, Liste, Detail, Löschen, Export                               |

- **`/session/:code`** ohne Segment: Redirect auf `.../host` (wenn Host-Token) oder `/join/:code` (wenn unklar), damit keine mehrdeutige URL bleibt.
- QR-Code (Story 2.1b) verweist auf **`/join/:code`**.
- Vollständige Routen- und Story-Referenz: [docs/ROUTES_AND_STORIES.md](../../ROUTES_AND_STORIES.md).

### 2. Host-Autorisierung (kein „Host werden“ per URL)

- **Host-Rechte** hängen nicht an der URL, sondern am **Host-Token**.
- Das Token wird **einmalig** bei `session.create` vom Backend erzeugt und in der Response zurückgegeben; das Frontend speichert es in **sessionStorage** (z. B. `arsnova_host_${sessionCode}`).
- **Jede Host-only-Prozedur** (nextQuestion, revealResults, end, getBonusTokens, getExportData usw.) erwartet das Host-Token (Header oder Input); das Backend prüft gegen einen gespeicherten Hash (z. B. Redis `host:${sessionId}`). Ungültig/fehlend → `UNAUTHORIZED`.
- Aufruf von `/session/:code/host` oder `.../present` **ohne** gültiges Token → Frontend zeigt „Zugriff verweigert“ oder Redirect; Backend liefert bei Host-API-Aufrufen ohne Token keine Daten.

### 2a. Delegierte Live-Rollen bauen auf dieser Basis auf

Zusätzliche delegierte Rollen wie **Presenter** und **Moderator** bauen auf derselben Grundregel auf:

- Rechte werden **nie** durch die URL oder durch den Session-Code verliehen.
- Zusätzliche Live-Rollen benötigen eigene Tokens und serverseitige Prüfpfade.
- Die konkrete Ausgestaltung der delegierten Moderatorrolle ist in **ADR-0011** festgelegt.

### 3. Admin-Rolle und -Credentials

- **Admin** ist eine **Betreiber-Rolle** (Plattform, Support, rechtliche Verantwortung). Keine Selbstregistrierung.
- **Credentials:** Ein **geheimer Admin-Schlüssel** wird in der **Server-Umgebung** konfiguriert (`ADMIN_SECRET`). Der **Betreiber** teilt ihn **out-of-band** nur berechtigten Admins mit.
- **Login:** Beim Aufruf von `/admin` erscheint eine **Login-Seite**. Der Admin gibt den Schlüssel ein; Backend vergleicht mit dem konfigurierten Wert und vergibt bei Übereinstimmung ein **opakes Session-Token in Redis mit TTL**. Das Frontend speichert es in `sessionStorage` und sendet es bei jedem Admin-tRPC-Aufruf mit. Keine Admin-Benutzerdatenbank im MVP.

### 4. Absicherung der Admin-Route

- **URL `/admin`:** Jede:r kann `/admin` im Browser **aufrufen** (die URL ist nicht geheim). **Ohne** gültiges Admin-Session-Token wird **nur die Login-Maske** angezeigt – kein Dashboard, keine Session-Daten.
- **Frontend:** Route Guard **oder** komponenteninterne Prüfung: Ohne Token nur Login-UI auf derselben Route; mit gültigem Token wird das Admin-Dashboard (Session-Liste, Code-Eingabe, Detail, Löschen, Export) gerendert. Jeder Admin-tRPC-Aufruf sendet das Token mit (z. B. Header `Authorization: Bearer <token>` oder `x-admin-token`).
- **Backend:** **Jede** Admin-Prozedur prüft das Token (z. B. zentrale **adminProcedure**-Middleware); ungültig/fehlend → `UNAUTHORIZED`. Sicherheit liegt auf Token-Prüfung, nicht auf Geheimhaltung der URL.

### 5. Admin: Session-Lookup per Code

- Im Admin-Dashboard gibt es eine **Eingabe für den 6-stelligen Session-Code**. Der Admin kann damit direkt die zugehörigen Session- und Quiz-Daten abrufen (z. B. tRPC `admin.getSessionByCode({ code })`). Bei gültigem Code → Session-Detail inkl. Quiz-Inhalt; bei ungültigem Code → klare Fehlermeldung.

### 6. Admin: Audit

- Admin-Aktionen (Löschen, ggf. Export) werden in einem **Audit-Log** protokolliert (wer, wann, welche Session, optional Grund), Aufbewahrung gemäß rechtlichen Anforderungen (Backlog Epic 9, Story 9.2).

## Konsequenzen

### Positiv

- Klare Trennung der Rollen in der URL; keine Rechtevergabe durch bloßes Aufrufen einer Adresse.
- Admin-Zugriff ist tokenbasiert und serverseitig prüfbar; für den Host gilt dies als Zielbild derselben Architektur.
- Presenter- und Moderator-Delegation werden möglich, ohne Vollzugriff auf die Session preiszugeben.
- Admin-Rolle passt zur accountfreien Architektur: ein gemeinsamer Schlüssel in der Server-Config, keine Nutzerdatenbank für Admins.
- Einheitliche, englische und kurze Routen; gute Orientierung für Entwicklung und Nutzung.

### Negativ / Risiken

- Host-Token in sessionStorage: Verlust bei Löschen der Browser-Daten; Session lässt sich dann von diesem Gerät nicht mehr als Host steuern (bewusst akzeptiert).
- Mehrere Token-Klassen erhöhen die Komplexität in Routing, UI und Procedure-Schutz.
- Gemeinsamer Admin-Schlüssel: Keine feingranulare Zuordnung „wer hat was getan“ im Audit ohne spätere Erweiterung (z. B. Admin-Tabelle mit Kennung).

## Alternativen (geprüft)

- **Rolle nur per URL „verstecken“:** Sicherheit durch Unkenntnis der Admin-URL – abgelehnt; Sicherheit soll auf Credentials/Token beruhen, nicht auf Geheimhaltung der Route.
- **Account-basierte Admin-Anmeldung:** Würde eine Nutzerverwaltung für Admins erfordern; für MVP bewusst vermieden zugunsten eines einzelnen konfigurierbaren Admin-Secrets.
- **Host-Rechte über Session-Code:** Wer den 6-stelligen Code kennt, könnte Host sein – abgelehnt, da Teilnehmende den Code ebenfalls kennen; Host-Token bleibt exklusiv bei Session-Erstellung.

---

**Referenzen:** Backlog Epic 9 (Admin), [docs/ROUTES_AND_STORIES.md](../../ROUTES_AND_STORIES.md) (Routen, Host-/Admin-Autorisierung, Absicherung), [ADR-0011: Delegierbare Moderatorrolle für Live-Sessions](./0011-delegated-moderator-role-for-live-sessions.md).
