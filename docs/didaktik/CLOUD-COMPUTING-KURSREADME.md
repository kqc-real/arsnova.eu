<!-- markdownlint-disable MD013 MD060 -->

# Cloud Computing an der IU: Kurslandkarte und Konzeptstand

**Zweck:** Verbindlicher Einstieg in die Kursdokumentation und sachlicher Stand der Fallstudie `arsnova.eu` · **Adressaten:** Lehrende, Modulverantwortliche, Tutor:innen sowie Studierende der Informatik und Wirtschaftsinformatik · **Stand:** 2026-08-15

## 1. Geltungsbereich

Das bereitgestellte IU-Modulhandbuch führt **Cloud Computing** im dualen Bachelorstudium als Modul `DSCC0127` mit dem Kurs `DSCC012701`. Verbindlicher Planungsstand der vorliegenden Unterlagen:

| Merkmal                      | Formaler Stand                                                    |
| ---------------------------- | ----------------------------------------------------------------- |
| Umfang                       | 5 CP, 150 Stunden, 2,16 SWS                                       |
| Format                       | Integrierte Vorlesung, Deutsch, keine Zugangsvoraussetzungen      |
| Betreute Zeit                | 13,5 h Präsenz/synchrone Lehre + 13,5 h Tutorium = 36 UE          |
| Selbststudium                | 123 h                                                             |
| Prüfung nach Quellenabgleich | Referat, 15 Minuten je Prüfling; keine Online-Tests als Zulassung |

Der zusätzlich bereitgestellte Referatsleitfaden und die Bewertungsmatrix konkretisieren die planmäßige Prüfung: Einreichung 30 %, Vortrag 30 %, Diskussion 40 %, immer individuelle Bewertung. Die ebenfalls bereitgestellten Workbook-Leitfäden nennen das Cloud-Modul nicht und werden nur angewandt, wenn myCampus für den konkreten Kurslauf tatsächlich Workbook ausweist. Details stehen in den [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md) und der [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md).

Diese Repository-Dokumentation ist ein Lehrentwurf, kein Ersatz für Prüfungsordnung, Modulhandbuch oder die konkrete Zuordnung in myCampus.

Der formale Modulbezug bleibt der Bachelor Informatik. Da auch Studierende der Wirtschaftsinformatik teilnehmen, verbindet der Lehrentwurf technische Cloud-Evidenz verbindlich mit TCO, FinOps, Unit Economics, Risiko, Build/Buy und Exit. Beide Perspektiven werden in gemischten Rollen bearbeitet.

