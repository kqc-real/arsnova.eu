# ProductFeedback (Story 12.1)

Domäne `ProductFeedback` ist strikt getrennt von SessionFeedback (4.8) und
quickFeedback/Blitzlicht. Öffentliche Mutations: Token-/Capability-basiert,
keine Session-/Personen-IDs in PostgreSQL.

## Ablauf

Session-`FINISHED` → PG-Invite-Job + Redis-Eignungs-Slots (Stichprobe) → Claim →
strukturierter Submit → optionales Follow-up. Admin: `admin.productFeedback.getStats`
(Filter: Zeitraum, Perspektive, Frage; Aggregation inkl. Perspektive, Sprache, Sessiongröße,
Gerät sowie Einladungs-/Rücklaufquote; UI mit lesbaren Labels und Anteilsbalken).

Host-Home: Pending-Host-Invite beim Anzeigen der Karte, damit `claimInvite` das
`x-host-token` mitschickt. Host-Token bleibt bis Claim/Dismiss erhalten.

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
„Erneut versuchen“ an. Der globale `online`-Hook sendet den lokalen Postausgang
bei Wiederverbindung. Outbox max. 7 Tage; erfolgreiche, endgültig abgelehnte
und abgelaufene Einträge werden aus localStorage entfernt.

Die Pflichttexte aus Story 12.1 werden unverändert verwendet, darunter
„Danke! Möchtest du noch etwas ergänzen? Ein Satz genügt.“ und
„Anmerkung ergänzen“. Vor dem Textfeld werden Namen, Session-Codes,
personenbezogene Angaben sowie fachliche Sessioninhalte ausdrücklich
ausgeschlossen. Beim Schließen wird der Fokus an den Auslöser beziehungsweise
die priorisierte Folgeaktion zurückgegeben.

## Sicherheit & Retention

- Invite-Tokens / Follow-up-Capabilities: Redis, SHA-256, TTL ≤24h bzw. ≤15 Min.
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
- Die App-Version kommt vorrangig aus `APP_VERSION` oder `GITHUB_SHA` des
  Backends; der Clientwert ist nur ein Kompatibilitätsfallback.

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
