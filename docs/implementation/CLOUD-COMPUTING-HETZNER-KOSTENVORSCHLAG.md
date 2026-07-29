<!-- markdownlint-disable MD013 MD060 -->

# Hetzner-Kostenrechenblatt für Cloud-Topologien

**Zweck:** Transparente Rechenbeispiele für Lehre, TCO-Vergleich und Testbudget · **Status:** keine Beschaffungsfreigabe, kein Angebot und kein Kapazitätsnachweis · **Stand der Preisannahmen:** 2026-07-28 · **Architekturannahmen:** [Hetzner-Stückliste](./CLOUD-COMPUTING-HETZNER-STUECKLISTE.md)

## 1. Preisbasis

Region Deutschland/Finnland, Monatsmaximum für Neubestellungen nach der Hetzner-Preisanpassung vom 15.06.2026. Die deutschsprachige Preisliste weist die Cloud-Server-Preise **inklusive 19 % MwSt.** aus; die englischsprachige Fassung nennt dieselben Preise **ohne MwSt.**. Die folgende Tabelle hält beide offiziellen Darstellungen getrennt fest; für die Szenarien gelten die veröffentlichten Nettowerte.

| Baustein | deutsche Preisliste brutto | englische Preisliste netto/Monat |
| -------- | -------------------------: | -------------------------------: |
| CAX31    |                    24,98 € |                          20,99 € |
| CPX22    |                    23,19 € |                          19,49 € |
| CPX32    |                    42,23 € |                          35,49 € |
| CCX23    |                   102,33 € |                          85,99 € |
| CCX33    |                   164,80 € |                         138,49 € |
| CCX43    |                   328,43 € |                         275,99 € |

Weitere **Rechenannahmen**, vor Verwendung in der Console zu prüfen:

| Baustein                          |        Netto/Monat |
| --------------------------------- | -----------------: |
| Primary IPv4                      |             0,50 € |
| Load Balancer                     |            12,00 € |
| Volume                            |         0,044 €/GB |
| Object Storage/Backup-Grundbetrag |             5,00 € |
| Private Network/Cloud Firewall    | 0,00 € Grundbetrag |

Primärquellen: Hetzner-Preisanpassung 15.06.2026 in der [deutschen Bruttofassung](https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/) und der [englischen Nettofassung](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). Preise, Inklusivtraffic, Verfügbarkeit und Steuerbasis können sich ändern.

## 2. Szenariodefinitionen

Die großen Szenarien sind bewusst Rechenbeispiele. Insbesondere ist die App-Anzahl für `100 × 50` und `1 × 5.000` **nicht gemessen**.

| ID  | Rechenbeispiel                       | Zusammensetzung                                                                  |
| --- | ------------------------------------ | -------------------------------------------------------------------------------- |
| S0  | Ist-Nähe                             | 1 CAX31, IPv4, 40-GB-Volume, Object Storage                                      |
| S1a | getrennte Testtopologie              | 1 CPX32 App, 1 CCX33 DB, 1 CPX22 Redis, 100-GB-Volume, IPv4, Object Storage      |
| S1b | Zwei-App-Experiment                  | 2 CPX32 App, 1 CCX33 DB, 1 CPX32 Redis, 100-GB-Volume, LB, IPv4, Object Storage  |
| S2a | hypothetischer größerer App-Pool     | 6 CPX32 App, 1 CCX33 DB, 1 CPX32 Redis, 100-GB-Volume, LB, IPv4, Object Storage  |
| S2b | hypothetischer größerer App-/DB-Pool | 8 CPX32 App, 1 CCX43 DB, 1 CCX23 Redis, 200-GB-Volume, LB, IPv4, Object Storage  |
| S2c | hypothetischer dedizierter App-Pool  | 8 CCX23 App, 1 CCX43 DB, 2 CCX23 Redis, 200-GB-Volume, LB, IPv4, Object Storage  |
| S3  | hypothetischer Konferenz-Pool        | 10 CCX23 App, 1 CCX43 DB, 2 CCX23 Redis, 200-GB-Volume, LB, IPv4, Object Storage |

S2/S3 sind **keine empfohlenen Stückzahlen**. Sie zeigen nur, wie stark die Monatskosten auf unbewiesene Sizing-Annahmen reagieren.

## 3. Rechenergebnis ohne Planungspuffer

