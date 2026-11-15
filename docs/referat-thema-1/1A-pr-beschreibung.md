## Zusammenfassung

**Lokaler Entwurf für den gesamten A1-Branch, aktualisiert 15.11.2026. Endgültige unabhängige Gesamtprüfung, persönliche Freigabe und Merge bleiben gesondert.**

<!-- Problem und Lösung in wenigen Sätzen beschreiben. -->

- **Problem:** Für Aufgabe 1A fehlte ein reproduzierbarer Nachweis, ob spaCy-Analyse auf dem Anwendungshost die Live-Pfade beeinflusst und welche Ressourcen- und Fehlergrenzen gelten.
- **Lösung:** Vorabvertrag, synthetische Fixture, Last- und Ressourcenwerkzeuge sowie 25 gepaarte Messläufe mit prüfsummengestützter Auswertung bereitstellen. H1/H2 werden nicht bestätigt; die begründete Betriebsentscheidung bleibt `NLP_ENABLED=false`.
- **Bewusste Nicht-Ziele:** Keine Änderung an Anwendungs-APIs, Berechtigungen, Scoring oder UI; keine LLM-Messung, kausale Einzelzuordnung oder Freigabe einer anderen Produktionshardware. Closes #6 nach fachlicher Freigabe und Merge.

## Risiko und Verträge

<!-- Genau eine Risikostufe auswählen. -->

- [ ] Niedrig – Dokumentation, Texte oder isolierte Änderung ohne geändertes Verhalten
- [x] Mittel – Benutzeroberfläche, Anwendungslogik, Schema, Persistenz oder Konfiguration
- [ ] Hoch – Authentifizierung, Autorisierung, Tokens, WebSockets, Yjs, Redis,
      Datenbankmigrationen, Datenschutz, Deployment oder Sicherheitskonfiguration

**Maßgebliche Quelle und relevante Invarianten:**

Verbindlich sind Issue #6, der unveränderte A1-Versuchsvertrag Version 2 und die eingefrorene Fixture. Relative und absolute p95-Grenzen gelten gleichzeitig, einschließlich Gleichheit, je Aktion und Block; alle fünf Wiederholungen bleiben erhalten. Fehlende Aktionen und Analysen werden mitgezählt. Die gemessenen Images stammen aus dem unveränderten Fork-`main` `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`. Host-Token, minimale Teilnehmerpayloads und effektive Stimmen werden nicht verändert.

**Betroffene externe Verträge:**

Bestehende tRPC-/WebSocket-Verträge werden von Lastwerkzeugen genutzt, nicht erweitert. Docker-Inspect und cgroup v2 liefern Ressourcenwerte; Unix-HTTP dient dem kontrollierten Verzögerungsproxy. Tests prüfen Erfassung, Abbruch, Zähler und Rückweg. Neue lokale Auswertungsausgaben sind JSON, CSV und Markdown; PDF-Entwürfe werden mit vorhandenen Playwright-/Chart.js-/pdf-parse-Abhängigkeiten erzeugt.

## Implementierung

<!-- Die wichtigsten Änderungen knapp und fachlich beschreiben. -->

- Schritte 1–6: deterministische gemeinsame Fixture, Instrumentierung erfolgreicher und fehlgeschlagener Live-Aktionen, getrennte hostautorisierte Analysen, Ressourcen-Collector, Verzögerungsproxy und automatisierter isolierter Laborablauf mit überprüftem Rückweg.
- Schritt 7: Eingabeintegrität und Rohperzentile erneut prüfen, 80 gepaarte Vergleiche und Ressourcenbudget auswerten; elf relative Grenzverletzungen, davon drei zugleich absolut, dokumentieren.
- Hotpfadtest um Quick Feedback einschließlich Negativprobe erweitern; A1-npm-Befehle und Testintegration ergänzen.
- Zwischenzeitliche Compilerkorrekturen und die sachfremde Frontend-Testkorrektur wurden verworfen; diese Dateien sind nicht Bestandteil der A1-Produktionsänderungen. Keine Anwendungs-Laufzeitlogik geändert.
- Auswertung, PDF-Abgabeentwürfe mit bearbeitbaren Vorlagen, Eigenanteils-/KI-Nachweis, Gesamtübersicht und Prüfprotokoll ergänzen.
- Vor jeder Phase tatsächlich aufgelöstes Compose bereinigt speichern; 50 Aufnahmen der Hauptreihe über Hashes und Dienstmanifeste prüfen. Alte Reihen und das überholte Rekonstruktionswerkzeug entfernen.
- Hashgebundene Roh-JSON-Dateien von Prettier ausnehmen; umformatierte Dateien nur anhand bereits vorhandener passender SHA-256 in ihre belegten Originalbytes zurücksetzen.
- Freigabestand in Rahmen/Aufteilung synchronisieren sowie persönliche Prüfliste und gemeinsame Übergabeunterlage erstellen.

## Verhaltens- und Abdeckungsprüfung

