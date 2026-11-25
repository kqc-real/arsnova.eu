# A1 – Eigenanteil und Anforderungsabgleich

Aktualisiert 15.11.2026. Aufgabe 1A liegt gemäß [Aufteilung](../rahmen/01-aufteilung.md)
bei Niklas; zusätzliche 1B-Schritte sind davon getrennt.

## Beitrag und Herkunft

A1 ergänzt Versuchsvertrag, gemeinsame synthetische Fixture, Live-Instrumentierung,
hostautorisierte Analysen, Ressourcen-Collector, Verzögerungsproxy, Laborablauf,
Auswertung und Dokumentbau. Die [Gesamtübersicht](./archiv/1A-komplette-Aufgabe-fertig.md)
ordnet Dateien und sieben Umsetzungsschritte zu.
Anwendungs- und Sidecar-Code sowie die sechs Referenzfragen sind übernommenes Projektmaterial.
A1 verändert keine Produktionslogik; der bekannte ursprüngliche Frontend-Wording-Test bleibt unverändert.

Implementierung, Tests, Berechnungen und Dokumententwürfe sind mit OpenAI Codex
agentengestützt entstanden. Niklas erteilt Aufträge, stellt das Labor bereit,
führt die aktuelle reale Messreihe gemäß Chat-Anleitung aus und übernimmt Commit/Push.
Git-Autorenschaft ist kein Beweis ausschließlich manueller Implementierung.
Persönliche fachliche Gegenprüfung und Freigabe werden nicht aus dem Chat abgeleitet.

## Aktuelle Beweiskette

- Hypothesen und Schwellen: unveränderter [Versuchsvertrag](./1A-experiment-contract.md)
  mit [Vorabnachtrag](../specs/2026-11-14-1a-messreihe-main-a19ca70f.md).
- Anwendung: `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`; die Werkzeugidentität steht gesondert im Manifest.
- Daten: [einzige aktuelle Reihe](../evidenz/1A/reihe-main-a19ca70f-20261115-122547/), eigener erfolgreicher Vorlauf,
  25 Messfenster, Rohwerte und zeitgenössische Compose-Aufnahmen.
- Rechnung und Entscheidung: [aktuelle Auswertung](./1A-auswertung.md), einschließlich
  aller ungünstigen Blöcke; keine nachträgliche Lockerung der Kriterien.
- Git: Messnachweise wurden im Stand `37f2c534336db6eff99788faa8d1c301f52d084c`
  versioniert. Spätere Bereinigung/Dokumentation ist kein neuer Anwendungs-Messcommit.
- Technische Gegenprüfung: [Prüfstand](./archiv/1A-pruefstand.md).

## Anforderungsabgleich

| Anforderung                      | Stand und Beleg                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Dienste und fachliche Grenzen    | In der [Auswertung](./1A-auswertung.md#systemgrenzen-und-labor) eingeordnet              |
| Reproduzierbarer A/B-Vergleich   | Fünf gepaarte V0–V4-Blöcke; Eingaben, Images, Hardware und Quellenhashes erfasst         |
| Live- und Ressourcenmessung      | Rohzeiten, Fehler, geplante Arbeit, CPU, RAM, Drosselung, OOM und geprüfter Rückweg      |
| Aufgelöstes Compose ohne Secrets | Je Phase Originalaufnahme; Hash und Manifestabgleich statt Rekonstruktion                |
| Begründete Gegenalternative      | Lexikalische Wortwolke; Ressourcenbudget und Aufwand in der Auswertung                   |
| Ursachen und Übertragbarkeit     | Einzelne Ursache nicht identifiziert; gemeinsamer Generator-/Dockerhost begrenzt Aussage |
| Gemeinsame Artefakte             | Fixture und Werkzeuge bereitgestellt; tatsächliche Abstimmung noch zu bestätigen         |
| Abgabe                           | Aktuelle PDF-Entwürfe; persönliche fachliche und institutionelle Freigabe offen          |
| GitHub-Abschluss                 | Commit/Push laut Niklas erfolgt; PR-Review und tatsächlicher Merge hier nicht ausgeführt |

## Individueller Leistungsnachweis und KI

Auftrag, schrittweise Freigaben, Ausführung und Interpretation müssen von Niklas
fachlich vertreten werden. Die agentengestützte Umsetzung und gemeinsame Herkunft
bleiben offengelegt. Die [Übergabeunterlage](./archiv/1A-abschluss-und-uebergabe.md)
enthält KI-Aufträge und persönliche Prüfpunkte. Eine tatsächliche gemeinsame
Abstimmung, ausschließlich manuelle Erstellung oder institutionelle Anerkennung wird nicht behauptet.
