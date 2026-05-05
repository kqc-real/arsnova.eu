# Produktdatenblatt: arsnova.eu

**Stand:** 2026-04-13  
**Produktkategorie:** Webbasierte Interaktions- und Abstimmungsplattform  
**Einsatzkontext:** Lehre, Training, Workshops, Konferenzen, Beteiligungsformate

---

## 1. Produktkurzbeschreibung

arsnova.eu ist eine browserbasierte Plattform für moderierte Live-Interaktion mit großen und kleinen Gruppen. Das Produkt verbindet Quiz, Abstimmung, Q&A und Blitzlicht-Feedback in einem durchgängigen Session-Flow mit Host-Steuerung, Teilnehmeransicht, Echtzeit-Synchronisierung und auswertbaren Ergebnissen.

Die Lösung ist auf zwei Zielgruppen gleichzeitig ausgelegt:

- **Didaktisch-fachliche Zielgruppe** (Lehrende, Trainer:innen, Moderation): Fokus auf Interaktionsqualität, Aktivierung, Lernkontrolle und einfache Steuerung.
- **Technisch-operative Zielgruppe** (IT, Betrieb, Datenschutz, Architektur): Fokus auf Stabilität, Sicherheit, klare Rechteprüfung, Datenminimierung, Testbarkeit und Wartbarkeit.

---

## 2. Quellenbasis der Beschreibung (vollständig ausgewertet)

Diese Produktbeschreibung wurde aus zwei Primärquellen konsolidiert:

- **Backlog-Quelle:** `Backlog.md`
  - Gesamtumfang: **95 Stories**
  - Status laut Story-Übersicht: **80 fertig**, **15 offen**
  - Epics: **0 bis 10**
- **Test-Quelle:** alle automatisierten Unit-/Komponententests in Backend und Frontend
  - **Frontend:** 43 Spec-Dateien (`*.spec.ts`), zuletzt 343 Tests
  - **Backend:** 27 Testdateien (`*.test.ts`), zuletzt 169 Tests
  - Zusammen: **512 automatisierte Tests** als Verhaltensnachweis

Hinweis: Die Darstellung bleibt produktdatenblatt-typisch verdichtet, bezieht sich aber auf den vollständigen Story- und Testbestand.

---

## 3. Funktionsumfang nach Epic (Produktumfang)

## Epic 0 – Infrastruktur und Plattform

- Redis, WebSocket-Adapter, Yjs-Basis, Serverstatus, Rate-Limiting, CI/CD produktiv umgesetzt.
- Offene Punkte: Last-/Performance-Testsystematik und McCabe-Refactor-Hotspots.

## Epic 1 – Quiz-Verwaltung

- Vollständiger Quiz-Lebenszyklus: erstellen, bearbeiten, löschen, importieren, exportieren.
- Fragetypen: Single-/Multiple-Choice, Freitext, Umfrage, Rating.
- Markdown/KaTeX inkl. Bild-URL/Lightbox und KI-unterstütztem Import.
- Offene Punkte: numerische Schätzfrage, Sync-Härtung/Skalierung, Editor-Toolbar-Ausbau, Word-Cloud-2.0.

## Epic 2 – Session-Start und Host-Steuerung

- Session-ID/Upload, QR-Einstieg, Host-/Presenter-Härtung, Lobby, Steuerkonsole, Beamer-Modus.
- Lesephase und Peer-Instruction (zweite Runde mit Vergleich) integriert.
- Aktuelle Erweiterungen: phasengesteuerte Einsprunglogik und verbesserte Round-2-/Ergebnisführung.

## Epic 3 – Teilnehmerfluss

- Join-Flow, Nicknames, Frageempfang, Antwortabgabe, Countdown, Echtzeitfeedback, anonymer Modus.

## Epic 4 – Ergebnisse und Auswertung

- Leaderboard, Reconnect, Ergebnisvisualisierung, Freitext-Auswertung.
- Bonuscodes, Export, Session-Bewertung durch Teilnehmende.

## Epic 5 – Motivation und Erlebnis

- Soundeffekte, Hintergrundmusik, Reward-Effekte, Streaks, persönliche Scorecard, Motivationsmeldungen, Emoji-Reaktionen.
- Neu präzisiert: Musik stoppt bei „alle haben abgestimmt“ als klares Ergebnis-Signal und startet in der nächsten Abstimmung wieder.

## Epic 6 – UX-Qualität und Compliance

- Theme, Internationalisierung, Impressum/Datenschutz, Mobile-First/Responsive umgesetzt.
- Offen: formalisierte Abschlussläufe für Barrierefreiheit und UX-Testreihen.

## Epic 7 – Team-Modus

- Teamwertung und Team-bezogene Ergebnisführung umgesetzt.

## Epic 8 – Q&A

- Start, Einreichen, Upvotes/Sortierung, Moderation umgesetzt.
- Offen: delegierbare Moderation sowie zusätzliche Ranking-Algorithmen (Kontroversität/Wilson).

