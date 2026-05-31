<!-- markdownlint-disable MD013 -->

# ADR-0019: Host-Härtung und besitzgebundene Session-Zugriffe ohne Accounts

**Status:** Accepted  
**Datum:** 2026-04-03  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

`ADR-0006` hat das Zielbild für Host- und Admin-Autorisierung beschrieben: Rechte dürfen in einer accountfreien App **nicht** über URLs oder bloße Kenntnis eines Session-Codes entstehen. Im tatsächlichen Repo-Stand waren dafür mehrere konkrete Härtungsschritte nötig:

1. **Host-Steuerung absichern:** Session-Steuerung, Q&A-Moderation und exportnahe Endpunkte durften nicht weiter über öffentliche Procedures erreichbar sein.
2. **Presenter/Host-Routen im Frontend trennen:** `/session/:code/host` und `/session/:code/present` müssen auf dem Gerät des Hosts nur mit gültigem Token erreichbar sein; `/session/:code` ohne Segment darf nicht pauschal auf `host` zeigen.
3. **Standalone-Blitzlicht konsistent absichern:** Der Startseiten-Shortcut `/feedback/:code` ist kein Session-Host, braucht aber dennoch einen exklusiven Besitznachweis für host-only Aktionen.
4. **Datensparsamkeit im öffentlichen Session-Pfad:** Teilnehmerpfade wie Join und Vote durften keine vollständigen Teilnehmerlisten oder unnötige Session-Metadaten sehen.
5. **Quiz-Sammlungszugriffe ohne Accounts absichern:** Historie zu hochgeladenen Quizkopien (`Bonus-Codes`, `letztes Session-Feedback`, Live-Markierung in der Quiz-Liste) durfte nicht allein über eine serverseitige `quizId` enumerierbar bleiben.

Die Architektur bleibt bewusst **accountfrei** und **local-first**. Daraus folgt: Zugriff muss an **token- oder besitzgebundene Nachweise** gekoppelt werden, ohne ein klassisches Benutzerkonto einzuführen.

## Entscheidung

### 1. Session-Host-Rechte laufen über ein eigenes Host-Token

- `session.create` erzeugt serverseitig ein **Host-Token** und gibt es in der Response zurück.
- Das Frontend speichert das Token **pro Session-Code in `sessionStorage`**.
- Das Backend speichert **nur einen Hash** des Tokens in Redis, gebunden an den Session-Code und mit TTL.
- Host-only-Zugriffe werden zentral über eine **`hostProcedure`** geschützt; fehlendes oder ungültiges Token führt zu `UNAUTHORIZED`.

### 2. Host-only-Routen und Host-only-Procedures sind getrennte Ebenen

- Die Angular-Routen `/session/:code/host` und `/session/:code/present` werden clientseitig nur mit vorhandenem Host-Token freigegeben.
- `/session/:code` ohne Segment entscheidet **kontextabhängig**:
  - mit Host-Token → `/session/:code/host`
  - ohne Host-Token → `/join/:code`
- Diese Frontend-Prüfung ist **nur UX-/Navigationsschutz**; maßgeblich bleibt die serverseitige `hostProcedure`.

### 3. Standalone-Blitzlicht erhält ein eigenes Besitzer-Token

- Der Host eines Standalone-Blitzlichts (`/feedback/:code`) erhält **kein Session-Host-Token**, sondern ein eigenes **Feedback-Host-Token**.
- Dieses Token wird separat in `sessionStorage` gespeichert und über `x-feedback-host-token` übertragen.
- Session-eingebettetes Blitzlicht nutzt weiterhin das normale Session-Host-Token.
- Damit bleiben Session-Host und Standalone-Blitzlicht **fachlich getrennte Besitzkontexte**.

### 4. Öffentliche Session-Pfade werden datensparsam geschnitten

- Die vollständige Teilnehmerliste ist **host-only**.
- Öffentliche Teilnehmerpfade werden in kleinere, zweckgebundene Endpunkte getrennt:
  - Nickname-Kollisionen für Join
  - eigener Teilnehmerdatensatz für Vote
- Aggregierte Quiz-Historie wird von unnötigen Metadaten wie `sessionId` oder `sessionCode` bereinigt, wenn diese für den Anwendungsfall nicht gebraucht werden.

### 5. Quiz-Sammlungszugriffe werden an einen Besitznachweis gebunden

- Endpunkte, die Historie zu einer hochgeladenen Server-Quizkopie liefern, dürfen nicht allein über `quizId` öffentlich lesbar sein.
- Stattdessen wird ein **`accessProof`** verwendet:
  - Der Proof ist ein SHA-256 über den **kanonischen `QuizUploadInput`-Snapshot**.
  - Das Frontend speichert den Proof neben `lastServerQuizId` in der lokalen Quiz-Sammlung.
  - Das Backend rekonstruiert aus der gespeicherten Server-Quizkopie denselben kanonischen Snapshot und prüft den Proof mittels konstantzeitnaher Vergleichslogik.
