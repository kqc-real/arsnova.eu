/**

- ProductFeedback — Feature-Übersicht (Story 12.1).
-
- Domäne `ProductFeedback` ist strikt getrennt von SessionFeedback (4.8) und
- quickFeedback/Blitzlicht. Öffentliche Mutations: Token-/Capability-basiert,
- keine Session-/Personen-IDs in PostgreSQL.
-
- Ablauf: Session-FINISHED → Invite-Ausstellung (Stichprobe) → Claim → Submit →
- optionales Follow-up. Admin: `admin.productFeedback.getStats`.
-
- Retention: strukturiert ≤13 Monate, Freitext ≤90 Tage, Invite-Token ≤24h.
-
- Datenschutz: anonym, kein Login/E-Mail; erlaubter Kontext nur grobe Sessionart,
- Größenklasse, Locale, App-Version, Geräteklasse, genutzte Funktionsbereiche.
- Sichtbar nur für Plattform-Admins — nie Host-Ergebnis, Beamer oder Sessionexport.
  */
