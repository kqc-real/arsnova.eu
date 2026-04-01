# Admin-Flow (Epic 9)

Diese Dokumentation beschreibt den technischen und operativen Ablauf des Admin-Bereichs (`/admin`) inklusive Authentifizierung, Session-Löschung, Behördenexport und Fehlerbehebung.

## 1. Zweck und Geltungsbereich

Der Admin-Flow deckt drei Kernaufgaben ab:

- **Story 9.1:** Sessions und Session-Details recherchieren
- **Story 9.2:** Sessions (inkl. ggf. unreferenziertem Quiz) final löschen, mit Audit-Log
- **Story 9.3:** Behördenauszug als PDF (primär) oder JSON (optional) exportieren, mit Audit-Log

Der Flow ist als **MVP Shared-Secret-Login** umgesetzt:

- Login per `ADMIN_SECRET`
- danach tokenbasierter Zugriff auf `admin.*`-Prozeduren
- Tokenablage im Browser in `sessionStorage`

## 2. Voraussetzungen (lokal)

### 2.1 Umgebungsvariablen

In `.env` müssen mindestens diese Werte gesetzt sein:

```dotenv
ADMIN_SECRET="set-a-strong-admin-secret"
ADMIN_SESSION_TTL_SECONDS=28800
ADMIN_LEGAL_HOLD_DEFAULT_DAYS=30
```

Hinweis:

- Ohne `ADMIN_SECRET` liefert der Backend-Login: `Admin-Authentifizierung ist nicht konfiguriert.`
- Änderungen an `.env` werden erst nach Backend-Neustart wirksam.
- Beim Start lädt das Backend automatisch eine `.env` im **aktuellen Arbeitsverzeichnis** oder **zwei Ebenen darüber** (Monorepo-Root), sofern die Datei existiert. Üblich: `cp .env.example .env` im Repo-Root.

### 2.2 Laufende Dienste

- Backend: `http://localhost:3000` (`/trpc`)
- Frontend (Dev): `http://localhost:4200`
- Optional lokalisierter Build mit API-Proxy: `npm run serve:localize:api -w @arsnova/frontend`

## 3. Authentifizierungsmodell

## 3.1 Wichtige Regel

Der `ADMIN_SECRET` ist **nur** für `admin.login` gedacht.  
Alle geschützten Admin-Prozeduren (`admin.listSessions`, `admin.getSessionDetail`, `admin.deleteSession`, `admin.exportForAuthorities`, ...) akzeptieren **nur** ein gültiges Admin-Session-Token.

## 3.2 Technischer Ablauf

1. Client ruft `admin.login` mit Secret auf.
2. Backend verifiziert Secret (`verifyAdminSecret`).
3. Backend erstellt ein opakes Token, speichert es in Redis mit TTL.
4. Client sendet dieses Token bei weiteren Requests als Header:
   - `x-admin-token: <token>`  
     oder
   - `Authorization: Bearer <token>`
5. `adminProcedure` validiert das Token zentral gegen Redis.

## 3.3 Token im Frontend

- Storage-Key: `arsnova-admin-token`
- Speicherort: `window.sessionStorage`
- Lifecycle:
  - gesetzt nach erfolgreichem Login
  - entfernt bei Logout oder ungültiger Session

## 4. Admin-Flow in der UI

1. Route öffnen: `/admin` (lokal meist `/de/admin`).
2. Ohne gültiges Token rendert die `AdminComponent` auf derselben Route die Login-Maske.
3. Admin-Schlüssel eingeben und anmelden.
4. Token wird unter `arsnova-admin-token` in `sessionStorage` gespeichert.
5. Sessions laden (Liste oder Code-Lookup).
6. Session-Detail öffnen.
7. Optional:
   - Legal Hold setzen/lösen
   - Behördenexport starten (PDF/JSON)
   - Session endgültig löschen

