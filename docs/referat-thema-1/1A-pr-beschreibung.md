## Zusammenfassung

**Stand: 15.11.2026. Beschreibung des gesamten A1-Branches einschließlich aktueller Messreihe und Abschlussbereinigung. Unabhängige Gesamtprüfung und Reviewbereitschaft sind unten noch nicht bestätigt.**

<!-- Problem und Lösung in wenigen Sätzen beschreiben. -->

- **Problem:** Für Aufgabe 1A fehlte ein reproduzierbarer Nachweis, ob spaCy-Analyse auf dem Anwendungshost die Live-Pfade beeinflusst und welche Ressourcen- und Fehlergrenzen gelten.
- **Lösung:** Vorabvertrag, synthetische Fixture, Last- und Ressourcenwerkzeuge sowie 25 gepaarte Messläufe auf main `a19ca70f` mit prüfsummengestützter Auswertung bereitstellen. H1 verfehlt 1/20, H2 6/40 Vergleiche; die begründete Betriebsentscheidung bleibt `NLP_ENABLED=false`.
- **Bewusste Nicht-Ziele:** Keine Änderung an Anwendungs-APIs, Berechtigungen, Scoring oder UI; keine LLM-Messung, kausale Einzelzuordnung oder Freigabe einer anderen Produktionshardware.

Closes #6

## Risiko und Verträge

<!-- Genau eine Risikostufe auswählen. -->

- [ ] Niedrig – Dokumentation, Texte oder isolierte Änderung ohne geändertes Verhalten
- [x] Mittel – Benutzeroberfläche, Anwendungslogik, Schema, Persistenz oder Konfiguration
- [ ] Hoch – Authentifizierung, Autorisierung, Tokens, WebSockets, Yjs, Redis,
      Datenbankmigrationen, Datenschutz, Deployment oder Sicherheitskonfiguration

**Maßgebliche Quelle und relevante Invarianten:**

Verbindlich sind [Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6), der unveränderte [Versuchsvertrag Version 2](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-experiment-contract.md), der [Vorabnachtrag für main a19ca70f](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.md), seine [Reihendefinition](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json) und die eingefrorene [Fixture](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-fixture.md). Relative und absolute p95-Grenzen gelten gleichzeitig, einschließlich Gleichheit, je Aktion und Block; alle fünf Wiederholungen bleiben erhalten. Fehlende Aktionen und Analysen werden mitgezählt. Die gemessenen Images stammen aus dem unveränderten Fork-`main` `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`. Host-Token, minimale Teilnehmerpayloads und effektive Stimmen werden nicht verändert.

**Betroffene externe Verträge:**

Bestehende tRPC-/WebSocket-Verträge werden von Lastwerkzeugen genutzt, nicht erweitert. Docker-Inspect und cgroup v2 liefern Ressourcenwerte; Unix-HTTP dient dem kontrollierten Verzögerungsproxy. Tests prüfen Erfassung, Abbruch, Zähler und Rückweg. Neue lokale Auswertungsausgaben sind JSON, CSV und Markdown; PDF-Entwürfe werden mit vorhandenen Playwright-/Chart.js-/pdf-parse-Abhängigkeiten erzeugt.

## Implementierung

<!-- Die wichtigsten Änderungen knapp und fachlich beschreiben. -->

- Schritte 1–6: deterministische gemeinsame Fixture, Instrumentierung erfolgreicher und fehlgeschlagener Live-Aktionen, getrennte hostautorisierte Analysen, Ressourcen-Collector, Verzögerungsproxy und automatisierter isolierter Laborablauf mit überprüftem Rückweg.
- Schritt 7: Eingabeintegrität und Rohperzentile erneut prüfen, 80 gepaarte Vergleiche und Ressourcenbudget auswerten; elf relative Grenzverletzungen, davon drei zugleich absolut, dokumentieren.
- Hotpfadtest um Quick Feedback einschließlich Negativprobe erweitern; A1-npm-Befehle und Testintegration ergänzen.
- Anwendung, Compilerkonfigurationen und Produktionsdeployment bleiben unverändert. Der ursprüngliche Frontend-Wording-Test wird entsprechend dem Aufgabenumfang ausschließlich als bestehender Fehler dokumentiert.
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

Die aktuelle [Prüfunterlage](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-pruefstand.md) nennt Befehle, Ergebnisse und
Abgrenzung zu den vom Bearbeiter mitgeteilten allgemeinen Projektchecks.
Alte Prüfprotokolle wurden entfernt und werden nicht als Nachweis dieses Stands verwendet. Die allgemeinen Typecheck-/Build-Erfolge und der Frontend-Testfehler stammen aus den von Niklas mitgeteilten Läufen nach dem main-Merge. Bei der Abschlussbereinigung wurden die Werkzeugprüfungen erneut ausgeführt, kein neuer vollständiger Projektlauf. Daher wird kein erfolgreicher Gesamtcheck behauptet.