Offizielle Orientierung: [IU Bachelor Informatik – Kursübersicht](https://www.iu-fernstudium.de/bachelor/informatik/).

## 2. Beschlossener Konzeptkern

| Entscheidung      | Konzeptstand                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Format            | zwei Kursläufe, einmal Präsenz und einmal Zoom; jeweils 12 Termine × 3 UE                                   |
| Modalitätsregel   | gleiche Ziele, Inhalte, Zeiten, Agenten, Laborumgebungen, Lernprodukte und Prüfung                          |
| Arbeitsmodell     | ausschließlich KI-Agenten im Sinne des Agentic Software Engineering auf Lehrenden- und Studierendenseite    |
| Lehrvehikel       | `arsnova.eu` als durchgehende reale Fallstudie, nicht als bloße Demo                                        |
| Pflichtabdeckung  | Grundlagen, technologische Voraussetzungen, Serverless, GCP/AWS/Azure sowie Datenwissenschaft/ML            |
| Lernlogik         | Cloud-Grundlagen → agentischer Serveraufbau → Härtung/Messung → wirtschaftliche Entscheidung                |
| Praxis            | isolierte Zielserver werden durch kontrollierte Agenten installiert, gehärtet, geprüft und zurückgebaut     |
| Selbstüberprüfung | nach jedem Termin 30 agentisch erzeugte MC-Test-Fragen aus einer versionierten, autoritativen Materialbasis |
| Lernprodukt       | Formatives Agentic Cloud Engineering Dossier als Arbeitsgrundlage für das Referat                           |
| Prüfungsbasis     | 15 Minuten je Prüfling; Einreichung, Vortrag und Diskussion; Workbook nur nach bestätigter Zuordnung        |
| Providerbezug     | GCP, AWS und Azure verbindlich; Hetzner und OpenStack/Kubernetes als Fall- und Vergleichsoptionen           |
| WI-Integration    | TCO, FinOps, Unit Economics, Sensitivität, Risiko, Build/Buy und Exit beruhen auf technischer Evidenz       |

Zwei **Lehr- und Architekturzielbilder** strukturieren die Fallarbeit:

1. **100 parallele Classrooms mit je 50 Teilnehmenden** in Quiz, Q&A und Blitzlicht;
2. **eine Konferenz-Session mit 5.000 Teilnehmenden**.

Diese Profile sind bewusst kontrastierende Entwurfs- und Testszenarien. Sie sind weder im Produkt-Backlog als zugesagte Kapazität verankert noch durch Lasttests freigegeben.

## 3. Sachstand von arsnova.eu

### 3.1 Implementierter Ist-Betrieb

Der produktive Referenzpfad ist derzeit ein **Single-Host-Deployment**:

- Nginx übernimmt TLS und Reverse Proxy außerhalb des Compose-Stacks.
- Ein App-Container liefert Angular-Frontend, HTTP/tRPC-API, tRPC-WebSockets und Yjs-Relay aus.
- PostgreSQL 16 und Redis 7.4 laufen als eigene Container auf demselben Host.
- Die PDF-Erzeugung ist in einen gehärteten, netzlosen Worker-Container ausgelagert.
- Backups, externe Verfügbarkeitschecks und eine anwendungsnahe Monitoring-/Alarmierungsstrecke sind dokumentiert; die operative W3.7-Webhook-/Timer-Abnahme steht noch aus.

Der Stack ist containerisiert und produktionsnah gehärtet, aber noch keine horizontal skalierende Cloud-Architektur. Session-Signale verwenden im Backend unter anderem prozesslokale `EventEmitter`; außerdem sind Yjs- und PDF-Schutzmechanismen pro Backend-Prozess ausgelegt. Vor mehreren App-Replikaten sind daher ein instanzübergreifender Live-Bus, eindeutige Zuständigkeiten für WebSocket/Yjs-Verbindungen und globale statt prozesslokale Limits zu entwerfen und zu testen.

### 3.2 Evidenz statt Kapazitätsversprechen

| Stufe                  | Nachweis                                                                                                 | Aussage                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Implementiert          | Single-Host-Compose mit App, PostgreSQL, Redis und PDF-Worker                                            | Aktueller Produktionspfad                                                                           |
| Lokal verifiziert      | 500er-Kern- und Regressionsläufe einschließlich Join, Vote, WebSocket/Reconnect, Yjs und Soak-Bausteinen | Belastbare Entwicklungsbaseline, aber kein Produktions-SLO                                          |
| Produktion, historisch | 500 gleichzeitige Joins: 0 Fehler, `p95 = 3,57 s`                                                        | Funktional erfolgreich, damaliges Ziel `p95 < 3 s` verfehlt; kein vollständiger Live-/Vote-Nachweis |
| Offen                  | Formale Sicherheits- und Lastabnahme auf isoliertem Node-24-Zielhost (§6.5)                              | Noch keine Gesamtfreigabe für 500 Teilnehmende im vollständigen Live-Betrieb                        |
| Lehrzielbild           | 100 × 50 sowie 1 × 5.000                                                                                 | Ungetestete Szenarien für Architektur-, Mess- und Kostenentscheidungen                              |

Verbindliche Evidenzquellen:

- [historischer Produktions-Join 2026-05-09](../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md)
- [lokale Baseline-Freigabe 2026-07-12](../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md)
- [formale Sicherheits- und Lasttest-Abnahme](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md)
- [Monitoring-Abnahme W3.7](../implementation/W3.7-MONITORING-ALARMS-ABNAHME.md)

### 3.3 Semesterbegleitendes Studien- und Prüfungsobjekt: von der Begriffswolke zum Moderationskompass

Die [Storys 1.14a–1.14c und 8.9a–8.9c](../../Backlog.md) bilden gemeinsam das verbindende Studienobjekt für Übungen und Referate. Story 1.14a liefert mit Word Cloud 2.1 bis 2.5 die produktive lexikalische Baseline. Story 1.14b liefert die optionale spaCy-Glättung als internen Sidecar auf dem bestehenden Single Host (umgesetzt August 2026, Default aus; Last-, Lizenz- und Fallbackmessungen bleiben Referatsthema). Story 1.14c ergänzt einen host-ausgelösten semantischen Q&A-Themenmodus mit mehrsprachigen Embeddings, deterministischem Clustering und optionaler quellengebundener Labelbildung durch ein Open-Weight-LLM. Die Storys 8.9a–8.9c führen diese Signale in einen zunächst deterministischen und später optional KI-gestützten Moderationskompass über.

Der produktive Single Host für App, PostgreSQL und Redis ist die belegte Baseline und bleibt auch der vorgesehene Betriebsort für den begrenzten spaCy-Sidecar aus 1.14b. Der verteilte Sidecar-Default liefert die MIT-Modelle `de`/`en`; `fr`/`es` nur mit NOTICE- beziehungsweise GPL-Kennzeichnung; das italienische `it_core_news_sm` (CC BY-NC-SA 3.0) gehört nicht in den MIT-Default. Die Studierenden demonstrieren und implementieren für 1.14c sowie optional 8.9b/8.9c schrittweise einen davon getrennten, privat erreichbaren Inferenzserver. 1.14c und 8.9b dürfen dieselbe abgesicherte Serverrolle nutzen, behalten aber getrennte Schemas, Queues, Caches und Modelllebenszyklen. 8.9c verwendet diese Serverrolle über einen getrennten schema- und quellengebundenen Zusammenfassungsvertrag mit eigenem Anfrage-/Ergebnislebenszyklus; Betrieb, Modelllebenszyklus und Servergrenze bleiben bei 1.14c. Eine zusätzliche physische Trennung von PostgreSQL darf als Drei-Server-Variante untersucht werden, ist aber keine bereits umgesetzte Produktionseigenschaft.

Das Studienobjekt wird nicht auf eine Modell-Demo reduziert. Verbindliche Untersuchungsachsen sind:

- reproduzierbares Zwei-Server-Deployment, Netzwerk-/Rechtegrenzen und automatischer Cleanup;
- Qualitätsvergleich von lexikalischer, spaCy-, Encoder-/Clustering- und optionaler LLM-Variante;
- Latenz, Durchsatz, Queue, Cache, CPU, RAM, GPU/VRAM, Netzwerk, Energie und Degradation;
- Live-Regressionsschutz bei langsamem, ueberlastetem oder ausgefallenem Inferenzserver;
- Datenschutz, Bedrohungsmodell, Modell-/Lizenzmanifest und Supply-Chain-Risiken;
- TCO, FinOps, Unit Costs, Auslastung/Leerlauf, Build/Buy, Sensitivität, Lock-in und Exit.

Die Ergebnisse fließen als Messbericht, TCO-/FinOps-Modell und Architecture Decision Record in das formative Agentic Cloud Engineering Dossier ein. Der [kanonische Referatsthemenkatalog](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#41-kanonischer-themenkatalog-für-die-fallstudie-arsnovaeu) schneidet diese Gesamtvision in zwölf prüfbare Leitfragen mit verpflichtender Evidenz und Entscheidung. Die Übungsimplementierung ist weder eine automatische Produktivfreigabe noch ein Kapazitätsversprechen.

## 4. Dokumentationsarchitektur

### Für die Kursdurchführung

1. **Hier starten:** dieses Dokument
2. **Formale Vorgaben und Prüfungsform:** [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md)
3. **Agenten, Serverlabor und Evidenz:** [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md)
4. **Referat vorbereiten, durchführen und bewerten:** [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md)
5. **Modul und Constructive Alignment:** [Bachelor-Konzept 36 UE](./BACHELOR-VORLESUNG-CLOUD-COMPUTING-36-UE-PRAKTIKUM.md)
6. **Präsenz und Zoom gleichwertig umsetzen:** [Durchführungskonzept](./CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md)
7. **Semesterstart in 30 Minuten:** [Dozenten-Quickstart](./dozenten-quickstart-cloud-computing.md)
8. **Durchführung und MC-Test-Vorgaben:** [12 Terminpläne](./vorlesungen-cloud-computing-termine.md)

### Für die Fallstudie

| Frage                                             | Maßgebliches Dokument                                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Was läuft heute?                                  | [Deployment](../deployment-debian-root-server.md), [Produktions-Compose](../../docker-compose.prod.yml), [Architektur-Handbuch](../architecture/handbook.md)                                  |
| Was ist gemessen?                                 | Produktions-Join, lokale Baseline und §6.5-Abnahme aus Abschnitt 3.2                                                                                                                          |
| Warum ist das Cloud Computing?                    | [betriebliche Einordnung](../implementation/CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md)                                                                                                        |
| Wie wird wissenschaftlich argumentiert?           | [akademische Einordnung](../implementation/CLOUD-COMPUTING-EINORDNUNG-AKADEMISCH.md)                                                                                                          |
| Welche Migration ist plausibel?                   | [6R-Einordnung](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md)                                                                                                                           |
| Welche Betriebsmodelle sind vergleichbar?         | [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md), [OpenStack/Kubernetes](../implementation/CLOUD-COMPUTING-OPENSTACK-UND-ALTERNATIVEN.md)                       |
| Wie kann eine Hetzner-Variante kalkuliert werden? | [Stückliste](../implementation/CLOUD-COMPUTING-HETZNER-STUECKLISTE.md), [Kostenrechenblatt](../implementation/CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md)                                     |
| Welches Studienobjekt verbindet die Übungen?      | [Storys 1.14a–1.14c und 8.9a–8.9c](../../Backlog.md), [spaCy-Glättung 1.14b](../features/word-cloud-spacy.md), [Word-Cloud-3.0-Zielbild](../implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md) |
| Welche Referatsthemen werden vergeben?            | [Kanonischer Themenkatalog](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#41-kanonischer-themenkatalog-für-die-fallstudie-arsnovaeu)                                                                  |

Die Kostenunterlagen sind **volatile Rechenbeispiele**, keine Beschaffungsfreigabe und kein Kapazitätsnachweis. Vor jeder Verwendung müssen Preise, Produktverfügbarkeit, Architekturannahmen und Lastdaten neu geprüft werden.

## 5. Noch zu klären

- Prüfungsform des konkreten Kurslaufs in myCampus: Referat gemäß Modulhandbuch oder abweichend Workbook
- bei Referat: Einzel- oder Gruppenformat, Präsentation mit Handout oder Posterpräsentation, Auswahl und individuelle Zuordnung aus dem kanonischen Themenkatalog, Hilfsmittel und Terminierung
- bei einer bestätigten Workbook-Abweichung: kursspezifische Aufgabe und zentraler Bewertungsbogen
- institutionell freigegebene Agenten, Modelle, Datenverarbeitung und Offenlegung in der Prüfung
- Zugangsmodell für identische isolierte Zielserver, Agentenkontrollumgebung und kurzlebige Credentials
- institutionell freigegebene Zoom-, Board-, Untertitel-, Aufzeichnungs- und Ersatzkanal-Konfiguration
- Datenschutz-, Budget- und Kostenfreigabe für Modell- und Providerkonten
- Teamzuschnitt für gemischte Informatik-/Wirtschaftsinformatikgruppen
- Strukturierung der 123 Stunden Selbststudium ohne zusätzliche formale Prüfungsleistung

Diese Punkte blockieren nicht die fachliche Ausarbeitung, müssen aber vor Kursstart beziehungsweise Veröffentlichung der Prüfungsaufgabe entschieden werden.

## 6. Pflegekonvention

- Produktstatus nur mit Link auf Code, Abnahme oder Backlog behaupten.
- `implementiert`, `lokal verifiziert`, `produktiv beobachtet`, `formal abgenommen` und `Zielbild` nicht synonym verwenden.
- Providerpreise mit Datum, Region, Steuerbasis und Quelle kennzeichnen.
- Änderungen am 12-Termine-Raster zuerst im Bachelor-Konzept beschließen und danach in den Minutenplänen ausführen.
- Präsenz und Zoom nicht als getrennte Fachpläne pflegen; Methoden- und Technikvarianten ausschließlich im Durchführungskonzept halten.
- Agentenaufträge, Berechtigungen, Budgets und Abnahmetests zuerst im Agentic-Lehrlabor pflegen und anschließend in den Terminplänen anwenden.
- Vor jedem Semesterstart die Statusmatrix in Abschnitt 3 und alle direkten Repo-Links prüfen.
