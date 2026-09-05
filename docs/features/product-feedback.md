/**

- ProductFeedback — Feature-Übersicht (Story 12.1).
-
- Domäne `ProductFeedback` ist strikt getrennt von SessionFeedback (4.8) und
- quickFeedback/Blitzlicht. Öffentliche Mutations: Token-/Capability-basiert,
- keine Session-/Personen-IDs in PostgreSQL.
-
- Ablauf: Session-FINISHED → Invite-Ausstellung (Stichprobe) → Claim → Submit →
- optionales Follow-up. Admin: `admin.productFeedback.getStats`.
- Host-Home: `setPendingHostSessionCode` beim Anzeigen der Karte, damit
- `claimInvite` das `x-host-token` mitschickt.
-
- UI: kompakte Mikro-Umfrage (Frage als Überschrift, tonale Chips, Schritt 1/2);
- Host als Bottom-Sheet, Teilnehmende inline auf Session-Ende. Session-Bewertung
- (4.8) hat Vorrang — Absenden in der Bewertungskarte; Produktfrage erscheint bei
- Teilnehmenden erst nach Absenden der Session-Bewertung (oder wenn 4.8 fehlt).
- Floating-Tray: Navigation/Bonus. Area-Chips folgen dem Nutzungsflow
- (linke Spalte frühe Schritte, rechte Spalte später/Meta; mobil einspaltig).
-
- E2E: `npm run smoke:product-feedback -w @arsnova/frontend` (Host-Sheet + Vote;
- Screenshots unter `SMOKE_ARTIFACT_DIR`, Default `tmp/product-feedback-e2e`).
-
- Retention: strukturiert ≤13 Monate, Freitext ≤90 Tage, Invite-Token ≤24h.
-
- Datenschutz: anonym, kein Login/E-Mail; erlaubter Kontext nur grobe Sessionart,
- Größenklasse, Locale, App-Version, Geräteklasse, genutzte Funktionsbereiche.
- Sichtbar nur für Plattform-Admins — nie Host-Ergebnis, Beamer oder Sessionexport.
  */