| Prüfung/Befehl                                               | Ergebnis                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run load:resource-isolation:fixture:test`               | Exit 0; 9 Tests bestanden                                                                                                                                                          |
| `npm run load:artillery:metrics:test`                        | Exit 0; 12 Tests bestanden                                                                                                                                                         |
| `npm run load:resource-isolation:analysis:test`              | Exit 0; 20 Tests bestanden                                                                                                                                                         |
| `npm run load:resource-isolation:infrastructure:test`        | Exit 0; 22 Tests bestanden                                                                                                                                                         |
| `npm run load:resource-isolation:experiment:test`            | Exit 0; 17 Tests bestanden                                                                                                                                                         |
| `npm run load:resource-isolation:evaluation:test`            | Exit 0; 28 Tests bestanden; insgesamt 108 A1-Werkzeugtests                                                                                                                         |
| Aktuelle Messreihe und Neuauswertung                         | 25 vollständige Läufe, 50 Ressourcen- und 50 Compose-Artefakte; gespeicherte Rechnung vor Werkzeuganpassung byteidentisch reproduziert; danach nur Auswertungscode-Hash abweichend |
| `npm run lint`                                               | Exit 0; ohne Fehler/Warnungen. Temporärer Git-Index berücksichtigte die Skriptlöschungen und den umbenannten Test; echter Staging-Bereich blieb unverändert                        |
| `npm run load:resource-isolation:documents`                  | Exit 0; vier Handoutseiten/1179 Wörter und neun Folien/615 Wörter; Quellenmanifest und Überlauf geprüft                                                                            |
| Prettier, `git diff --check`, Dateiverweise und Hashabgleich | Erfolgreich; 154 Eingabehashes und sieben Dokumentartefakte geprüft; 127 eingefrorene JSON-Dateien vor Formatierung geschützt                                                      |
| Allgemeine Projektchecks nach main-Merge                     | Laut Niklas Typecheck, Lint und Produktionsbuild erfolgreich; keine erneute vollständige Ausführung bei der Abschlussbereinigung                                                   |
| Vollständiger Frontend-Testlauf laut Niklas                  | 2872 bestanden; ein ursprünglicher Korpustest in `session-host.component.spec.ts` scheitert an der Erwartung »viel Zustimmung«. Test unverändert; kein grüner Gesamttest behauptet |

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

- [Aktuelle Messreihe](https://github.com/NiklasSkulll/arsnova.eu/tree/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547/), [JSON](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/auswertung.json) und [CSV](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/live-vergleiche.csv).
- [Betriebsentscheidung](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-auswertung.md), [Prüfstand](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-pruefstand.md), [Gesamtübersicht](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-komplette-Aufgabe-fertig.md).
- [Abgabeentwürfe und Manifest](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/abgabe/README.md), [Eigenanteil](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-eigenanteil.md), [persönliche Prüfung und Übergabe](https://github.com/NiklasSkulll/arsnova.eu/blob/ab1619e7d0c9b3f5081fd0b02137faf59cfbc810/docs/referat-thema-1/1A-abschluss-und-uebergabe.md).

## Nicht zutreffend und verbleibende Risiken

<!-- Jeden nicht ausgeführten, aber naheliegenden Prüfpunkt konkret begründen. -->

- **Nicht zutreffende Prüfungen:** Keine geänderten Anwendungs-API-Schemas, UI-Texte, UI-Templates, Styles oder Fokusabläufe; daher keine neuen manuellen UI-/WCAG-Prüfungen oder Übersetzungen. Keine Migration, Tokenrotation oder Wiederherstellungsfunktion der Anwendung geändert. Für die Werkzeuge sind Abbruch, verspäteter Abschluss, Überlappung, temporäre Sidecar-Nichtverfügbarkeit und isolierter Rückweg durch Tests abgedeckt. V5 war optional und wurde nicht ausgeführt. Die HTML-Vorlagen der Abgabeentwürfe wurden separat durch den PDF-Dokumentbau geprüft; sie sind keine Anwendungs-UI. Keine ESM-Migration vorgenommen.
- **Verbleibende Risiken:** H1/H2 nicht bestätigt; keine Aktivierungsfreigabe. Gemeinsamer WSL2-Rechner, Beitrittswelle und synthetischer Wortschatz begrenzen Kausalität und Übertragbarkeit. V3 verletzt in Block 5 relative und absolute Live-Grenzen; V4 belegt keine tatsächlich weitergeleitete spaCy-Berechnung. Der ursprüngliche Frontend-Wording-Test bleibt fehlgeschlagen und unverändert. Ein neuer grüner Gesamttest oder CI-Lauf wird nicht behauptet. Persönliche Gegenprüfung, erlaubter KI-Umfang, institutionelle Abgabe, Abstimmung mit 1B/1C sowie unabhängige Prüfung des endgültigen Gesamtdiffs und tatsächlicher Merge bleiben separat.

## Selbstreview

Die unabhängige Prüfung des endgültigen Gesamtdiffs und die abschließende Reviewbereitschaft sind noch offen. Diese beiden Bestätigungen werden nicht durch die Prüfung dieser PR-Beschreibung ersetzt.

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

## Eigenanteil

### Aufgabe und Beitrag

Umsetzung der Aufgabe 1A erfolgte durch Vibe-Coding mit **GPT-6.1 Sol (OpenAI, 2026b)** in **Codex (OpenAI, 2026a)**.

> - OpenAI. (2026a). Codex [KI-gestützter Programmierassistent]. https://chatgpt.com/codex
> - OpenAI. (2026b). GPT-6.1 Sol [Large language model]. https://developers.openai.com/api/docs/models/gpt-6.1-sol

- **Aufgabe:** 1A – Ressourcenisolation auf dem Anwendungshost, zugeordnet zu **[Niklas Schneider](https://github.com/NiklasSkulll)** gemäß `docs/referat-thema-1/01-aufteilung.md`.
- **Änderungen und Zweck:**
  - **Reproduzierbares Versuchsdesign:** Hypothesen, Gegenalternative, synthetische Fixture, Seed und Schwellen vorab festgelegt. Belege: `1A-experiment-contract.md`, aktueller Vorabnachtrag unter `specs/`; Commits `2372a037`, `e48bae72`, `e3b27b32`.
  - **Live- und Analyseinstrumentierung:** Rohzeiten, Fehler und geplante Arbeit für Beitritt, Quiz, Q&A und Tempo sowie getrennte hostautorisierte Analyseanfragen ergänzt. Belege: `scripts/load/artillery/processor.mjs`, `host-analyze-loop.mjs`; Commits `4db4c379`, `2efc08b5`.
  - **Ressourcenmessung und Varianten:** CPU, RAM, Drosselung und OOM erfasst; CPU-Begrenzung und Weiterleitungsverzögerung im isolierten Labor untersucht. Belege: `scripts/load/lib/container-metrics.mjs`, `spacy-delay-proxy.mjs`; Commit `58c95246`.
  - **Laborablauf und Nachweise:** Vorlauf, randomisierte Varianten, Manifestierung, tatsächliche Compose-Aufnahmen und überprüften Rückweg automatisiert. Belege: `scripts/load/run-resource-isolation.mjs`; Commits `35271586`, `e3b27b32`, `37f2c534`.
  - **Auswertung und Abschluss:** Gepaarte Vergleiche, Betriebsentscheidung, Abgabeentwürfe und aktuelle Dokumentation erstellt; überholte Nachweise entfernt und die Integrität hashgebundener Rohdateien wiederhergestellt. Belege: `scripts/load/evaluate-resource-isolation.mjs`, `docs/referat-thema-1/1A-auswertung.md`; Commits `97bfcfc9`, `ab1619e7`.
- **Belege:** Die [Gesamtübersicht](docs/referat-thema-1/1A-komplette-Aufgabe-fertig.md) (Commit `ab1619e7`) ordnet die sieben Umsetzungsschritte ihren Dateien und Befehlen zu.
- **Gemeinschaftliche oder unklare Anteile:** Die Anwendung, spaCy und die sechs Referenzfragen sind übernommenes Projektmaterial. Fixture und Live-Werkzeuge sind gemeinsame Artefakte für die Aufträge. Die separate 1C Aufgabe stammt von **[Jonas](https://github.com/jonasyr)**. **[Niklas Schneider](https://github.com/NiklasSkulll)** setzte Aufgabe 1A um.

### Prüfgrundlage

- `feature-1A-resource-isolation@ab1619e7d0c9b3f5081fd0b02137faf59cfbc810` gegenüber `origin/main@a19ca70ff37dcb5510a77ab2745c06b70ccc3565`.
- **Merge-Base:** `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`.
- **Vergleichswahl:** `git diff origin/main...HEAD` wurde verwendet. Die GitHub-CLI bestätigte denselben aktuellen Remote-main-Commit. Übernommene Upstream- und 1C-Änderungen werden damit nicht dem A1-Beitrag zugerechnet. Im Anwendungsbereich betrifft der verbleibende Diff ausschließlich den erweiterten Backend-Isolationstest.
- **Nicht committete Änderungen:** Keine.
- **Vorgaben und Aufgabendokumentation:** `00-rahmen-und-pruefung.md`, `01-aufteilung.md`, `1A-ressourcenisolation-app-host.md`, Prüfungsspezifikation Abschnitt 4.1.3 und Gruppenauftrag 1A sowie das erneut per GitHub-CLI gelesene Issue #6. Die individuelle Beweiskette entspricht diesen Vorgaben. Abweichend vom ursprünglichen Release-1.3-Kontext wurde die laut Issue freigegebene aktuelle main-Baseline, Version 1.4.0, auf dem eigenen Rechner untersucht.
- **Datumsprüfung:** Die Laufmanifeste datieren die aktuellen Messfenster auf den **15.11.2026**; der Gesamtnachweis meldet `complete: true`. Messdaten wurden in `37f2c534`, die Bereinigung in `ab1619e7` versioniert. Das belegt den technischen Arbeitsstand, keine persönliche Abgabe oder abgeschlossene Prüfung.

### Anforderungsabgleich

- **Abgedeckt – Dienste und Systemgrenzen:** App, Datenhaltung, PDF-Worker, spaCy, 8.9b, Kontextaufbau und Encoder sind eingeordnet; generative Inferenz bleibt getrennt. Beleg: `1A-auswertung.md`, Abschnitt „Systemgrenzen und Labor“.
- **Abgedeckt – vorab festgelegter Vergleich:** Vertrag, Fixture und aktueller Nachtrag legen Hypothesen, Last, Varianten und Schwellen fest. Ihre Identitäten sind in den Manifesten gebunden.
- **Abgedeckt – ausführbare Untersuchung:** Vollständiger passender Vorlauf und fünf randomisierte V0–V4-Blöcke mit insgesamt 25 Messläufen liegen vor.
- **Abgedeckt – Messwerte und Nachweiskette:** Live-Rohzeiten, Fehler, Analyseergebnisse, Ressourcenzeitreihen, 50 Compose-Aufnahmen der Hauptreihe und Rückwegprüfungen sind vorhanden. Beleg: `docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547/`.
- **Teilweise abgedeckt – Ursachen trennen:** Die kontrollierten Varianten unterscheiden Analyse- und Sidecar-Pfad. Sie identifizieren jedoch keine einzelne Ursache einer Live-Verzögerung. V4 untersucht Timeout und Rückstau vor der Weiterleitung, keine tatsächlich langsam rechnende spaCy-Inferenz.
- **Abgedeckt – begründete Betriebsentscheidung:** Ressourcenbudget, Betriebsaufwand, Deaktivierungsalternative und Gültigkeitsgrenzen sind dokumentiert. Nicht bestätigte Hypothesen werden als Ergebnis erhalten.
- **Teilweise abgedeckt – gemeinsame Artefakte:** Bereitstellung und Kennzeichnung sind vorhanden; tatsächliche Abstimmung und Übernahme mit 1B/1C sind noch zu bestätigen.
- **Teilweise abgedeckt – Abgabe:** Aktuelle Handout- und Folienentwürfe mit KI-Offenlegung liegen vor. Persönliche Gegenprüfung, institutionelle Vorgaben und tatsächliche Einreichung sind nicht nachgewiesen.
- **Nicht abgedeckt – GitHub-Abschluss:** Issue #6 ist offen. Die GitHub-CLI fand keine PR für diesen Branch; ein Merge ist nicht belegt.
- **Nicht anwendbar – zusätzliche Leistungsbehauptungen:** Produktionspatch, LLM-Tragfähigkeit, Browser-Rendering und Kapazitätsfreigabe einer dedizierten 8-vCPU-Maschine gehören nicht zum belegten Ergebnis.

### Tests

- **Tests:** Fixture-, Live-Metrik-, Analyse-, Infrastruktur-, Experiment-, Auswertungs-, Vorlagen- und Compose-Prüfungen. Konkrete Regressionen prüfen unter anderem vorhandene Laborcontainer, fehlende Vorlaufnachweise, beschädigte Ressourcen-/Compose-Dateien und vermischte Reihendefinitionen.
- **Zusätzlicher Anwendungstest:** `apps/backend/src/__tests__/wordCloud.hotpath-isolation.test.ts` wurde um Quick Feedback und die Negativprobe „erkennt einen direkten Inferenzimport auch im Quick-Feedback-Router“ erweitert. Seine Existenz wird nicht mit einer erneuten Ausführung in diesem Audit gleichgesetzt.
- **Status:** Die Abschlussprüfung mit **108 bestandenen A1-Werkzeugtests**, Lint und Dokumentbau ist in `1A-pruefstand.md` dokumentiert und mit `ab1619e7` versioniert. In dieser Auswertung wurden keine Tests erneut gestartet; erneut geprüft wurden Git-Stand, Quellen, GitHub-Status und sämtliche **154 Eingabehashes** der gespeicherten Auswertung.
- **Ergebnis:** Alle 154 Eingabehashes stimmen aktuell. Der Dokumentbau ist mit vier Handoutseiten und neun Folien dokumentiert. Laut den mitgeteilten allgemeinen Projektläufen bestanden Typecheck und Produktionsbuild; der vollständige Frontend-Lauf hatte **2872 erfolgreiche Tests und einen ursprünglichen Wording-Testfehler**. Ein grüner Gesamttest oder aktueller erfolgreicher CI-Lauf wird nicht behauptet.

### Individuelle Beweiskette

- **Hypothese:** H1 prüft normalen spaCy-Betrieb, H2 CPU-Drosselung und Verzögerung gegen V1; Beleg: `1A-experiment-contract.md`.
- **Gegenhypothese:** Die ernsthafte Gegenalternative ist `NLP_ENABLED=false` mit lexikalischer Wortwolke und geringerem Sidecar-Betriebsaufwand.
- **Eigener ausführbarer Test:** A1-spezifische Werkzeuge und Regressionstests im zugeordneten Branch, transparent agentengestützt entwickelt. Keine Behauptung ausschließlich manueller Erstellung.
- **Eigener Baseline-Lauf:** V0/V1 der aktuellen Reihe auf unveränderter Anwendungsbaseline `a19ca70f`; identische Eingaben und vergleichbare Lastbedingungen.
- **Fehler/Variante:** V2 regulär, V3 mit 0,25 CPU, V4 mit 6000-ms-Weiterleitungsverzögerung bei 5000-ms-Client-Timeout. V5 war optional und wurde nicht ausgeführt.
- **Ergebnis mit Gültigkeitsgrenze:** H1 verfehlt **1/20**, H2 **6/40** Vergleiche. Drei V3-Vergleiche verletzen zusätzlich die absolute 50-ms-Regel. Alle 40.000 geplanten Live-Aktionen wurden erfolgreich erfasst. Gemeinsamer WSL2-Rechner mit 16 logischen CPUs, Beitrittswelle und synthetischer Wortschatz begrenzen Übertragbarkeit und Kausalität.
- **Entscheidung:** Lexikalische Alternative beibehalten. Das reguläre spaCy-Ressourcenbudget besteht, deckt aber die Aktivierung nach sämtlichen vorab festgelegten Regeln nicht. Die 0,25-CPU-Variante ist keine belegte gleichwertige Einsparung; zusätzliche LLM-Last oder kleinere RAM-Limits werden nicht freigegeben.

### Offen

- **Technisch:** Ursprünglicher Frontend-Wording-Testfehler; kein belegter grüner Gesamttest/CI-Stand. Unabhängige Prüfung des endgültigen Gesamtdiffs und abschließende Reviewbereitschaft sind noch unbestätigt; deshalb besteht das PR-Template-Gate derzeit nicht vollständig. PR und Merge sind nicht nachgewiesen.
- **Dokumentation und Prüfungsnachweise:** Die aktuelle PR-Beschreibungsänderung ist noch nicht committet. Persönliche Gegenprüfung und fachliche Vertretung, erlaubter KI-Umfang, formale Abgabe sowie Abstimmung gemeinsamer Artefakte bleiben gemäß `1A-abschluss-und-uebergabe.md` offen. Die zusätzlichen 1B-Schritte 3–4 werden durch A1 nicht erledigt.

### Leistungsnachweis

- Im **[Niklas Schneider](https://github.com/NiklasSkulll)** zugeordneten A1-Branch entstand eine reproduzierbare, agentengestützt entwickelte Untersuchung mit eigenem Laborlauf, vollständigen Messnachweisen und einer auf unveränderten Kriterien beruhenden Betriebsentscheidung.
- Der belegte Nutzen liegt in der nachvollziehbaren Bewertung des spaCy-Betriebs einschließlich negativer Ergebnisse und klarer Gültigkeitsgrenzen; persönliche Prüfungsleistung und institutionelle Anerkennung werden dadurch nicht vorweggenommen.
