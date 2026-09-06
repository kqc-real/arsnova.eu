# ProductFeedback (Stories 12.1 und 12.2)

Domäne `ProductFeedback` ist strikt getrennt von SessionFeedback (4.8) und
quickFeedback/Blitzlicht. Öffentliche Mutationen sind Token-/Capability-basiert;
in PostgreSQL landen keine Session-/Personen-IDs.

## Ablauf

**Post-Session (12.1):** Session-`FINISHED` → PG-Invite-Job +
Redis-Eignungs-Slots (Stichprobe) → Claim → strukturierter Submit → optionales
Follow-up. Admin: `admin.productFeedback.getStats`
(Filter: Zeitraum, Perspektive, Frage; Aggregation inkl. Perspektive, Sprache, Sessiongröße,
Gerät sowie Einladungs-/Rücklaufquote; UI mit lesbaren Labels und Anteilsbalken).

Host-Home: Pending-Host-Invite beim Anzeigen der Karte, damit `claimInvite` das
`x-host-token` mitschickt. Host-Token bleibt bis Claim/Dismiss erhalten.

**IN_APP (12.2):** sichtbarer Utility-Einstieg oder sekundäres Angebot nach
einer typisierten Hürde → Art → Bereich → Same-Origin-Challenge →
`submitInApp` → optional `followUpInApp`. Die strukturierte Rückmeldung ist
nach zwei Auswahlen vollständig. Der optionale Follow-up kann nur innerhalb
von 15 Minuten genau diesen Datensatz um Auswirkung und/oder höchstens 500
Zeichen Plaintext ergänzen.

## IN_APP-Kontext-Whitelist

Übertragen werden ausschließlich Quelle, Rolle, Art, Bereich, Auswirkung,
Locale, App-Version, parameterlose Routengruppe, grobe Sessionphase, aktiver
Kanal, Geräteklasse, Browserfamilie mit Hauptversion, Betriebssystemfamilie,
Onlinezustand und eine vorhandene typisierte Fehler-/Request-ID. Nicht
übertragen werden vollständige URLs, Sessioncode/-ID, Quiz-, Frage-, Antwort-
oder Q&A-Inhalte, Nickname, Bonus-Code, Local-Storage-Inhalte, Zwischenablage,
Screenshots oder IP-Adresse als Feedbackattribut.

## UI

Kompakte Mikro-Umfrage (Frage als Überschrift, tonale Chips, Schritt 1/2);
Host als Bottom-Sheet, Teilnehmende inline auf Session-Ende. Session-Bewertung
(4.8) hat Vorrang — Produktfrage erscheint bei Teilnehmenden erst nach Absenden
der Session-Bewertung (oder wenn 4.8 fehlt / `quizStarted` false). Floating-Tray:
Navigation/Bonus. Area-Chips folgen dem Nutzungsflow (linke Spalte frühe
Schritte, rechte Spalte später/Meta; mobil einspaltig).

Fehlerzustände: Pending („Wird gesendet …“), Erfolg, Outbox-Hinweis bei
Netzwerk/Timeout und typisierte Ablehnungen für Ablauf, Einmaligkeit,
Berechtigung und Rate-Limit. Nur technisch erneut versuchbare Fehler bieten
„Erneut versuchen“ an. Outbox max. 7 Tage; erfolgreiche, endgültig abgelehnte
und abgelaufene Einträge werden aus localStorage entfernt. IN_APP-Entwürfe
holen beim Retry eine frische Challenge und behalten ihren Idempotency-Key.
Vorgemerkte Einträge sind im Dialog einsehbar und löschbar; der globale Retry
läuft bei App-Start und beim `online`-Ereignis.

Der globale Footer behält genau drei primäre Navigationsziele; „arsnova.eu
verbessern“ steht in einer getrennten Utility-Zeile. Hilfe, immersive
Hostansicht und eigenständige Blitzlichtansichten bieten gleichwertige,
beschriftete Einstiege. Die Presenteransicht bleibt frei davon. Kontextuelle
Host-/Vote-Angebote öffnen nie automatisch, ersetzen keinen Retry und
verändern weder Session- noch Realtime-Zustand.

