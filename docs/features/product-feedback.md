# ProductFeedback (Story 12.1)

Domäne `ProductFeedback` ist strikt getrennt von SessionFeedback (4.8) und
quickFeedback/Blitzlicht. Öffentliche Mutations: Token-/Capability-basiert,
keine Session-/Personen-IDs in PostgreSQL.

## Ablauf

Session-`FINISHED` → PG-Invite-Job + Redis-Eignungs-Slots (Stichprobe) → Claim →
strukturierter Submit → optionales Follow-up. Admin: `admin.productFeedback.getStats`
(Filter: Zeitraum, Rolle, Fragefamilie; Aggregation inkl. Rolle, Survey-Version,
App-Version, Locale, Sessiongröße, Geräteklasse sowie Einladungs-/Abschlussquote).

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
Netzwerk/Timeout, typisierte Ablehnung mit „Erneut versuchen“ / „Schließen“.
Outbox max. 7 Tage; abgelaufene Einträge werden aus localStorage entfernt.

## Bewusste UX-Abweichungen vom Backlog-Wortlaut

Die Backlog-Copy aus Story 12.1 bleibt fachliche Referenz; die produktive UI
verwendet bewusst kürzere, idiomatische Texte nach UX-Abstimmung:

| Ort                 | Backlog (sinngemäß)                                        | Umgesetzt                                                                  |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Brand-Chrome        | Sichtbarer Titel „Eine Frage zu arsnova.eu“                | Titel nur als `aria-label`; sichtbare Überschrift = aktuelle Frage/Schritt |
| Thanks              | „Danke! Möchtest du noch etwas ergänzen? Ein Satz genügt.“ | „Noch einen Satz dazu?“                                                    |
| Freitext-CTA        | „Anmerkung ergänzen“                                       | „Schreiben“                                                                |
| Abschluss           | längere Danke-Formulierung                                 | „Gespeichert.“ / „Fertig“                                                  |
| Hürden-Prompt       | „Wo lag die größte Hürde?“                                 | „Woran hat’s am meisten gehakt?“                                           |
| Stärke-Prompt       | „Was hat heute besonders gut funktioniert?“                | „Was hat heute am besten geklappt?“                                        |
| Orientierungs-Label | „Orientierung in der App“                                  | „Sich zurechtfinden“                                                       |
| Live-Steuerung      | „Live-Session steuern“                                     | „Live steuern“                                                             |
| Privacy-Hinweis     | ausführlicher Lead inkl. Anonymität                        | Kurz: keine Namen/Session-Codes/personenbezogene Details                   |
| Host-Sheet          | schlichte Karte                                            | Soft-Scrim + elevated Surface (MD3)                                        |

Diese Abweichungen sind **kein** Regression-Bugfix-Ziel.

## Sicherheit & Retention

- Invite-Tokens / Follow-up-Capabilities: Redis, SHA-256, TTL ≤24h bzw. ≤15 Min.
- Strukturiert ≤13 Monate, Freitext ≤90 Tage.
- Finish schreibt Invite-Job in PostgreSQL; Ausstellung danach idempotent (NX-Slots);
  Cleanup-Tick retried offene Jobs.
- Einladungszähler (Ledger) ohne Session-/Personen-IDs für Admin-Abschlussquote.
- Freitext erscheint **nicht** in der Admin-Statistik-UI von 12.1.

## Tests / Smoke

- Backend: `apps/backend/src/__tests__/productFeedback.test.ts`
- Frontend-Storage: `product-feedback-storage.spec.ts`
- E2E-Smoke: `npm run smoke:product-feedback -w @arsnova/frontend`
  (Host-Sheet + Vote; Screenshots unter `SMOKE_ARTIFACT_DIR`, Default
  `tmp/product-feedback-e2e`).

## Verwandte Docs

- Datenschutz: `apps/frontend/src/assets/legal/privacy.*.md`
- Admin: `docs/implementation/ADMIN-FLOW.md`
- Routen: `docs/ROUTES_AND_STORIES.md`
- Glossar: `docs/GLOSSAR.md`
