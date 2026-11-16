# Transportauswertung aus vorhandenen Normaldaten, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung, Commits und Quellen

Reine Offline-Auswertung, kein neuer Laborlauf. Rechner für alle Daten:
Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning, 31,9 GiB RAM;
app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.

- Label: drei Normalteile, 30 Aufträge, Ausführungs- und Auswertungscommit
  `7c64dd6a0352df1e51981ab16300532eb849f712`, VM-Hosts Node v24.22.3,
  App-Container v24.19.0. [Normaldaten und Lauf-IDs](2026-11-16-lauf-normal-label-03.md).
- Summary: zehn Normalaufträge, Ausführungscommit
  `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`, Auswertung mit obigem `7c64dd6a`.
  [Ursprüngliches Protokoll](2026-11-15-lauf-normal-summary.md).
- [Abgeleitete Messdaten](messung/2026-11-16-transportauswertung.json):
  quellbezogene SHA-256, erlaubte Runtime-Timings, Drahtzeiten und Formeln je
  Label-Auftrag. Keine Header, Tokens, Prompts oder vollständigen Modellantworten.
- Lokale Quellen jeweils unter `%USERPROFILE%\labor-1b\<Lauf-ID>\`;
  PCAPs bleiben lokal. Original-JSONs und eingefrorene Protokolle unverändert.

## Methode und Nachrechenbarkeit

Begriffe gemäß [ADR 1B-011](../../adr/1B-011-zeitbegriffe-und-leitfrage.md):
Transport umfasst Netz und Runtime-Serverarbeit außerhalb der Inferenz.
Für Labels aus den vorhandenen `app.pcap`-Dateien die TCP-Nutzdaten der
Runtime-Antworten je Verbindung nach Sequenznummer zusammengesetzt.
Identische Wiederholungen dedupliziert; keine Lücken oder Überlappungen in den
30 ausgewerteten Serverstreams. Je Stream genau ein `timings`-Objekt mit
`prompt_ms`, `predicted_ms`, `cache_n`. Reihenfolge nach erstem Serverpaket,
gegen zehn Slot-Abfragen und zehn POSTs mit HTTP 200 je Lauf auf beiden
Mitschnittseiten geprüft. Keine Zuordnung über zufällige TCP-Sequenznummern.

HTTP-Drahtzeiten aus den vorhandenen TSVs mit `parseTsharkFields` und
`exchanges` aus `messung/zeitzerlegung.mjs` berechnet. Start am ersten
Client-Nutzdatensegment, Ende am HTTP-Antwortframe. Je Auftrag:

```text
T_infer = prompt_ms + predicted_ms
T_wire_app = appSlotMs + appPostMs
T_wire_srv = srvSlotMs + srvPostMs
T_netz = T_wire_app - T_wire_srv
T_transport = T_wire_app - T_infer
Anteil_Client = 100 * T_transport / clientWaitMs
```

Die JSON-Datei enthält alle Eingangsgrößen pro Label-Auftrag. Kennzahlen
lassen sich daraus ohne PCAP-Zugriff nachrechnen: Median bei gerader Anzahl
als Mittel der beiden mittleren Werte. Anteile erst je Auftrag berechnen,
dann deren Median bilden; keine Quotienten von Medianen.

Summary-Zerlegung zusätzlich aus `app.tsv`, `srv.tsv`, `app.log` und
`timings.json` mit `zerlegeAuftraege` neu berechnet. Identisch mit den zehn
Aufträgen der vorhandenen `zerlegung.json`. Deren bestehende Konvention
`netzMs + serverOhneInferenzMs` beibehalten; der Serverrest dort bezieht sich
auf POST, während die obige Label-Formel auch Slot-Serverzeit enthält.
Die Prozentwerte sind deshalb keine identisch definierten Verbraucher-
Vergleichswerte; Summary außerdem mit internem Job-Nenner berichten.

## Label-Normalbetrieb

Alle Zahlen gelten für die genannten Rechner/Commits. Alle 30 Runtime-
Antworten mit messbaren Timings; alle abgeleiteten Transportreste positiv.

| Kennzahl                                | alle 30 | 27 Folgeaufträge ohne ersten Auftrag je Lauf |
| --------------------------------------- | ------: | -------------------------------------------: |
| Netz, Median ms                         |   0,652 |                                        0,664 |
| Transport, Median ms                    |   8,714 |                                        8,681 |
| Transport / Client-Wartezeit, Median %  |   0,247 |                                        0,249 |
| Transport / Client-Wartezeit, Maximum % |   0,639 |                                        0,639 |

Die 5-%-Schwelle ist damit für alle beobachteten Label-Normalaufträge
unterschritten. Anders als die zuvor nur aus Client-Zeiten mögliche
Betrachtung berücksichtigt diese Auswertung tatsächliche Runtime-Timings.
Keine weitere C0-Massenreihe erforderlich, um diesen gemessenen Anteil
zu berichten.

## Summary-Normalbetrieb

Zehn Aufträge mit echter Inferenz trotz Qualitätsfallback `invalid_response`.
Neu berechneter Netz-Median 0,605 ms, Transport-Median nach bestehender
Zerlegung 11,597 ms, Median des Transportanteils an der internen Job-Zeit
0,017 %. Das ist ein ergänzender Summary-Befund, kein Ersatz für Labels und
keine Aussage über akzeptierte Summary-Qualität.

## Grenzen und Schluss für Schritt 3

Subtraktion lokaler Dauern aus zwei Mitschnitten hebt konstanten Uhrenversatz
auf; Drift, Timestamp-Auflösung, Scheduling und Messpunkt bleiben relevant.
Sub-Millisekunden-Netzwerte deshalb nur als Größenordnung bewerten.
Runtime-Timings sind Selbstauskünfte des Servers; kein unabhängiges Profiling.
Client-Wartezeit enthält Encoder-/App-Arbeit außerhalb der gemessenen HTTP-
Austausche. Kein vollständig instrumentierter interner Label-Job. Die Formel
ist ein beobachteter Rest, keine kausale Zerlegung aller Softwarekomponenten.

Kein Same-Host-Gegenvergleich in dieser Auswertung. Daraus weder eine exakte
isolierte Zusatzlast des zweiten Hosts noch einen Topologiegewinn ableiten;
S1 und Betriebsentscheidung gehören zu Schritt 4. Die bereits gemessenen
Live-p95-Überschreitungen bleiben bestehen, auch wenn Transportkosten klein sind.
Interne Label-Fallback-Zeit und interner `aborted`-Status bleiben mit den
bisher dokumentierten Beobachtbarkeitsgrenzen versehen.

Mit dieser Auswertung sind Störreihen, App-Rückwirkung, F1/F2-Unterschied,
gerichteter Queue-/Breaker-Nachweis und Transportauswertung für den vereinbarten
Schritt-3-Umfang inhaltlich bearbeitet. Kein allgemeiner positiver
Isolationsnachweis; Autorenprüfung, Schritt 4 und PR-Abschluss bleiben offen.