- [x] Gewünschtes Verhalten und maßgebliche Quelle wurden vor der Implementierung geklärt
- [x] Vergleichbare Implementierungen und betroffene Aufrufpfade wurden geprüft
- [x] Erfolgsfall wurde getestet
- [x] Ablehnungs-, Fehler- oder ungültiger Eingabepfad wurde getestet oder unter
      „Nicht zutreffend“ begründet
- [x] Ein Regressionstest bildet bei einer Fehlerbehebung den ursprünglichen
      Fehler ab
- [x] Relevante Zustandsübergänge wurden geprüft

### Relevante Zustandsübergänge

<!-- Zutreffendes markieren. Nicht markierte, naheliegende Punkte unten begründen. -->

- [ ] Nicht zustandsbehaftete Änderung
- [x] Wiederholung oder doppelte Anfrage
- [ ] Neuladen und Wiederherstellung
- [ ] Reconnect oder Verbindungsersetzung
- [ ] Token- oder Capability-Rotation
- [x] Ablauf und Bereinigung
- [ ] Migration oder Legacy-Daten
- [x] Parallelität oder Race Conditions
- [x] Abhängigkeit vorübergehend nicht verfügbar
- [x] Asynchroner Ablauf: Pending → Erfolg → Ablehnung/Timeout → Retry oder Abbruch
- [ ] DOM-Ersetzung: nach Erfolg und Fehler existiert ein sichtbares,
      nicht verdecktes und fachlich sinnvolles Fokusziel

## Validierung

<!-- Nur tatsächlich im aktuellen Branch ausgeführte Prüfungen markieren. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [x] `npm run lint`
- [ ] `npm run build:prod` bei Frontend-, i18n-, Build- oder Produktionsänderungen
- [x] Betroffene Unit-, Integrations- oder Contract-Tests ergänzt beziehungsweise aktualisiert

### Ausgeführte Prüfungen und Ergebnisse

Die aktuelle [Prüfunterlage](./1A-pruefstand.md) nennt Befehle, Ergebnisse und
Abgrenzung zu den vom Bearbeiter mitgeteilten allgemeinen Projektchecks.
Alte Prüfprotokolle wurden entfernt und werden nicht als Nachweis dieses Stands verwendet.

| Prüfung/Befehl                                   | Ergebnis                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Aktuelle Messreihe und Neuauswertung             | 25 vollständige Läufe, 50 Ressourcen- und 50 Compose-Artefakte; gespeicherte Rechnung vor Werkzeuganpassung byteidentisch reproduziert |
| Aktuelle A1-Werkzeugtests, Lint und Formatierung | Konkrete Abschlussergebnisse siehe [Prüfstand](./1A-pruefstand.md)                                                                     |
| Dokumentbau                                      | Aktuelle Messquelle; vier Handoutseiten und neun Folien, mit Quellenmanifest geprüft                                                   |
| Allgemeine Projektchecks nach main-Merge         | Laut Nutzer Typecheck, Lint und Produktionsbuild erfolgreich; kein neuer vollständiger Projektlauf bei dieser Bereinigung              |
| Vollständiger Frontend-Testlauf laut Nutzer      | 2872 bestanden, ein ursprünglicher Wording-Test fehlgeschlagen; unverändert, kein grüner Gesamttest behauptet                          |

<!-- Keine Prüfung als erfolgreich angeben, wenn sie nicht ausgeführt wurde. -->

## Risikobezogene Prüfungen

<!-- Zutreffende Prüfungen markieren und unter „Nachweise“ belegen. -->

- [x] Keine Benutzeroberflächenänderung oder mobile Darstellung geprüft
- [x] Keine relevante Änderung oder Tastatursteuerung und Fokusverhalten geprüft
- [x] Keine relevante Änderung oder Screenreader-Semantik geprüft
- [x] Keine relevante Änderung oder Reflow, Zoom und Kontrast geprüft
- [x] Keine Realtime-Änderung oder WebSocket-/Yjs-Szenarien geprüft
- [x] Keine Migrationsänderung oder Prisma-Migrationskette auf einer frischen
      Datenbank geprüft
- [x] Keine lastrelevante Änderung oder Last-/Performance-Budget geprüft
- [x] Keine Textänderung oder alle Locales (`de`, `en`, `fr`, `es`, `it`)
      synchronisiert
- [x] Keine Änderung externer Verträge oder Vertrag anhand einer maßgeblichen
      Spezifikation beziehungsweise eines Contract-Tests geprüft
- [x] Keine sicherheitsrelevante Änderung oder erlaubte und abgelehnte
      Sicherheitsgrenze getestet

## Betrieb und Rollback