**Wichtig:** Im aktuellen Frontend gibt es dafür **keinen separaten Angular-Route-Guard**; das Gating passiert komponentenintern plus serverseitig über `adminProcedure`.

### 4.1 Lösch-Flow (Story 9.2)

Zusätzliche Sicherheits-/Bedienregeln:

- Löschen ist nur mit gültigem Admin-Token möglich.
- In der UI muss als Bestätigung der **Session-Code** (6-stellig) eingegeben werden.
- Der Admin-Schlüssel ist **nicht** der Bestätigungscode.
- Bei Retention-Status `PURGED` wird Löschen serverseitig abgelehnt.
- Ein Audit-Log-Eintrag mit Action `SESSION_DELETE` wird angelegt.

### 4.2 Export-Flow (Story 9.3)

- Formate: `PDF` oder `JSON`
- Ausgabe enthält normalisierte Markdown-/KaTeX-Inhalte in lesbarer Textform
- Bei `PURGED` wird Export serverseitig abgelehnt
- Audit-Log-Eintrag mit Action `EXPORT_FOR_AUTHORITIES`

## 5. API-Kurzreferenz (tRPC)

Die folgenden Prozedurnamen und Aufgaben sind **kanonisch**. Für Rohaufrufe per `curl` ist zu beachten, dass tRPCs HTTP-Transportdetails je nach Client-/Batch-Konfiguration sperrig sind; für reproduzierbare manuelle Tests daher bevorzugt das Frontend oder einen kleinen tRPC-Client verwenden.

## 5.1 Login

- Procedure: `admin.login`
- Input: `secret`
- Output: `token`, `expiresAt`

## 5.2 Session prüfen (`whoami`)

- Procedure: `admin.whoami`
- Erfordert gültiges Admin-Token
- Output: `{ authenticated: true }`

## 5.3 Sessions laden

- Procedure: `admin.listSessions`
- Input: `page`, `pageSize`, optional Filter `status`, `type`, `code`
- Output: paginierte Session-Liste innerhalb des Recherchefensters

## 5.4 Session löschen

- Procedure: `admin.deleteSession`
- Input: `sessionId`, optional `reason`
- Output: `deleted`, `sessionId`, `sessionCode`

## 5.5 Export

- Procedure: `admin.exportForAuthorities`
- Input: `sessionId`, Format (`PDF` oder `JSON`)
- Output: Export-Metadaten plus Nutzdaten/Dateiinhalt gemäß DTO

## 6. Troubleshooting

| Symptom                                                            | Ursache                                                             | Lösung                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `Admin-Authentifizierung ist nicht konfiguriert.`                  | `ADMIN_SECRET` fehlt im Backend-Prozess                             | `.env` prüfen, Backend neu starten                       |
| `Unexpected token 'B', "Backend ni"... is not valid JSON`          | Proxy liefert Klartext-Fehler statt JSON (Backend nicht erreichbar) | Backend starten, Proxy-Ziel (`/trpc -> :3000`) prüfen    |
| Login klappt, aber `deleteSession` schlägt mit `UNAUTHORIZED` fehl | Token fehlt/ist falsch/abgelaufen/gegen falschen Port verwendet     | `admin.whoami` mit demselben Token testen, Header prüfen |
| Delete-Button in UI bleibt deaktiviert                             | Bestätigungscode stimmt nicht mit Session-Code überein              | Exakten 6-stelligen Session-Code eingeben                |
| Löschen/Export nicht möglich wegen Retention                       | Session ist bereits `PURGED`                                        | Erwartetes Verhalten; keine Daten mehr verfügbar         |

## 7. Sicherheitsnotizen

- Admin-Rechte werden nicht über URL vergeben, sondern ausschließlich über Credentials + Token.
- Alle kritischen Aktionen laufen über serverseitig geschützte `adminProcedure`.
- Lösch- und Exportaktionen werden auditiert.
- Token lebt bewusst nur in `sessionStorage` (tab-/sitzungsgebunden).
