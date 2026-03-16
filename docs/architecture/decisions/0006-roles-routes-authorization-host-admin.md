<!-- markdownlint-disable MD013 -->

# ADR-0006: Rollen, Routen und Autorisierung (Host, Teilnehmer, Admin)

**Status:** Accepted  
**Datum:** 2026-03-04  
**Entscheider:** Projektteam  

## Kontext

Die App ist für Dozenten und Teilnehmer **accountfrei**; Sessions und Quiz-Daten werden über Codes und Tokens gesteuert. Es braucht klare Regeln:

1. **Rollen in der URL:** Wer ist wo? Ohne klare Trennung könnte jemand durch bloßes Aufrufen einer URL (z. B. `/session/ABC123/host`) Host-Rechte erlangen.
2. **Admin-Rolle:** Für rechtliche und operative Kontrolle (Inspektion, Löschen, Auszug für Behörden) wird eine **Admin-Rolle** benötigt – ohne Einführung von Nutzerkonten für normale User.
3. **Einheitliche Routen:** Alle Routen sollen englisch, kurz und prägnant sein; an der URL soll erkennbar sein, wo man ist und welche Rolle man hat.

## Entscheidung

### 1. Rollen und Routen (URL-Struktur)

| Rolle | URL-Segment(e) | Bedeutung |
| --- | --- | --- |
| **Host** | `/session/:code/host` | Dozent: Steuerung, Lobby |
| **Present** | `/session/:code/present` | Dozent: Beamer/Projektion |
| **Join** | `/join/:code` | Teilnehmer: Einstieg (QR-Ziel), Nickname, dann Redirect auf Vote |
| **Vote** | `/session/:code/vote` | Teilnehmer: Abstimmung, Scorecard |
| **Admin** | `/admin` | Admin: Dashboard, Session-Code-Eingabe, Liste, Detail, Löschen, Export |

- **`/session/:code`** ohne Segment: Redirect auf `.../host` (wenn Host-Token) oder `/join/:code` (wenn unklar), damit keine mehrdeutige URL bleibt.
- QR-Code (Story 2.1b) verweist auf **`/join/:code`**.
- Vollständige Routen- und Story-Referenz: [docs/ROUTES_AND_STORIES.md](../../ROUTES_AND_STORIES.md).

### 2. Host-Autorisierung (kein „Host werden“ per URL)

- **Host-Rechte** hängen nicht an der URL, sondern am **Host-Token**.
- Das Token wird **einmalig** bei `session.create` vom Backend erzeugt und in der Response zurückgegeben; das Frontend speichert es in **sessionStorage** (z. B. `arsnova_host_${sessionCode}`).
- **Jede Host-only-Prozedur** (nextQuestion, revealResults, end, getBonusTokens, getExportData usw.) erwartet das Host-Token (Header oder Input); das Backend prüft gegen einen gespeicherten Hash (z. B. Redis `host:${sessionId}`). Ungültig/fehlend → `UNAUTHORIZED`.
- Aufruf von `/session/:code/host` oder `.../present` **ohne** gültiges Token → Frontend zeigt „Zugriff verweigert“ oder Redirect; Backend liefert bei Host-API-Aufrufen ohne Token keine Daten.

### 2a. Delegation: Presenter- und Moderator-Zugang

Für den Live-Betrieb braucht arsnova.eu nicht nur den primären Host, sondern auch **sicher delegierbare Zweitzugänge**:

- **Presenter-Token:** read-only Zugriff auf `/session/:code/present`. Darf Live-Inhalte anzeigen, aber **keine** Session steuern.
- **Moderator-Token:** kanalgebundener Zugriff für Q&A-Moderation. Darf Fragen sichten/freigeben/pinnen/archivieren, aber **keine** Quiz-Steuerung, kein Session-Ende und keine anderen Host-Aktionen auslösen.
- **Host-Token:** bleibt der einzige Vollzugriff auf Session-Steuerung und kanalübergreifende Moderation.

Zielbild:

1. Dozent startet die Veranstaltung mit **Host-Token**.
2. Beamer/Laptop/zweites Gerät kann über einen **Presenter-Link** dieselbe laufende Session anzeigen.
3. Tutor:in kann über einen **Moderator-Link** parallel nur die Q&A-Moderation übernehmen.
4. Der **6-stellige Session-Code** bleibt ausschließlich Teilnehmer-Zugang und darf niemals Host-, Presenter- oder Moderatorrechte verleihen.

### 2b. Token-Modell für Live-Sessions

Für Live-Sessions gelten drei getrennte Token-Klassen:

- **Host-Token:** Vollzugriff auf Host- und Presenter-Route sowie alle Host-Mutationen.
- **Presenter-Token:** Lesender Zugriff auf Presenter-Daten und Presenter-Route.
- **Moderator-Token:** Zugriff auf moderatorbezogene Q&A-Prozeduren und optional auf eine reduzierte Moderator-UI.

