# Hintergrund: ARSnova-Ökosystem und arsnova.click

Dieses Dokument ordnet **arsnova.eu** (dieses Repo) in die Geschichte und das Ökosystem der ARSnova-Softwarefamilie ein. Es stützt sich auf die systematische Analyse in **docs/deep-research-arsnova.click/ARSnova-Recherche.pdf**.

---

## 1. Ökosystem und Genealogie

Das ARSnova-Projekt entstand 2012 an der **Technischen Hochschule Mittelhessen (THM)** unter Leitung von Prof. Dr. Klaus Quibeldey-Cirkel. Die Softwarefamilie hat sich in mehrere Stränge aufgefächert:

| Produkt                                | Primärfunktion                              | Status (Stand 2024/25)                                                        | Bezug                                                         |
| -------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **ARSnova** (arsnova.app / arsnova.eu) | Live-Feedback, JiTT, Peer Instruction       | Eingestellt (Online-Dienst beendet)                                           | Ursprungs-F&E THM; funktionaler Nachfolger: Particify         |
| **arsnova.click**                      | Gamifizierte Quiz-App (Kahoot!-Alternative) | Aktiv; eigenständig und als „fester Bestandteil“ in **frag.jetzt** integriert | F&E THM                                                       |
| **Particify**                          | Kommerzielles ARS (Voting, Q&A, Quiz)       | Aktiv, SaaS + Open Source                                                     | Spin-off 2020 der ARSnova-Hauptentwickler                     |
| **frag.jetzt**                         | KI-gestützte Q&A- und Lernplattform         | Aktiv, aktueller F&E-Fokus THM                                                | Domain **arsnova.eu** verweist hierauf; enthält arsnova.click |

**Wichtig:** Die Publikations- und Entwicklungsgeschichte von **arsnova.click** gehört zum akademischen Strang (THM / frag.jetzt), nicht zum kommerziellen Particify.

---

## 2. Didaktische und technische Grundlagen (arsnova.click)

- **Didaktik:** Formatives Assessment, Testing Effect, Spacing Effect; Gamification (Live-Wettbewerb, Zeitdruck, Sounds, Rangliste). **Bonusvergabe** (Tokens für Top-Platzierte, Einlösung z. B. per E-Mail) als Anreiz für Vorbereitung und Präsenz.
- **Technik (arsnova.click-v2):** Angular, Node/Express, MongoDB, RabbitMQ, PWA. **Kerninnovation:** Quizdaten liegen **nicht** auf dem Server, sondern im **HTML5 Local Storage** des Dozenten-Browsers; der Server fungiert als anonymer Message-Broker (Privacy-by-Design, DSGVO-tauglich für Hochschulen).
- **Open Source:** GPL-3.0; Self-Hosting und Anpassung (z. B. Corporate Design, CAS/LDAP) an Hochschulen verbreitet.

---

## 3. Bezug zu diesem Repo (arsnova.eu)

Dieses Repo ist eine **eigenständige, moderne Neuimplementierung** einer Live-Quiz- und Abstimmungsplattform im Geiste von arsnova.click und der ARSnova-Tradition:

- **Gleiche Prinzipien:** Zero-Knowledge (Quiz-Inhalte nicht dauerhaft auf dem Server), Gamification, Bonus-Code für Top-Plätze, Presets Seriös/Spielerisch, didaktische Kontrolle (Lesephase, Schwierigkeit).
- **Neuer Stack:** Yjs (CRDT) + IndexedDB statt reinem Local Storage; tRPC, PostgreSQL, Redis; Zod-Validierung; KI-Quiz-Import über externes LLM (Zero-Knowledge) statt integrierter Cloud-KI.
- **Positionierung:** Europäische Alternative zu Mentimeter, Kahoot und Slido – interaktive Sessions, Quiz und Feedback, Made in Europe, ARSnova-Tradition seit 2012; DSGVO-konform, kostenlos, Open Source; erste Wahl für Schule, Uni und Business.

Die Deep Research (PDF) beschreibt die **Herkunft** und **wissenschaftliche Einbettung**; dieses Repo setzt die **technische und produktive Weiterentwicklung** mit heutigen Architekturentscheidungen um.

---

## 4. Quellen und Weiterführendes

- **Vollständige Analyse:** [docs/deep-research-arsnova.click/ARSnova-Recherche.pdf](deep-research-arsnova.click/ARSnova-Recherche.pdf) – Kategorien (Peer-Review, Theses, Code/Architektur, Grey Literature), Genealogie, technische und didaktische Veröffentlichungen, Synthese.
- **Vergleich mit Marktführern:** [docs/ARS-comparison/Kahoot-Mentimeter-Slido-arsnova.click-v3.md](ARS-comparison/Kahoot-Mentimeter-Slido-arsnova.click-v3.md).
- **Promptarchitektur (KI-Quiz):** [docs/architecture/decisions/0007-prompt-architecture-ki-quiz.md](architecture/decisions/0007-prompt-architecture-ki-quiz.md).
