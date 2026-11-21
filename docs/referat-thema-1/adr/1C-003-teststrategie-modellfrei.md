# 1C-003: Teststrategie modellfrei mit Test-Runtime, gekennzeichnete Negativproben, Echtpfad im Labor

- **Status:** methodisch (2026-11-05)
- **Kategorie:** Methodik

## Kontext

Auftrag 1C verlangt, Fehler- und Konsistenzverhalten zu prüfen (inkompatible Schemaversion, fehlender Kontextbereich, langsamer Empfänger, kein stiller Feldverlust, Host wartet nicht, Stimmenänderung und Quellenlöschung) und je Person mindestens einen eigenen ausführbaren Test und eine Untersuchung mit Hypothese, Gegenalternative, Befund mit Gültigkeitsgrenze und Entscheidung ([Tests-Design, Zweck](../specs/2026-10-24-1c-tests-design.md#1-zweck-und-begründung)). Eine Laborinstanz stand zu Beginn nicht fest. Das Dossier hatte Testlücken G1 bis G11 ausgewiesen und ein Versuchsdesign nur als Vorschlag formuliert ([Dossier 10](../1C/1C-kontext-und-adapterpfad.md#10-testlücken-gegenüber-dem-auftrag-geprüft), [Dossier 11](../1C/1C-kontext-und-adapterpfad.md#11-vorschlag-versuchsdesign-labor-synthetische-daten)).

## Entscheidung

Die Aussagen werden zuerst modellfrei geprüft: ausführbare Tests gegen eine Test-Runtime (ein `node:http`-Server auf 127.0.0.1, der feste vertragsgültige Antworten liefert und die rohen Request-Bytes aufzeichnet; `apps/backend/src/__tests__/lib/open-weight-test-runtime.ts`), dazu PostgreSQL-Suiten für die Kette Datenbank, Revision und Hash. Jede Manipulation eines Vertrags entsteht aus gültigen Fixtures und steht als „Negativprobe“ im Testtitel; der Produktivcode bleibt unverändert. Hypothese, Schwellen und Entscheidungsregel stehen vor der Ausführung im Design. Der Echtpfad mit dem ausgelieferten Runtime-Image läuft erst im Laborlauf (L1 bis L5 am Laptop, L6 am PC; siehe ADR 1C-001 und 1C-002). _Aktualisiert 2026-11-10:_ Dazu kam der Nachlauf N1 bis N6 am Laptop auf upstream `def56700` ([Nachlauf](../evidenz/1C/2026-11-09-labor-nachlauf.md), [ADR 1C-026](1C-026-messstand-festhalten-upstream-nachziehen.md)). _Korrigiert 2026-11-12:_ L1 bis L5 liefen auf beiden Rechnern, L6 nur am PC ([1C-021](1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md)).

## Alternativen

- **Auf die Laborinstanz warten.** Verworfen: Das hätte die Prüfung der Verträge von der Verfügbarkeit einer Runtime abhängig gemacht; die Tests schließen zudem Lücken, die ohne Modell prüfbar sind ([Tests-Design](../specs/2026-10-24-1c-tests-design.md#2-ziele-nicht-ziele-anti-ziele)).
- **Nur Mocks an der geprüften Funktion.** Ausgeschlossen als Anti-Ziel: Gemockt wird nur an Systemgrenzen (Datenbank, Host-Auth, Netz, Zeit), nie der Prüfgegenstand.
- **Verträge im Produktivcode für den Test ändern.** Ausgeschlossen: Nicht-Ziel „keine Änderung am Produktivcode“; ein Fehler würde als Befund festgehalten, die Korrektur wäre getrennt zu entscheiden.
- **Die Test-Runtime als Beleg für das Modellverhalten.** Verworfen: Die Test-Runtime ist kein Modell und belegt weder Zeiten noch Antwortqualität.

## Belege

- Pflichtmethodik: Mutationsprobe je Testgruppe, jede Probe lokal und vorübergehend, nie committet ([Tests-Design 5.3](../specs/2026-10-24-1c-tests-design.md#53-mutationsprobe-pflicht)); Ausnahmen sind die Kontrollen und die Charakterisierung des Befunds T2.3 ([Methodenabschnitt in 1C/1C-diagrams.md](../1C/1C-diagrams.md#methode-prüfung-und-ki-nutzung)).
- Ergebnisprotokolle: [Teil 1 (T1 bis T5)](../evidenz/1C/2026-10-24-tests.md), [Teil 2 (E1 bis E9, M1 bis M5, Gegenvariante V1)](../evidenz/1C/2026-10-24-teil2.md), [Teil 3 (E10 bis E14, E15 widerlegt, T3.1, M6, M7)](../evidenz/1C/2026-10-24-teil3.md). E15 liegt als versionierter Patch vor, nicht in der Suite ([`e15-widerlegt.patch`](../evidenz/1C/e15-widerlegt.patch)).
- Kennzeichnung der Negativproben im Design: [Tests-Design T1](../specs/2026-10-24-1c-tests-design.md#t1-inkompatible-schemaversion-lücke-g1-punkt-3) und das Teil-2-Design (E4, „Gekennzeichnete Negativprobe Vertrag“; [Teil-2-Design](../specs/2026-10-24-1c-teil2-design.md)).
- Echtlauf: [Laptop-Protokoll](../evidenz/1C/2026-11-05-labor.md) und [PC-Protokoll](../evidenz/1C/2026-11-05-labor-pc.md).

## Folgen

- Gültigkeit der Unit-Tests (T1 bis T4): Sie belegen das Verhalten der Queue-, Kontext- und Client-Logik bei kontrollierten Eingaben; kein Zeitverhalten unter Last, kein reales Modell, keine Netzfehler.
- Gültigkeit der PostgreSQL-Suite (T5): Sie belegt Trigger und Kontextaufbau auf PostgreSQL 16 mit dem Migrationsstand von `248029dc`; nicht belegt sind Häufigkeiten unter echter Last (etwa der Anteil `source_changed`) und das Verhalten am Tag `v1.3.0`. Für alle Gruppen gilt `main` `248029dc` ([Tests-Design 5.4](../specs/2026-10-24-1c-tests-design.md#54-gültigkeitsgrenzen-gehören-ins-referat)).
- Die Reviews der Tests waren KI-Sitzungen, keine unabhängigen menschlichen Gutachten ([Eigenanteil](../1C/1C-eigenanteil.md)).
- Die Testdateien sind Evidenz und zugleich Kandidaten für eine PR; was in eine PR an kqc-real gehört, ist offene Prüferfrage 2.
