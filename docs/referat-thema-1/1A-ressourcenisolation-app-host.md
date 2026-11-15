# Aufgabe 1A – Ressourcenisolation auf dem Anwendungshost

Aktualisiert 15.11.2026. Dieses Dokument ersetzt das überholte Recherchedossier.
Verbindliche Aufgabenquelle ist die
[Prüfungsspezifikation, Gruppenauftrag 1A](../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md),
konkretisiert durch [Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6).

## Auftrag und Leitfrage

Welche Ressourcenreserve hat der Anwendungshost für optionale Analysearbeiten,
ohne die für den Moderationskompass relevanten Live-Signale unzulässig zu verzögern?

1. Dienste erfassen und spaCy, 8.9b, Kontextaufbau und Encoder fachlich einordnen;
   die getrennte private Serverrolle generativer Inferenz nach ADR-0035 begründen.
2. Einen Sidecar ausgeschaltet, normal und ressourcenbegrenzt beziehungsweise
   verzögert vergleichen; Q&A-Daten und Live-Last konstant halten.
3. CPU, RAM, Drosselung, Live-p95 und Fehler messen und die Aussage über
   Kompassaktualität sowie ihre Grenzen erklären.
4. Limits und Einsatzgrenze begründen; Deaktivierung, Betriebsaufwand und den
   begrenzten Nutzen sprachlicher Glättung als Gegenalternative bewerten.

## Tatsächlich bearbeiteter Umfang

Untersucht wird spaCy mit V0–V4, fünf gepaarten Blöcken und einem erfolgreichen Vorlauf.
Die Anwendung stammt unverändert aus der im
[Rahmen](./00-rahmen-und-pruefung.md#geklärte-a1-baseline-und-laborumgebung)
benannten aktuellen main-Baseline; ein Produktivpatch ist nicht erforderlich.
[Vertrag](./1A-experiment-contract.md),
[Nachtrag](./specs/2026-11-14-1a-messreihe-main-a19ca70f.md) und
[Fixture](./1A-fixture.md) legen den Versuch fest.

Systemgrenzen, tatsächlicher Rechner, Messzahlen, Hypothesen und Betriebsentscheidung
stehen verbindlich in der [aktuellen Auswertung](./1A-auswertung.md).
[Gesamtübersicht](./1A-komplette-Aufgabe-fertig.md),
[Versuchsreihe](./1A-versuchsreihe.md) und [Evidenzindex](./evidenz/1A/README.md)
führen zu Code, Befehlen und Rohdaten. Frühere Codezeilennummern und bloße
Versuchsvorschläge werden nicht als aktueller Implementierungsstand weitergeführt.

## Gültigkeitsgrenze und persönliche Abgabe

Ein funktionierender spaCy-Versuch belegt keine zusätzliche LLM-Tragfähigkeit.
API-Latenz misst keine Browserdarstellung; Containerlimits garantieren keine
Ressourcenreserve oder eindeutige Ursache einer Live-Verzögerung.
Zusätzliche 1B-Aufgaben bleiben entsprechend der [Aufteilung](./01-aufteilung.md)
separat. Persönliche Gegenprüfung und tatsächlicher Abgabestand stehen in der
[Abschluss-/Übergabeunterlage](./1A-abschluss-und-uebergabe.md).