- Dieser besitzgebundene Zugriff gilt für:
  - `session.getBonusTokensForQuiz`
  - `session.getLastSessionFeedbackForQuiz`
  - `session.getActiveQuizIds` (nur noch als Batch-Abfrage autorisierter Quizkopien)

### 6. Sicherheitsmodell: URL trennt Ansichten, Token/Proof trennt Rechte

Für alle Live-Zugriffe gilt künftig konsistent:

- **URL-Segmente** zeigen nur den **Anwendungsort** (`host`, `present`, `vote`, `join`, `feedback`).
- **Rechte** kommen aus einem **serverseitig prüfbaren Nachweis**:
  - Host-Token
  - Feedback-Host-Token
  - besitzgebundener `accessProof` für Quiz-Sammlungs-Historie
  - Admin-Token

## Konsequenzen

### Positiv

- Das Zielbild aus `ADR-0006` ist für Host-Zugriffe nun konkret umgesetzt statt nur beschrieben.
- Host-Steuerung, Presenter-Zugang und Blitzlicht-Hosting sind sauber voneinander getrennt.
- Öffentliche Session- und Sammlungsendpunkte geben weniger unnötige Daten preis.
- Die Quiz-Sammlung bleibt accountfrei, ohne serverseitig frei erratbare Historienzugriffe offen zu lassen.
- Die Architektur bleibt kompatibel mit späteren delegierten Rollen (z. B. Moderator-Token).

### Negativ / Risiken

- Mehr Token- und Proof-Klassen erhöhen die Komplexität in Frontend, Backend und Tests.
- `sessionStorage`-gebundene Tokens sind geräte- und browserkontextgebunden; beim Verlust lokaler Browserdaten muss der Zugriff neu aufgebaut werden.
- Der `accessProof` schützt Besitz innerhalb der lokalen Quiz-Sammlung, ist aber **kein** Nutzerkonto und **kein** kryptografisch signierter Eigentumsnachweis gegenüber Dritten.
- Mehr serverseitige Prüfpfade bedeuten zusätzliche Hash-/Redis-/Snapshot-Vergleiche im Hotpath.

## Alternativen (geprüft)

- **Host-Rechte nur über Session-Code:** verworfen, weil Teilnehmende denselben Code kennen.
- **Host-Rechte nur über Route Guards:** verworfen, weil Sicherheit serverseitig durchsetzbar bleiben muss.
- **Standalone-Blitzlicht mit Session-Host-Token mitbenutzen:** verworfen, weil Standalone-Blitzlicht keinen Session-Host-Kontext hat und die Besitzmodelle vermischt würden.
- **Quiz-Historie rein öffentlich über `quizId`:** verworfen, weil `quizId` serverseitig eine erratbare oder weitergebbare Referenz bleibt und kein Besitznachweis ist.
- **Vollständiges Nutzerkonto-/Owner-Modell:** für den aktuellen Produktzuschnitt bewusst verworfen, weil es die accountfreie Architektur aufbricht.

## Umsetzungsleitplanken

- Neue host-only Prozeduren müssen auf **`hostProcedure`** oder ein äquivalentes rollenbezogenes Middleware-Modell gehen.
- Neue standalone-Blitzlicht-Host-Aktionen dürfen nicht implizit an Session-Host-Rechte gebunden werden.
- Neue quizbezogene Sammlungs-/Historie-Endpunkte müssen prüfen, ob `quizId` allein ausreicht; im Zweifel denselben **`accessProof`** nutzen.
- Öffentliche Endpunkte müssen auf **zweckgebundene Minimaldaten** geprüft werden, besonders bei Teilnehmerlisten und Session-Historie.

## Repo-Abgleich 2026-05-31

Die Härtung ist weiterhin im Code sichtbar: `hostProcedure` schuetzt Host- und Presenter-nahe Sessionpfade, `x-host-token` und `x-feedback-host-token` werden im tRPC-Client gesetzt, Quiz-Historienzugriffe laufen ueber `accessProof` bzw. gebundene `historyScopeId`, und `getActiveQuizIds`, Bonus-Codes sowie letztes Session-Feedback pruefen den Besitznachweis.

---

**Referenzen:** [ADR-0006](./0006-roles-routes-authorization-host-admin.md), [ADR-0009](./0009-unified-live-session-channels.md), [ADR-0010](./0010-blitzlicht-as-core-live-mode.md), [ADR-0011](./0011-delegated-moderator-role-for-live-sessions.md), [docs/SECURITY-OVERVIEW.md](../../SECURITY-OVERVIEW.md), [docs/ROUTES_AND_STORIES.md](../../ROUTES_AND_STORIES.md).
