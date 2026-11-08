# Entscheidung 2A (Commit 9f230abc; erste Fassung auf a657798e, Befunde unverändert)

## Hypothese (vorab)

Ohne generative Inferenz liefert Release 1.3 eine quellentreue und nahezu kostenfreie, aber kategorienblinde Lageeinschätzung: Bewertungssignale werden korrekt getragen, Übungswunsch und Prüfungsorganisation jedoch nicht getrennt. Der extraktive Fallback bleibt hinter dem Regelkern zurück, weil er nicht nach Relevanz auswählt.

**Ergebnis:** Teilweise bestätigt. Quellentreue (keine unzulässigen Verkürzungen) und Kosten (< 20 ms p95 bei 500 Fragen, kein Modell; E5) bestätigt. Kategorienblindheit bestätigt (D3 ≤ 1 in allen realistischen Varianten). Die Vermutung zum extraktiven Fallback ist **präziser zu fassen**: Er wählt nach einer Relevanzregel aus (Signal-Schutz, Pin, Best-Score), aber diese Regel verdrängt systematisch die meistunterstützte, jedoch nicht einstimmige Frage A.

## Entscheidung

1. **Beibehaltung:** Regelkern als immer verfügbare Basis und generative Funktionen standardmäßig aus (Release-Default). Begründung: Bei sechs bis wenigen Dutzend Fragen erreicht keine Verdichtung mehr als die einfache Liste (E4: R200 = L = 5/10), während die Modellfreiheit keinen zweiten Host, keine GPU und keinen SaaS-Dienst erfordert und die Regelberechnung im Browser der Lehrperson läuft.
2. **Aktivierungskriterien für die generative Kurzfassung** (alle müssen im Labor belegt sein, auf demselben Szenario und derselben Rubrik):
   - Rubrik ≥ 8/10 in mindestens 9 von 10 Läufen, insbesondere **D2 = 2, D3 = 2, D5 = 2** – genau die Dimensionen, an denen alle nichtgenerativen Varianten scheitern;
   - **null** unzulässige Verkürzungen und null erfundene Kennzahlen über alle Läufe (Quellentreue getrennt von Schemagültigkeit geprüft, Auftrag 2C);
   - Ergebnis innerhalb des Release-Timeouts (90 s) in ≥ 95 % der Läufe, sonst überwiegt der Fallback und der Betrieb des zweiten Hosts lohnt nicht;
   - mindestens ein Szenario mit großer Fragemenge (≥ 100 Fragen), weil dort – nicht bei sechs Fragen – der Mehrwert einer Verdichtung entstehen kann.
3. **Konkrete Verbesserungen am nichtgenerativen Pfad** (klein, ohne Architekturänderung):
   1. Kandidatenauswahl des Fallbacks: je Anliegen mindestens eine Frage sichern oder zusätzlich nach Unterstützung (positive Stimmen) statt nur nach Wilson-Untergrenze ranken, damit A nicht entfällt.
   2. Stimmenverhältnis (+/−) in extraktiven Belegen anzeigen; die Daten liegen im Kontext bereits vor (D2 0 → 1–2).
   3. Fallback-Grund und Auswahlgrenze („4 von 6 Fragen“) in der Summary-Karte anzeigen; die Diagnose zeigt derzeit den geplanten statt des tatsächlichen Modus (D4).
   4. „Keine Daten“ von „0 Stimmen“ unterscheiden (#456 DoD).
   5. Kontroversitätsschwelle bei großen Räumen prüfen: T = ⌈0,1·N⌉ blendet eine 40:40-Teilung ab N = 791 aus (E2/K6). Bezug auf tatsächlich Abstimmende statt Raumgröße wäre die zu prüfende Alternative.

## Kosten-, Risiko- und Betriebsfolge

- Beibehaltung verursacht keine zusätzlichen Infrastrukturkosten. Der Regelkern läuft im Browser (< 20 ms bei 500 Fragen, p95), der extraktive Fallback in-process in der App (Median 143 ms Serverzeit, überwiegend Kontextaufbau).
- Verbesserungen 1–4 sind lokale Änderungen in App und Frontend mit Testbedarf, ohne neue Dienste.
- Risiko der Beibehaltung: Organisatorische Anliegen (C/D) bleiben im Regelkern unsichtbar; die Lehrperson muss die Q&A-Liste selbst lesen.
- Risiko einer vorschnellen Aktivierung: zweiter Host im Dauerbetrieb, 57 s pro Kurzfassung (dokumentierte Referenz) und – bei hängender Runtime – 90 s Wartezeit je Anfrage ohne automatische Abschaltung (E3b, C2a).

## Gültigkeitsgrenze

Die Regelempfehlung ist kein empirisch bestätigtes didaktisches Optimum. Die Rubrik misst Informationsqualität für die Lehrperson an einem festen Sechs-Fragen-Szenario plus Gegenfällen; Aussagen über Lernwirkung folgen daraus nicht.