| ID  | netto/Monat | brutto/Monat |  netto/Jahr | brutto/Jahr |
| --- | ----------: | -----------: | ----------: | ----------: |
| S0  |     28,25 € |      33,62 € |    339,00 € |    403,41 € |
| S1a |    203,37 € |     242,01 € |  2.440,44 € |  2.904,12 € |
| S1b |    266,86 € |     317,56 € |  3.202,32 € |  3.810,76 € |
| S2a |    408,82 € |     486,50 € |  4.905,84 € |  5.837,95 € |
| S2b |    672,20 € |     799,92 € |  8.066,40 € |  9.599,02 € |
| S2c |  1.162,19 € |   1.383,01 € | 13.946,28 € | 16.596,07 € |
| S3  |  1.334,17 € |   1.587,66 € | 16.010,04 € | 19.051,95 € |

Beispiel S1a:

```text
35,49 + 138,49 + 19,49 + 4,40 + 0,50 + 5,00
= 203,37 € netto/Monat
```

Rundungsdifferenzen entstehen, weil veröffentlichte Bruttopreise je Position auf zwei Dezimalstellen vorliegen.

## 4. Nicht enthalten

- Setup, IaC, Migration und Parallelbetrieb;
- Refactor für geteilte Live-Events, globale Limits und Failover;
- Managed-Service- oder Drittanbietergebühren;
- Monitoring-/Logging-SaaS und Supporttarife;
- zusätzlicher Traffic, Egress, Snapshots oder größere Backup-Retention;
- Staging-, Lastgenerator- und CI-Ressourcen;
- Personalkosten, Rufbereitschaft, Schulung und Incident-Aufwand;
- Preisänderungs-, Wechselkurs- und Verfügbarkeitsrisiko.

Für Budgetplanung ist nach erneuter Preisprüfung ein expliziter Reserveposten zu ergänzen, beispielsweise `10–20 %`. Er darf nicht wie in einer früheren Fassung still in einzelne Szenariowerte eingerechnet werden.

## 5. Was die Zahlen nicht aussagen

- S1b beweist keine korrekte horizontale Skalierung.
- Sechs oder zehn App-VMs beweisen keine Kapazität für 5.000 Clients.
- Ein zweiter Redis-Server ist ohne Replikations-/Failover-Design keine HA-Lösung.
- Eine große DB ersetzt keinen Query-, Connection- und Restore-Nachweis.
- Monatskosten sind nicht Total Cost of Ownership.

Die nächste sinnvolle **Erkenntnisinvestition** ist S1a oder S1b als zeitlich begrenzte Testtopologie — aber nur, wenn Ziel, Budget, Datenschutz, Cleanup und technische Gates vorab freigegeben sind. Das ist keine Aufforderung zur Bestellung.

## 6. Sensitivitätsanalyse

Vor einer Entscheidung mindestens variieren:

| Variable   | Varianten                                                     |
| ---------- | ------------------------------------------------------------- |
| App-Anzahl | gemessener Mindestwert, N+1, zusätzlicher Veranstaltungsburst |
| CPU-Klasse | ARM/shared/dedicated bei identischem Test                     |
| DB         | self-managed klein/groß, HA, Managed Service                  |
| Redis      | single, repliziert/managed, Failoverkosten                    |
| Laufzeit   | dauerhaft, nur Veranstaltungsmonat, stundenweiser Lasttest    |
| Betrieb    | Eigenleistung, externer Support, Managed Platform             |
| Daten      | Backupvolumen, Retention, Egress und Restore-Test             |

## 7. Rechenblatt-Aufgabe für den Kurs

Studierende sollen:

1. eine Szenariozeile reproduzieren;
2. mindestens zwei volatile Preise gegen Primärquellen prüfen;
3. ungemessene Sizing-Annahmen markieren;
4. Personal-, Betriebs- und Exit-Kosten ergänzen;
5. eine Sensitivitätsanalyse durchführen;
6. benennen, welcher Test die größte Kostenunsicherheit reduziert.

## 8. Ablaufdatum

Dieses Rechenblatt ist neu zu prüfen, wenn eines der folgenden Ereignisse eintritt:

- neues Semester oder mehr als drei Monate seit Preisstand;
- Hetzner-Preis-/Produktänderung;
- neue Zielhost- oder Zwei-Instanz-Messung;
- Architekturänderung bei WebSocket, Yjs, PostgreSQL, Redis oder PDF;
- Wechsel von Self-managed zu Managed Services;
- reale Beschaffungsabsicht.

## 9. Bezug

- [Topologie- und Sizing-Hypothesen](./CLOUD-COMPUTING-HETZNER-STUECKLISTE.md)
- [Provider- und Betriebsmodellvergleich](./CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md)
- [6R-Einordnung](./CLOUD-COMPUTING-6R-EINORDNUNG.md)