## Epic 9 – Admin/Recht

- Admin-Inspektion, Löschung und behördlicher Auszug umgesetzt.

## Epic 10 – MOTD (Plattform-Kommunikation)

- End-to-end umgesetzt: Modell, APIs, Admin-UI, Overlay/Archiv, Interaktionen, Härtung.

---

## 4. Produktnutzen für die didaktische Zielgruppe

- **Schneller Einstieg:** Session-Code und QR-Zugang ohne App-Installation.
- **Klare Lernphasen:** Lesephase, Abstimmung, Diskussion, Ergebnis gezielt steuerbar.
- **Mehr Aktivierung:** Quiz, Freitext, Q&A, Blitzlicht, Emoji-Reaktionen in einem System.
- **Sichtbarer Lernerfolg:** Ergebnis- und Vergleichsansichten (inkl. Runde-1/Runde-2-Logik).
- **Niedrige Moderationslast:** einheitliche Host-Steuerung, erkennbare Statussignale, robuste Defaults.

---

## 5. Produktnutzen für die technische Zielgruppe

- **Sicherheitsprinzipien im Kern:** DTO/Data-Stripping, serverseitige Rechteprüfung, kein Rollenvertrauen aus URL-Pfaden.
- **Skalierbare Echtzeit-Basis:** Redis + tRPC-Subscriptions + Polling-Fallbacks.
- **Testgetriebene Qualität:** breite Backend-/Frontend-Tests, inklusive Fehler- und Randfälle.
- **Betriebsfähigkeit:** CI/CD, Typecheck-/Lint-/Test-Gates, reproduzierbarer Build.
- **Wartbarkeit:** klarer Monorepo-Zuschnitt (Backend, Frontend, Shared Types) mit Zod-first-Verträgen.

---

## 6. Qualitäts- und Compliance-Merkmale

- Mobile-First Ausrichtung und responsive Oberflächen.
- Mehrsprachige UI (DE als Quelle, gepflegte Zielsprachen EN/FR/ES/IT).
- Accessibility-relevante Patterns (u. a. Fokusführung, ARIA-Live-Elemente, motion-aware Verhalten).
- Datenschutzorientierte Datenminimierung und bereinigte Session-Lebenszyklen.

---

## 7. Verhaltensnachweise durch Testfunktionen (Auszug nach Domänen)

Die Tests sind breit über Produktdomänen verteilt und decken produktrelevante Verhaltensklassen ab:

- **Session-Host/Steuerung:** `session-host.component.spec.ts`, `session.current-question-host.test.ts`, `session.steering.test.ts`
- **Teilnehmer-Voting/Flow:** `session-vote.component.spec.ts`, `vote.test.ts`, `session-countdown.util.spec.ts`
- **Q&A:** `qa.test.ts`, host-/vote-Komponententests mit Moderation und Sortierlogik
- **Ergebnis/Scoring:** `quizScoring.test.ts`, `session-present.component.spec.ts`, `word-cloud.component.spec.ts`
- **Sicherheit/Rate-Limit/DTO:** `rateLimit.test.ts`, `dto-security.test.ts`, `ensure-schema.test.ts`
- **Import/Export/Quiz-Verwaltung:** `quiz.upload.test.ts`, `quiz-store.service.spec.ts`, `quiz-edit.component.spec.ts`
- **Plattform/Integrationen:** `health.test.ts`, `trpc.client.spec.ts`, `motd*.test.ts`

Damit ist die Produktbeschreibung nicht nur backlog-basiert, sondern auch verhaltensvalidiert.

---

## 8. Aktueller Lieferstand und offene Produktinkremente

**Lieferstand:** Kernprodukt inkl. Sessionsteuerung, Teilnehmerfluss, Auswertung, Admin und MOTD ist produktiv funktionsfähig und testseitig breit abgesichert.

**Offene Inkremente mit hoher Relevanz:**

- Last-/Performance-Tests (0.7)
- Komplexitätsreduktion/Refactor-Hotspots (0.8)
- Numerische Schätzfrage (1.2d)
- Sync-Sicherheit/Skalierung (1.6c/1.6d)
- Q&A-Erweiterungen (8.5–8.7)
- Abschlussläufe Accessibility/UX (6.5/6.6)

---

## 9. Abgrenzung

arsnova.eu ist eine Interaktions- und Live-Session-Plattform; es ist **kein** vollumfängliches LMS mit Kursverwaltung, Prüfungsverwaltung und Notenbuch als Kernprodukt.

---

## 10. Eignung als Produktdaten-Beschreibung

Dieses Dokument ist bewusst so formuliert, dass es sowohl:

- für **fachlich-didaktische Entscheider:innen** (Nutzen, Ablauf, Wirkung) als auch
- für **technisch-betriebliche Entscheider:innen** (Sicherheit, Architektur, Qualität, Testbarkeit)

direkt lesbar und entscheidungsfähig ist.
