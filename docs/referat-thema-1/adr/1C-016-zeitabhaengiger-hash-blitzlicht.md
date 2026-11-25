# 1C-016: Zeitabhängiger Hash bei live Blitzlicht-Runde beheben (T3.1)

- **Status:** empfohlen (2026-11-05), nicht umgesetzt; Issue-Entwurf nicht angelegt, _aktualisiert 2026-11-09:_ Issue [#18](https://github.com/NiklasSkulll/arsnova.eu/issues/18) im Fork
- **Kategorie:** Verbesserung

## Kontext

Auftragsschritt 4 fragt nach der Snapshot- und Hashgrenze. Ist für eine Session Blitzlicht aktiviert und liegt eine gültige Runde eines anderen Typs als `TEMPO` in Redis, liefert jeder Kontextaufbau einen neuen `snapshotHash`, auch ohne Datenänderung. Jeder Job verwirft dann die Modellantwort als `source_changed`, der Lesepfad überschreibt das Ergebnis bei jedem Abruf, Cooldown- und Packing-Cache treffen nie ([Befund T3.1](../evidenz/1C/2026-10-24-teil3.md#befund-t31--zeitabhängige-sourcerevision-bei-aktiver-blitzlicht-runde)). Der Befund ist exploratorisch, nicht vorregistriert.

## Entscheidung

Issue-Kandidat; Anlegen nur mit Freigabe des Autors ([Entscheidungen Laptop](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6), [Entscheidungen PC](../evidenz/1C/2026-11-05-labor-pc.md#entscheidungen-nach-design-abschnitt-6-144-und-153); _aktualisiert 2026-11-09:_ angelegt als [#18](https://github.com/NiklasSkulll/arsnova.eu/issues/18)). Geprüft werden soll Lösungsoption 1: das Fensterende der Blitzlicht-Quelle aus einem gespeicherten Zeitpunkt der Runde statt aus der Uhr ableiten ([Issue-Entwurf T3.1, Lösungsoptionen](../evidenz/1C/issue-t3-1-entwurf.md#lösungsoptionen)). Die Optionswahl ist ein KI-Vorschlag des Entwurfs; die Bestätigung durch den Autor steht aus ([KI-Nutzung Teil 3](../evidenz/1C/2026-10-24-teil3.md#ki-nutzung)). Umgesetzt ist nichts. _Aktualisiert 2026-11-12:_ Ersetzt den Satz „die Bestätigung durch den Autor steht aus“: Der Autor hat Issue #18 wie angelegt bestätigt. Lösungsoption 1 bleibt der zu prüfende Kandidat; die endgültige Wahl der Fix-Option überlässt der Autor bewusst dem, der den Fix umsetzt (vgl. [1C-004](1C-004-empfehlung-statt-patch.md)).

## Alternativen

- **Option 2, offenes Fenster im Vertrag:** Vertragsänderung in `libs/shared-types` an der Modellschnittstelle; mittlere Kosten. **Option 3, Fensterende aus Hash und `sourceRevision` ausnehmen:** widerspricht der dokumentierten Absicht, dass Intervallgrenzen den Umfang definieren, und träfe andere Quellen mit echten Intervallen mit ([Issue-Entwurf T3.1](../evidenz/1C/issue-t3-1-entwurf.md#lösungsoptionen)).
- **Hashgrenze allgemein lockern (Kandidat K1 aus M7, [1C-017](1C-017-m7-empfehlung-zurueckgehalten.md)):** behebt T3.1 nicht; hier ändert das Fensterende den Hash, nicht eine Stimme ([Teil 3, Entscheidung Punkt 3](../evidenz/1C/2026-10-24-teil3.md#entscheidung)).
- **Beibehaltung:** verworfen, weil die Zusammenfassung während einer laufenden Nicht-TEMPO-Runde nie eine Modellaussage liefert, obwohl die Inferenz läuft.

## Belege

- **Mutationsprobe:** Fensterende unabhängig vom Aufbauzeitpunkt → Negativprobe rot, Kontrolle grün; im Szenario ist das Fensterende die einzige Ursache ([Befund T3.1](../evidenz/1C/2026-10-24-teil3.md#befund-t31--zeitabhängige-sourcerevision-bei-aktiver-blitzlicht-runde)).
- **Echter Pfad, K_L5** (k(YESNO) = n, k(TEMPO) = 0, n = 5 je Arm):
  - Laptop: YESNO 5 von 5 `source_changed`, TEMPO 5 von 5 `full-context`; der erste YESNO-Lauf erreichte das Modell nicht (Runtime nach OOM-Neustart noch nicht bereit) ([L5 Laptop](../evidenz/1C/2026-11-05-labor.md#l5-t31-auf-dem-echten-pfad)).
  - PC: dieselbe Verteilung, alle 10 Läufe mit Modellantwort, also ohne die Laptop-Einschränkung ([L5 PC](../evidenz/1C/2026-11-05-labor-pc.md#l5-t31-auf-dem-echten-pfad)).

## Ursachenkette

Beobachtung: In E15 endet ein Job `source_changed`, obwohl sich nichts geändert hat; zwei Aufbauten im Abstand von 1,5 s unterscheiden sich in `sourceRevision` und im Ende des Blitzlicht-Zeitfensters → Hypothese: `to = max(roundStartedAt, observedAt)` mit `observedAt` = Aufbauzeitpunkt macht den Hash zeitabhängig → Versuch: Negativprobe (`YESNO`, 0 Stimmen) und Kontrolle (`TEMPO`), dazu die Mutationsprobe → Ergebnis: Mechanismus am Code und dynamisch bestätigt ([Befund T3.1](../evidenz/1C/2026-10-24-teil3.md#befund-t31--zeitabhängige-sourcerevision-bei-aktiver-blitzlicht-runde)), danach auf dem echten Pfad auf beiden Rechnern (L5) → Empfehlung.

## Folgen

- **Kosten der Empfehlung (Option 1):** gering, eine Stelle in `loadQuickFeedbackModerationSnapshot`, Negativprobe umschreiben, Unit-Test für zwei gleiche Hashes ([Issue-Entwurf T3.1](../evidenz/1C/issue-t3-1-entwurf.md#lösungsoptionen)).
- **Kosten heute:** Jede betroffene Inferenz läuft und wird verworfen; zur Größenordnung beträgt die Inferenz der Referenzfixture im Median 163,4 s (Laptop) bzw. 98,8 s (PC) ([Kennzahlen](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)).
- **Risiko bei Option 1:** Das Fenster beschreibt die Laufzeit der Runde nicht mehr; ob Kompassregeln oder das Modell die Fensterlänge nutzen, ist nicht geprüft. Ohne gespeicherten Zeitpunkt der letzten Stimme ist `to = from` nur ein Notbehelf ([Issue-Entwurf T3.1, Lösungsoptionen](../evidenz/1C/issue-t3-1-entwurf.md#lösungsoptionen)). **Rückweg:** Revert.
- **Gültigkeitsgrenze:** getestet ist nur `YESNO`; die übrigen Nicht-TEMPO-Typen folgen aus dem Code, dynamisch geprüft sind sie nicht. Wie oft in echten Vorlesungen eine solche Runde läuft, während eine Zusammenfassung angefordert wird, ist nicht gemessen ([Befund T3.1](../evidenz/1C/2026-10-24-teil3.md#befund-t31--zeitabhängige-sourcerevision-bei-aktiver-blitzlicht-runde)).
- **Issue-Entwurf:** [`issue-t3-1-entwurf.md`](../evidenz/1C/issue-t3-1-entwurf.md), nicht angelegt. _Aktualisiert 2026-11-09:_ angelegt als [#18](https://github.com/NiklasSkulll/arsnova.eu/issues/18) im Fork (Unter-Issue von #10; ursprünglich englisch, seit 2026-11-10 deutsch); die Optionswahl ist dort als offen markiert.
- _Aktualisiert 2026-11-06:_ Auf upstream `44c0a796` besteht der Befund weiter. Dort entfällt der Blitzlicht-Bereich im YESNO-Arm aus Budgetgründen ganz aus dem Modellkontext, der Hash ändert sich trotzdem bei jedem Aufbau; das Modell sieht die zeitabhängige Quelle also nicht, die Antwort wird trotzdem verworfen ([Trockenlauf](../evidenz/1C/2026-11-06-trockenlauf-upstream.md#befund-t31-auch-für-einen-nicht-gesendeten-bereich), n = 1, Test-Runtime). _Ergänzt 2026-11-12:_ Die Negativprobe ist dafür angepasst ([1C-025](1C-025-codestand-auf-upstream-aktualisiert.md#entscheidung)).
- _Aktualisiert 2026-11-09:_ Auf dem echten Pfad bestätigt ([Nachlauf, N5](../evidenz/1C/2026-11-09-labor-nachlauf.md#n5-t31-auf-dem-echten-pfad)): `def56700`, echte Runtime, YESNO 5 von 5 `source_changed` bei aus Budgetgründen gekürztem Blitzlicht-Bereich, TEMPO 0 von 5.