- **Auswirkung auf Produktion:** Keine Aktivierung oder Änderung laufender Produktionsdienste. Messungen betreffen ein eigenes temporäres Labor; produktive Compilerkonfiguration, Anwendung und Deployment werden durch diesen Abschluss nicht geändert. Das Experiment ist keine Produktionskapazitätsfreigabe.
- **Erforderliche Konfigurations- oder Deployment-Schritte:** Keine Migration oder neue Produktionsvariable. Für Wiederholungen ausschließlich neue eigene Laborressourcen und private Konfiguration gemäß Versuchsanleitung verwenden. Generator und Dienste konkurrieren auf demselben WSL2-Host.
- **Beobachtbarkeit beziehungsweise relevante Logs/Metriken:** Versionierte synthetische Laufmanifeste, Roh-Laufzeiten, Analyseergebnisse, gzip-Ressourcenzeitreihen, Rückwegnachweise und abgeleitete Berichte mit Quellenhashes. Keine persönlichen Daten oder betrieblichen Zugangsdaten aufnehmen.
- **Rollback:** Neue Werkzeuge werden nur explizit gestartet. Labor-Rückweg beendet Last und Proxy, stellt Limits/Socket wieder her, deaktiviert NLP, prüft Basisdienste und Live-Beitritt und entfernt ausschließlich eigene Laborressourcen. Für A1-Werkzeuge, npm-Skripte und den Isolationstest den betreffenden Commit zurücknehmen und passende Prüfungen wiederholen; es gibt keine Datenmigration.

- [x] Keine neuen Secrets, Zugangsdaten, `.env`-Inhalte, Dumps oder lokalen
      Artefakte eingecheckt
- [x] `.env.production.example`, Deployment-Dateien und Betriebsdokumentation
      sind aktuell oder nicht betroffen
- [x] Shared-NAT-Betrieb und mindestens 500 gleichzeitige Hörsaal-Clients sind
      nicht betroffen oder wurden berücksichtigt

## Nachweise

- [Aktuelle Messreihe](./evidenz/1A/reihe-main-a19ca70f-20261115-122547/), [JSON](./evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/auswertung.json) und [CSV](./evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/live-vergleiche.csv).
- [Betriebsentscheidung](./1A-auswertung.md), [Prüfstand](./1A-pruefstand.md), [Gesamtübersicht](./1A-komplette-Aufgabe-fertig.md).
- [Abgabeentwürfe und Manifest](./abgabe/README.md), [Eigenanteil](./1A-eigenanteil.md), [persönliche Prüfung und Übergabe](./1A-abschluss-und-uebergabe.md).

## Nicht zutreffend und verbleibende Risiken

<!-- Jeden nicht ausgeführten, aber naheliegenden Prüfpunkt konkret begründen. -->

- **Nicht zutreffende Prüfungen:** Keine geänderten API-Schemas, UI-Texte, Templates, Styles oder Fokusabläufe; daher keine neuen manuellen UI-/WCAG-Prüfungen oder Übersetzungen. Keine Migration, Tokenrotation oder Wiederherstellungsfunktion der Anwendung geändert. Für die Werkzeuge sind Abbruch, verspäteter Abschluss, Überlappung, temporäre Sidecar-Nichtverfügbarkeit und isolierter Rückweg durch Tests abgedeckt. V5 war optional und wurde nicht ausgeführt. Keine ESM-Migration vorgenommen.
- **Verbleibende Risiken:** H1/H2 nicht bestätigt; keine Aktivierungsfreigabe. Gemeinsamer WSL2-Rechner, Beitrittswelle und synthetischer Wortschatz begrenzen Kausalität und Übertragbarkeit. V3 verletzt in Block 5 relative und absolute Live-Grenzen; V4 belegt keine tatsächlich weitergeleitete spaCy-Berechnung. Der ursprüngliche Frontend-Wording-Test bleibt fehlgeschlagen und unverändert. Ein neuer grüner Gesamttest oder CI-Lauf wird nicht behauptet. Persönliche Gegenprüfung, erlaubter KI-Umfang, institutionelle Abgabe, Abstimmung mit 1B/1C sowie unabhängige Prüfung des endgültigen Gesamtdiffs und tatsächlicher Merge bleiben separat.

## Selbstreview

- [ ] Der vollständige Diff wurde unabhängig noch einmal geprüft
- [x] Aufgabenstellung und Akzeptanzkriterien wurden erneut mit dem Ergebnis verglichen
- [x] Code, Tests, Schemas, Dokumentation, Konfiguration, Übersetzungen und
      PR-Beschreibung widersprechen sich nicht
- [x] Vergleichbare Pfade enthalten den behobenen Fehler nicht weiterhin
- [x] Temporärer Code, Debug-Ausgaben und überholte Kommentare wurden entfernt
- [x] Sicherheits-, Barrierefreiheits-, Kompatibilitäts- und
      Performanceaussagen sind durch Nachweise gedeckt
- [ ] Der PR ist vollständig und bereit für ein Review
- [x] Keine asynchrone UI-Änderung oder Erfolg, Pending, Fehler und Fokus wurden
      anhand des tatsächlichen DOM-Ablaufs geprüft