Nach dem Speichern fragt die Post-Session-Karte, ob noch etwas ergänzt werden
soll. Vor dem Textfeld werden Namen, Sessioncodes, Quiz- oder Q&A-Inhalte und
andere personenbezogene Angaben ausdrücklich ausgeschlossen. Beim Schließen
wird der Fokus an den Auslöser beziehungsweise die priorisierte Folgeaktion
zurückgegeben.

## Sicherheit & Retention

- Invite-Tokens / Follow-up-Capabilities: Redis, SHA-256, TTL ≤24h bzw. ≤15 Min.
- IN_APP-Challenges: Redis, SHA-256, TTL ≤5 Min.; Browser-Same-Origin ist Pflicht.
  In Produktion zählt ausschließlich `PUBLIC_FRONTEND_URL`, niemals
  `Host` oder `X-Forwarded-Host`.
- IN_APP-Submit und Follow-up speichern denselben PostgreSQL-Idempotenz-Hash
  wie der Post-Session-Pfad, damit Outbox-Retries nach Redis-Verlust keine
  zweiten Datensätze anlegen.
- Teilnehmer-Claims benötigen zusätzlich einen beim Join ausgestellten,
  teilnehmerspezifischen Besitznachweis. Participant-ID und Session-Code allein
  reichen nicht.
- Strukturiert ≤13 Monate, Freitext ≤90 Tage.
- Die `FINISHED`-Transition schreibt den Invite-Job in derselben
  PostgreSQL-Transaktion. Ausstellung und Claim sind idempotent beziehungsweise
  per Redis-Lua atomar; PostgreSQL-Hashes von Invite und Idempotency-Key
  verhindern Duplikate auch über Redis-/Prozessfehler hinweg.
- Erledigte oder endgültig fehlgeschlagene Invite-Jobs werden nach sieben Tagen
  entfernt.
- Einladungszähler (Ledger) ohne Session-/Personen-IDs für Admin-Abschlussquote.
- Freitext erscheint **nicht** in der Admin-Statistik-UI von 12.1.
- Auffälliger IN_APP-Text wird nur als Plaintext gespeichert und
  quarantänemarkiert; keine Markdown-Darstellung und keine automatische
  Veröffentlichung.
- Die App-Version kommt vorrangig aus `APP_VERSION` oder `GITHUB_SHA` des
  Backends; der Clientwert ist nur ein Kompatibilitätsfallback.

## Admin-Triage (12.2)

`admin.productFeedback.list/getDetail/getTriageStats` bilden das paginierte,
filterbare Postfach. Schreibpfade für Status, Duplikatbündel, Quarantäne,
Issue-Verknüpfung, Rückkanal und endgültige Löschung laufen ausschließlich
über `adminProcedure` und erzeugen textfreie Auditmetadaten. Der
Statusworkflow lautet `NEW → REVIEWED → PLANNED → RESOLVED` oder `DISCARDED`.

Ein Issue-Entwurf enthält nur strukturierte, bereinigte Angaben. Der
Originaltext wird nie übernommen. `publishIssue` benötigt
`PRODUCT_FEEDBACK_GITHUB_REPOSITORY` und einen minimal berechtigten
`PRODUCT_FEEDBACK_GITHUB_TOKEN`; erst die gesonderte Adminaktion nach sichtbarer
Vorschau veröffentlicht. Ohne Konfiguration bleibt der Pfad geschlossen.
Bereits verknüpfte Issues werden idempotent zurückgegeben; parallele
Veröffentlichungen desselben Datensatzes werden atomar reserviert.

## Tests / Smoke

- Backend: `apps/backend/src/__tests__/productFeedback.test.ts`
- Frontend-Komponente und Storage: `product-feedback-card.component.spec.ts`,
  `product-feedback-storage.spec.ts`
- E2E-Smoke: `npm run smoke:product-feedback -w @arsnova/frontend`
  (getrennte Browser-Kontexte für Host und drei Teilnehmende, UI-Join,
  UI-Abstimmung, UI-Sessionende, Host-Sheet, Vote-Karte und negativer
  Sessionexport-Nachweis; Screenshots unter `SMOKE_ARTIFACT_DIR`, Default
  `tmp/product-feedback-e2e`).

## Verwandte Docs

- Datenschutz: `apps/frontend/src/assets/legal/privacy.*.md`
- Admin: `docs/implementation/ADMIN-FLOW.md`
- Routen: `docs/ROUTES_AND_STORIES.md`
- Glossar: `docs/GLOSSAR.md`