Technische Leitplanken:

- Tokens werden serverseitig erzeugt, nur als **Hash** gespeichert und an die Session gebunden.
- Tokens haben mindestens eine **TTL für die Laufzeit der Session**.
- Tokens sind **widerrufbar/rotierbar** (mindestens Host und Moderator; Presenter nachrangig, aber wünschenswert).
- Jede geschützte tRPC-Prozedur nutzt eine passende Procedure-Middleware (`hostProcedure`, `presenterProcedure`, `moderatorProcedure` oder äquivalent).

### 2c. Umsetzungsstand und aktuelle Lücke

Stand 2026-03 besteht hier noch eine relevante Sicherheitslücke:

- Der aktuelle Laufzeitstand entspricht dem Zielbild aus diesem ADR noch nicht vollständig.
- Insbesondere dürfen **Session-Code** oder bloßes Aufrufen von `/session/:code/host` nicht als ausreichender Nachweis für Host- oder Moderationsrechte akzeptiert werden.
- Die Schließung dieser Lücke ist ein **konkretes Security-Härtungspaket** und muss im Backlog als eigene Weiterentwicklung sichtbar sein.

### 3. Admin-Rolle und -Credentials

- **Admin** ist eine **Betreiber-Rolle** (Plattform, Support, rechtliche Verantwortung). Keine Selbstregistrierung.
- **Credentials:** Ein **geheimer Admin-Schlüssel** (z. B. Passphrase/API-Key) wird in der **Server-Umgebung** konfiguriert (`ADMIN_SECRET` o. ä.). Der **Betreiber** teilt ihn **out-of-band** nur berechtigten Admins mit.
- **Login:** Beim Aufruf von `/admin` erscheint eine **Login-Seite**. Der Admin gibt den Schlüssel ein; Backend vergleicht mit dem konfigurierten Wert und vergibt bei Übereinstimmung ein **Session-Token** (z. B. JWT oder opaker Token in Redis mit TTL). Das Frontend speichert es (z. B. sessionStorage) und sendet es bei jedem Admin-tRPC-Aufruf mit. Keine Admin-Benutzerdatenbank im MVP.

### 4. Absicherung der Admin-Route

- **URL `/admin`:** Jede:r kann `/admin` im Browser **aufrufen** (die URL ist nicht geheim). **Ohne** gültiges Admin-Session-Token wird **nur die Login-Maske** angezeigt – kein Dashboard, keine Session-Daten.
- **Frontend:** Route Guard (z. B. Angular `CanActivateFn`) bzw. Admin-Komponente: Ohne Token nur Login-UI auf derselben Route; mit gültigem Token wird das Admin-Dashboard (Session-Liste, Code-Eingabe, Detail, Löschen, Export) gerendert. Jeder Admin-tRPC-Aufruf sendet das Token mit (z. B. Header `Authorization: Bearer <token>`).
- **Backend:** **Jede** Admin-Prozedur prüft das Token (z. B. zentrale **adminProcedure**-Middleware); ungültig/fehlend → `UNAUTHORIZED`. Sicherheit liegt auf Token-Prüfung, nicht auf Geheimhaltung der URL.

### 5. Admin: Session-Lookup per Code

- Im Admin-Dashboard gibt es eine **Eingabe für den 6-stelligen Session-Code**. Der Admin kann damit direkt die zugehörigen Session- und Quiz-Daten abrufen (z. B. tRPC `admin.getSessionByCode({ code })`). Bei gültigem Code → Session-Detail inkl. Quiz-Inhalt; bei ungültigem Code → klare Fehlermeldung.

### 6. Admin: Audit

- Admin-Aktionen (Löschen, ggf. Export) werden in einem **Audit-Log** protokolliert (wer, wann, welche Session, optional Grund), Aufbewahrung gemäß rechtlichen Anforderungen (Backlog Epic 9, Story 9.2).

## Konsequenzen

### Positiv

- Klare Trennung der Rollen in der URL; keine Rechtevergabe durch bloßes Aufrufen einer Adresse.
- Host- und Admin-Zugriff sind tokenbasiert und serverseitig prüfbar; Frontend-Guards verbessern UX und verhindern Anzeige geschützter UI.
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
- **Host-Rechte über Session-Code:** Wer den 6-stelligen Code kennt, könnte Host sein – abgelehnt, da Teilnehmer den Code ebenfalls kennen; Host-Token bleibt exklusiv bei Session-Erstellung.
- **Tutoren über Host-Link arbeiten lassen:** abgelehnt; Q&A-Moderation soll delegierbar sein, ohne Quiz-Steuerung oder Session-Ende freizuschalten.

---

**Referenzen:** Backlog Epic 9 (Admin), [docs/ROUTES_AND_STORIES.md](../../ROUTES_AND_STORIES.md) (Routen, Host-/Admin-Autorisierung, Absicherung).
