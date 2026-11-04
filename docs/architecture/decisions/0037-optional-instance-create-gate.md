<!-- markdownlint-disable MD013 -->

# ADR-0037: Optionales Instanz-Gate für öffentliche Creates

**Status:** Proposed
**Datum:** 2026-10-23
**Entscheider:** ausstehend (Issue [#575](https://github.com/kqc-real/arsnova.eu/issues/575))
**Letzter Repo-Abgleich:** 2026-10-23

## Kontext

Eine öffentliche Instanz von arsnova.eu ist heute bewusst accountfrei: Jede:r kann lokal ein Quiz anlegen und anschließend über `quiz.upload` plus `session.create` live gehen. Host-Tokens nach [ADR-0006](0006-roles-routes-authorization-host-admin.md) und [ADR-0019](0019-host-hardening-and-owner-bound-session-access.md) sichern die **Steuerung** einer bereits erzeugten Session, nicht deren Entstehung. `ADMIN_SECRET` schützt die **Betreiberrolle** (`/admin`: Recherche, Legal Hold, Löschung, Behördenexport), nicht das Anlegen.

Issue [#575](https://github.com/kqc-real/arsnova.eu/issues/575) fragt, ob eine öffentliche Instanz so absicherbar ist, dass nur Berechtigte ein Quiz anlegen können — vorgeschlagen als optionales Quiz-Admin-Passwort analog `ADMIN_SECRET`. Anlass ist die Sorge, die Instanz könne für rechtlich anfechtbare Quizze missbraucht werden.

Drei Feststellungen begrenzen die Lösung:

1. **Lokal anlegen ist kein Serverereignis.** Nach [ADR-0004](0004-use-yjs-for-local-first-storage.md) lebt die Quiz-Sammlung im Browser. Rechtlich und operativ relevant wird Inhalt erst, wenn er den Server erreicht oder live läuft.
2. **Quiz ist nicht der einzige Publikationskanal.** Leere Räume, Q&A-only-Sessions, Standalone-Blitzlicht und Session-Titel tragen dieselben Inhalte.
3. **Ein Shared Secret ist keine Identität.** Es senkt die Zahl Unbefugter, macht Inhalte nicht rechtssicher und ersetzt weder Notice-and-Takedown noch Admin-Löschung.

Die öffentliche Referenzinstanz soll accountfrei und sofort nutzbar bleiben ([SECURITY-HARDENING-PLAN](../../SECURITY-HARDENING-PLAN.md)). Self-Hoster und geschlossene Hochschul- oder Verbundinstanzen brauchen trotzdem einen **Instanzmodus**, ohne Nutzerkonten einzuführen.

## Entscheidung

### 1. Optionaler Instanzmodus, kein zweites Admin-Secret

Wenn `INSTANCE_CREATE_SECRET` **nicht** gesetzt ist, bleibt das heutige Verhalten: Public Creates sind offen und nur kapazitiv begrenzt (W1.3).

Wenn `INSTANCE_CREATE_SECRET` **gesetzt** ist, verlangt jede öffentliche Erzeugung serverseitig ein gültiges Instanz-Create-Token. Das Secret ist ein **Freigabecode der Instanz**, keine Lehrenden-IAM und keine Admin-Anmeldung.

Trennregeln:

- niemals denselben Wert wie `ADMIN_SECRET` oder `ADMIN_DIAGNOSTIC_SECRET` verwenden
- `ADMIN_SECRET` autorisiert keine Public Creates
- das Create-Token autorisiert keinen Admin-Pfad
- Mindestlänge 16 Zeichen; Vergleich konstantzeitig
- fehlgeschlagene Versuche analog zum Admin-Login grob budgetieren (globales Pre-Auth-Limit, Delay)

### 2. Gate sitzt auf Public Creates, nicht auf lokalem Editieren

Serverseitig zu sperren, sobald das Secret gesetzt ist:

| Procedure        | Warum                                                      |
| ---------------- | ---------------------------------------------------------- |
| `quiz.upload`    | persistiert Quizinhalt in PostgreSQL                       |
| `session.create` | startet Live-Raum, Q&A-only, leeren Raum oder Quiz-Session |

`quickFeedback.create` ist **eine** `publicProcedure` mit zwei Eingangspfaden, nicht zwei Procedures und nicht `hostProcedure`:

- **Standalone** (kein `sessionCode`): Public Create. Hier greift das Instanz-Gate, sobald das Secret gesetzt ist.
- **Sessiongebunden** (`sessionCode` gesetzt): zuerst die bestehende Host-Prüfung (`assertHostSessionAccessFromContext`). Wer die Session schon als Host steuert, braucht keinen zweiten Freigabecode.

Ein pauschaler `instanceCreateProcedure`-Wrapper um die ganze Mutation ist falsch: Er würde sessiongebundene Starts sperren oder Standalone-Starts offen lassen. Die Gate-Prüfung ist deshalb **inputabhängig** in derselben Procedure, nicht durch Aufteilen oder durch ein Host-Procedure-Rewrite.

Bewusst **nicht** im ersten Schnitt:

| Pfad                                                                        | Begründung                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/quiz/new`, lokale Sammlung, Import                                        | Local-First, kein Server                              |
| Join, Vote, Present, bestehende Host-Steuerung                              | Teilnahme und laufende Sessions bleiben offen         |
| `admin.*`                                                                   | eigene Rolle, eigenes Secret                          |
| `quizSync.createShare` / `rotateShare`                                      | Geräte-Relay, keine Live-Publikation; Follow-up       |
| `quiz.prepareLearningObjectiveDerivation` / `quiz.deriveLearningObjectives` | CPU-Vorbereitung, kein Live-Start; Follow-up          |
| Teilnehmer-Q&A nach Join                                                    | Residualrisiko; Notice-and-Takedown, kein Create-Gate |

Eine reine Frontend-Sperre ist unzulässig. Direkte tRPC-Aufrufe müssen dieselben Regeln sehen.

### 3. Login-Muster analog Admin, eigene Tokenklasse

Ablauf:

1. Öffentliche Policy-Query (`instance.getCreatePolicy` oder Erweiterung von `health.footerBundle`) liefert nur `{ publicCreatesRequireUnlock: boolean }`.
2. `instance.unlockCreates` prüft das Secret und legt ein opakes Redis-Token mit TTL an.
3. Geschützte Creates laufen über eine zentrale Middleware (`instanceCreateProcedure`), Header `x-instance-create-token`.
4. Frontend speichert das Token in `sessionStorage`, nicht in `localStorage`.

TTL-Default: **8 Stunden** (`INSTANCE_CREATE_SESSION_TTL_SECONDS`, analog `ADMIN_SESSION_TTL_SECONDS`). Das deckt einen Lehrtag, erzwingt aber keine Daueranmeldung.

### 4. UX vor dem ersten Live-Start

Local-First bleibt frei. Die Sperre erscheint erst, wenn die Nutzerin oder der Nutzer auf **dieser** Instanz publiziert:

- Startseite: leerer Raum, Q&A, Blitzlicht, Quiz live schalten
- Quiz-Liste / Vorschau: „Live schalten“
- Standalone-Blitzlicht-Start

Verhalten:

- Ist die Instanz offen: keine zusätzliche UI.
- Ist sie geschlossen und kein gültiges Token vorhanden: Dialog „Freigabecode dieser Instanz“ **vor** `quiz.upload` / `session.create` / Standalone-`quickFeedback.create`.
- Falscher Code: klare Fehlermeldung, Fokus bleibt im Dialog, Create wird nicht gesendet.
- Erfolgreicher Unlock: Token setzen, ursprüngliche Aktion fortsetzen, kein Redirect auf `/admin`.
- Ablauf oder `UNAUTHORIZED`: Dialog erneut, laufende Host-Session bleibt gültig.
- Geschlossene Instanz darf in der Start-/Live-UI kurz als solche erkennbar sein; der Code selbst wird nicht erklärt oder vorgeschlagen.

Texte in `de`, `en`, `fr`, `es`, `it` mit locale-spezifischen Anführungszeichen. Kein `::ng-deep`. Mobile-first: Dialog muss auf schmalen Viewports vollständig bedienbar bleiben.

### 5. Was das Gate nicht leistet

- Es identifiziert keine Person und erzeugt kein Audit „wer hat was angelegt“.
- Es verhindert keine rechtswidrigen Inhalte durch Code-Kenner.
- Es ersetzt nicht Admin-Löschung, Legal Hold, Behördenexport und den bestehenden Impressums-Hinweis (Haftung ab Kenntnis).
- Die öffentliche Referenzinstanz aktiviert den Modus **nicht** als Default.

## Konsequenzen

### Positiv

- Geschlossene Instanzen bekommen einen betreibbaren Schalter ohne Nutzerkonten.
- Local-First und das Kernversprechen der offenen Referenz bleiben erhalten.
- Alle relevanten Publikationskanäle werden gleich behandelt, nicht nur das Quiz-Formular.
- Das Muster entspricht dem bestehenden Secret→Redis-Token→Procedure-Schnitt.

### Negativ / Risiken

- Ein geteilter Freigabecode leckt und muss out-of-band rotiert werden.
- Wer den Code kennt, kann weiter anfechtbare Inhalte erzeugen.
- Teilnehmer-Q&A und der Yjs-Relay bleiben mögliche Restkanäle.
- Eine zusätzliche Tokenklasse erhöht Frontend- und Middleware-Komplexität.
- Fail-closed: Secret gesetzt, aber Redis nicht erreichbar, darf Creates nicht still öffnen.

## Alternativen (geprüft)

- **Nur UI-Passwort auf `/quiz/new`:** umgehbar per tRPC; lokal anlegen ist ohnehin kein Risiko.
- **`ADMIN_SECRET` wiederverwenden:** vermischt Betreiber- und Lehrenden-Zugang; widerspricht der Admin-Regel, das Secret nur für `admin.login` zu nutzen.
- **VPN / Reverse-Proxy / Intranet:** bleibt für viele Self-Hoster die richtige Betriebsentscheidung; deckt die in-app öffentliche Instanz nicht ab.
- **Lehrenden-Accounts / IAM:** von [ADR-0019](0019-host-hardening-and-owner-bound-session-access.md) für den aktuellen Zuschnitt verworfen. Epic 11 (Publisher) ist ein anderes Modell.
- **CAPTCHA statt Secret:** senkt Bot-Last, ersetzt keine Berechtigung.
- **Default-Gate auf der Referenzinstanz:** bricht „sofort, ohne Account“.
