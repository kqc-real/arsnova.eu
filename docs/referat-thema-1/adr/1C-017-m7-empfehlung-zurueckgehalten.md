# 1C-017: M7-Vorhersagemodell verfehlt, Empfehlung zurückgehalten

- **Status:** zurückgehalten (2026-11-05)
- **Kategorie:** Verbesserung (Kandidaten benannt, nicht empfohlen); bis dahin bleibt die Hashgrenze unverändert. _Aktualisiert 2026-11-12:_ Der Autor hält die Einordnung nicht für eine Ursachenklärung; die Empfehlung bleibt zurückgehalten (siehe Entscheidung).

## Kontext

Auftragsschritt 4: Jede angenommene Q&A-Stimme ändert den `snapshotHash` ([Dossier 8.2](../1C/1C-kontext-und-adapterpfad.md#82-was-eine-stimmenänderung-bewirkt)). M7 sollte messen, wie oft Aufträge unter Voting als `source_changed` enden. Hypothese H (die vorab festgelegte Vorhersage): Anteil = 1 − e^(−r·T), T = Fenster zwischen prepare (2) und (3); Gegenhypothese G: der Anteil liegt deutlich darunter; Kriterium K: die Vorhersage liegt je Rate im 95-%-Wilson-Intervall des beobachteten Anteils. Die Nachmessungen M7b und M7c prüfen zwei Zählweisen: K_a zählt nur `source_changed` (wie K), K_b jede verworfene Modellausgabe, also auch `failed` nach `CONFLICT` ([Nachtrag M7b](../evidenz/1C/2026-10-24-teil3.md#nachtrag-bestätigungsmessung-m7b-festgelegt-nach-sichtung-von-m7-vor-ihrer-durchführung)). Die vorab festgelegte Regel: Anteil ≥ 50 % bei r = 0,5/s → Verbesserung prüfen; < 50 % → Beibehaltung; K verfehlt → erst Ursache klären, dann empfehlen ([Design Teil 3, Abschnitt 5](../specs/2026-10-24-1c-teil3-design.md#5-messungen)).

## Entscheidung

Zeile 3 der Regel: Vorhersagemodell verfehlt, Empfehlung zurückgestellt. Die Kandidaten K1–K4 sind benannt und bewertet, aber nicht empfohlen. Ob die nachträgliche Einordnung als Ursachenklärung genügt, entscheidet allein der Autor ([Entscheidung zu M7](../evidenz/1C/2026-10-24-teil3.md#entscheidung)). _Aktualisiert 2026-11-12:_ Der Autor hat entschieden, dass sie nicht genügt; die Empfehlung bleibt zurückgehalten ([Stand der Autorenprüfung](../1C/1C-eigenanteil.md#stand-der-autorenprüfung)).

## Alternativen

- **K1 reine Stimmenänderungen tolerieren**, **K2 als „veraltet“ markieren statt verwerfen**, **K3 einmal automatisch wiederholen**, **K4 `CONFLICT` im Job-Aufbau einmal wiederholen**; Kosten und Risiken je Kandidat stehen in der [Kandidatentabelle](../evidenz/1C/2026-10-24-teil3.md#m7-entscheidung-nach-der-vorab-festgelegten-regel). K1 und K4 entsprechen inhaltlich den Optionen E2 und E3 im [Dossier 12.3](../1C/1C-kontext-und-adapterpfad.md#123-empfehlungsoptionen-zur-eigenen-entscheidung-im-referat).
- **Prüfempfehlung trotzdem aussprechen:** verworfen. Eine frühere Fassung (Commit `111a62fc`) enthielt eine vorläufige Freigabe durch die KI-gestützte Steuerung; sie widersprach der Festlegung im Nachtrag M7c und wurde am 2026-10-25 nach Review zurückgezogen ([Entscheidung zu M7](../evidenz/1C/2026-10-24-teil3.md#entscheidung-zu-m7-stand-nach-auswertung)).
- **Beibehaltung mit dokumentierter Häufigkeit:** greift nicht, weil K verfehlt ist und die unabhängigen Daten Zeile 1 und 2 nicht trennen (unten).

## Belege

- **K verfehlt:** M7 bei r = 0,1 und 2; M7b bei r = 0,5 (K_a auch bei r = 2); M7c bei r = 2 ([Zusammenfassung Teil 3](../evidenz/1C/2026-10-24-teil3.md#zusammenfassung)).
- **Anteil bei r = 0,5/s:** M7 50 % [29,9 %; 70,1 %], M7c 52,5 % [37,5 %; 67,1 %]; M7b 85 % ist nicht unabhängig (19 der 40 Seeds aus dem Extremblock von M7 r = 0,1). Die unabhängigen Intervalle liegen beidseits von 50 % ([Nachträgliche Einordnung](../evidenz/1C/2026-10-24-teil3.md#nachträgliche-einordnung-nicht-vorregistriert-als-grundlage-für-die-entscheidung-des-autors)).
- **Belastbar unabhängig von K:** Eine Stimme zwischen prepare (2) und (3) führt in jedem Lauf mit zwei Hashes zu `source_changed`; eine Stimme während eines Job-Aufbaus führt zu `failed`, beim Host sichtbar als `source_changed` ([Stand nach M7c](../evidenz/1C/2026-10-24-teil3.md#stand-nach-m7c)).
- **Labor (nur berichtet, keine neue Regel):** mittlere Vorhersage mit dem gemessenen Fenster 0,99 (Laptop) und 0,97 (PC) ([L3 Laptop](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop), [L3 PC](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc)); das Urteil zu M7 bleibt unverändert ([Labor-Design 6](../specs/2026-10-25-1c-labor-design.md#6-entscheidungsregeln)).

## Ursachenkette

Beobachtung: K verfehlt in M7 bei r = 0,1 und 2 → Hypothesen (nachträglich): r = 0,1 Stichprobenabweichung des Ankunftsprozesses, r = 2 nicht modellierter `CONFLICT`-Pfad während eines Aufbaus ([Ursachenklärung](../evidenz/1C/2026-10-24-teil3.md#m7-ursachenklärung)) → Versuch: M7b, dann M7c mit unabhängigen Seeds → Ergebnis: Der `CONFLICT`-Teil ist gestützt, die Klärung insgesamt gilt nicht als bestätigt; das Muster mehrerer Blöcke in den Rändern ist ungeklärt ([Nachträgliche Einordnung](../evidenz/1C/2026-10-24-teil3.md#nachträgliche-einordnung-nicht-vorregistriert-als-grundlage-für-die-entscheidung-des-autors)) → zurückgehalten.

## Folgen

- **Kosten und Risiko:** keine Änderung, also keine neuen; Modellantworten unter aktivem Voting gehen weiter häufig verloren (Befund B2, [Dossier 14](../1C/1C-kontext-und-adapterpfad.md#14-befundliste-kurzfassung-für-handout)).
- **Methodische Lehre:** K prüft auch die zufällige Realisierung der Zeitpläne und korrigiert nicht für Mehrfachprüfung; bei richtigem Modell verfehlt K an mindestens einer Rate mit 14,0 % (n = 20) bzw. 11,5 % (n = 40). Ein Kriterium „Hash geändert ⇔ Ankunft im Fenster“ wäre für künftige Vorregistrierungen die bessere Wahl ([Nachträgliche Einordnung](../evidenz/1C/2026-10-24-teil3.md#nachträgliche-einordnung-nicht-vorregistriert-als-grundlage-für-die-entscheidung-des-autors)).
- **Gültigkeitsgrenze:** D = 2000 ms als Stellvertreter; die reale Inferenz lag beim 81,7-fachen (Laptop) bzw. 49,4-fachen (PC) davon ([L3 Laptop](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop), [L3 PC](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc)) und verschiebt den Anteil nach oben. Die Rate 0,5/s ist eine Annahme, kein gemessener Wert ([Design Teil 3, Abschnitt 5](../specs/2026-10-24-1c-teil3-design.md#5-messungen)). Eine neue Empfehlung bräuchte eine eigene, vorab festgelegte Messung, z. B. M7 mit D = gemessener Inferenzzeit ([Labor-Design 6](../specs/2026-10-25-1c-labor-design.md#6-entscheidungsregeln)). Abgrenzung: T3.1 steht in [1C-016](1C-016-zeitabhaengiger-hash-blitzlicht.md).
