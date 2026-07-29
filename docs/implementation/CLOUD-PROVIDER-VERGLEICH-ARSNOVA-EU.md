<!-- markdownlint-disable MD013 MD060 -->

# Cloud-Betriebsmodelle und Providervergleich für arsnova.eu

**Zweck:** Entscheidungsrahmen für Lehre und Architekturplanung, nicht Beschaffungsempfehlung · **Stand:** 2026-07-28 · **Projektstatus:** [betriebliche Cloud-Einordnung](./CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md) · **Kurskontext:** [Cloud-Computing-Kurslandkarte](../didaktik/CLOUD-COMPUTING-KURSREADME.md)

## 1. Ausgangslage

`arsnova.eu` läuft im vorgesehenen Produktionspfad als Single-Host-Compose-Stack auf Hetzner-Infrastruktur: Nginx/TLS, ein App-Container, PostgreSQL, Redis und ein separater PDF-Worker. Der aktuelle Zielhost ist mit 8 vCPU und 16 GB RAM dokumentiert.

Die Evidenz darf nicht als „500 vollständig abgenommen“ verkürzt werden:

- 500 Produktions-Joins waren historisch funktional erfolgreich, aber mit `p95 = 3,57 s` oberhalb des damaligen 3-Sekunden-Ziels;
- vollständige 500er-Kern-/Regressionspfade sind lokal verifiziert;
- die formale §6.5-Abnahme auf einem isolierten Zielhost ist offen;
- `100 × 50` und `1 × 5.000` sind ungetestete Lehr- und Architekturszenarien.

Ein Providerwechsel löst die heutigen Multi-Instanz-Lücken nicht automatisch. Prozesslokale Session-Signale, WebSocket-/Yjs-Zuordnung und globale Schutzlimits bleiben Anwendungs- und Betriebsaufgaben.

## 2. Erst Betriebsmodell, dann Anbieter

Vier Modelle sind fachlich sinnvoll zu vergleichen:

| Modell                              | Typischer Zuschnitt                                                   | Haupttrade-off                                                      |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A. Single Host, self-managed**    | App, PostgreSQL und Redis auf einer VM                                | niedrigste Komplexität, aber ein Fehler- und Skalierungsbereich     |
| **B. Getrennte IaaS-Dienste**       | App-, DB- und Redis-VMs, privates Netz, Load Balancer                 | klare Grenzen, aber weiterhin hoher Eigenbetrieb                    |
| **C. IaaS + Managed Data**          | App auf VMs/Containern, PostgreSQL/Redis/Backups als Managed Services | weniger Datenbankbetrieb, höhere Kosten und Bindung                 |
| **D. Managed Application Platform** | Managed Container/Kubernetes/Serverless plus Managed Data             | stärkste Plattformunterstützung, höchste Komplexität/Lock-in-Gefahr |

Für `arsnova.eu` ist **B** der naheliegende Replatform-Vergleich zum Ist-System. **C** und **D** sind Alternativen, wenn Betriebsentlastung, Hochverfügbarkeit oder Governance ihren Mehrpreis rechtfertigen. Das ist eine Prüfsequenz, keine Vorentscheidung.

## 3. Benötigte Fähigkeiten

Der Vergleich soll Fähigkeiten statt Produktnamen abbilden:

- Linux-/Container-Compute für HTTP, tRPC-WebSockets und Yjs;
- private Netze, Firewall, TLS und Load Balancing;
- PostgreSQL mit Backup, Restore, Patch- und optional HA-Verantwortung;
- Redis/Valkey mit geklärter Persistenz- und Failover-Semantik;
- Object Storage für verschlüsselte Offsite-Backups und Artefakte;
- Observability, Alarmierung und nachvollziehbare Log-Retention;
- IAM, Secrets, Audit, Datenstandort und Auftragsverarbeitung;
- IaC/API für reproduzierbare Umgebungen;
- Kosten- und Quoteninformationen einschließlich Egress.

## 4. Providergruppen

### Hetzner Cloud

**Passung:** nahe am aktuellen Self-managed-Modell und gut für Rehost/Replatform auf IaaS.

Stärken:

- einfacher Übergang vom heutigen Debian-/Docker-/Nginx-Stack;
- europäische Regionen und vergleichsweise transparente IaaS-Kosten;
- Cloud Server, Netz, Firewall, Volumes, Load Balancer und Object Storage.

Zu prüfen:

- PostgreSQL und Redis bleiben ohne Drittanbieter self-managed;
- Hetzner bietet derzeit kein eigenes natives Managed Kubernetes wie GKE/EKS/AKS;
- Hochverfügbarkeit, Datenbank-Patches, Failover und Clusterbetrieb liegen weitgehend beim Betreiber;
- Load Balancing allein löst prozesslokale Live-Signale und globale Limits nicht.

Vertiefung: [Hetzner-Stückliste](./CLOUD-COMPUTING-HETZNER-STUECKLISTE.md) und [Kostenrechenblatt](./CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md).

### Öffentliche OpenStack-Cloud

**Passung:** guter IaaS- und Portabilitätsvergleich, insbesondere für Hochschule/Labor oder OpenStack-nahe Organisationen.

Stärken:

- standardisierte IaaS-Konzepte wie Projekt/Tenant, Flavor, Image, Network und Volume;
- geringere Bindung an proprietäre Control-Plane-Begriffe;
- je Anbieter europäische Regionen und zusätzliche Managed-Dienste möglich.

Zu prüfen:

- OpenStack-API bedeutet nicht identische Betriebsqualität oder Servicepalette;
- Managed PostgreSQL/Redis, Load Balancer, Object Storage und Support unterscheiden sich je Anbieter;
- ein selbst betriebenes OpenStack wäre ein eigenes Plattformprojekt und kein pragmatischer App-Migrationsschritt.

Vertiefung: [OpenStack, Kubernetes und Alternativen](./CLOUD-COMPUTING-OPENSTACK-UND-ALTERNATIVEN.md).

### Google Cloud, AWS und Microsoft Azure

**Passung:** Managed-Data-, Managed-Container- und Enterprise-/Governance-Vergleich.

Gemeinsame Stärken:

- Managed PostgreSQL, Managed Redis/Valkey-Varianten, Load Balancing, Object Storage, Monitoring und IAM;
- Managed Kubernetes und weitere Plattform-/Serverless-Optionen;
- ausgereifte Multi-Zone-, Security- und Governance-Funktionen.

Zu prüfen:

- tatsächliche Region und Datenflüsse jedes Dienstes, nicht nur die Vertragsregion des Kontos;
- Basiskosten, Mindestgrößen, HA-Aufschläge, Log-/Monitoringvolumen, NAT und Egress;
- Produkt- und Preiskomplexität sowie notwendige Plattformkompetenz;
- Portabilität von IAM, Observability, Serverless- und Managed-Data-Funktionen;
- institutionelle Rahmenverträge und vorhandene Kompetenz können wichtiger als Listenpreise sein.

Es gibt ohne gewichtete Anforderungen keinen sachlichen „besten Hyperscaler“. Eine frühere pauschale Präferenz für Google Cloud wird daher nicht fortgeführt.

### Europäische Managed-Service-Spezialisten

Managed PostgreSQL, Redis/Valkey, Kubernetes oder Observability können auch von spezialisierten Anbietern auf europäischer Infrastruktur bezogen werden. Das kann IaaS-Kosten und Betriebsentlastung kombinieren, führt aber zu mehreren Verträgen, Supportgrenzen und Datenpfaden. Provider, Unterauftragnehmer, Exit und Wiederherstellung sind einzeln zu prüfen.

## 5. Gewichtete Entscheidungsmatrix

Vor einer Bewertung legt das Team Gewicht und Mindestkriterium je Dimension fest.

| Dimension             | Leitfrage                                                                                              | Beispielgewicht |
| --------------------- | ------------------------------------------------------------------------------------------------------ | --------------: |
| Architekturpassung    | Unterstützt das Modell HTTP, langlebige WebSockets, Yjs und Hintergrundarbeit ohne Sonderkonstruktion? |            20 % |
| Betrieb/Resilienz     | Wer patcht, sichert, überwacht und stellt DB/Redis/Compute wieder her?                                 |            20 % |
| Security/Datenschutz  | Sind IAM, Secrets, Datenstandort, AVV, Audit und Löschung ausreichend?                                 |            20 % |
| Kosten/TCO            | Welche Kosten entstehen für Ressourcen, Traffic, Logs, Betrieb, Migration und Exit?                    |            15 % |
| Kompetenz/Komplexität | Kann das Team die Plattform verlässlich betreiben und Störungen diagnostizieren?                       |            15 % |
| Portabilität/Exit     | Wie werden Daten, Images, IaC, Metriken und Identitäten migriert?                                      |            10 % |

Bewertungsskala: `0 = Ausschluss`, `1 = schwach`, `3 = ausreichend`, `5 = sehr gut`. Ein Ausschlusskriterium darf nicht durch hohe Werte in anderen Kategorien überstimmt werden.

## 6. TCO statt Instanzpreis

Eine vergleichbare Monatsrechnung enthält mindestens:

```text
Compute + Load Balancing + Datenbank + Cache
+ Storage + Backups + Traffic/Egress
+ Logging/Monitoring + Support
+ Betriebszeit des Teams
+ anteilige Migration, Tests und Schulung
+ Exit-/Parallelbetriebsreserve
```

Zusätzlich sind drei Zustände zu kalkulieren:

1. normaler Monat;
2. Lasttest-/Veranstaltungsmonat;
3. Störung oder Migration mit Parallelbetrieb.

Listenpreise ohne Architektur- und Nutzungsmodell sind nicht vergleichbar. Die Hetzner-Kostenunterlagen im Repository sind deshalb Rechenbeispiele, keine Aussage, dass die dort genannten Serverzahlen 5.000 Clients tragen.

## 7. Empfohlener Entscheidungsprozess

1. Ist-Topologie und offene Multi-Instanz-Lücken bestätigen.
2. Für jedes Lastprofil SLIs, SLOs und Testlast definieren.
3. Drei Betriebsmodelle shortlist-en: getrennte IaaS, IaaS + Managed Data, Managed Application Platform.
4. Je Modell eine kleine reproduzierbare Zieltopologie und TCO-Rechnung erstellen.
5. Restore, Failure, Zwei-Instanz-Fan-out und Reconnect testen.
6. Erst danach Provider und Ausbaupfad per ADR entscheiden.
7. 5.000er-Szenarien nur gestuft und mit dokumentierten Abbruchkriterien prüfen.

## 8. Kursartefakt

Der Providervergleich einer Gruppe enthält:

- gewichtete Anforderungen und Ausschlusskriterien;
- drei vergleichbare Betriebsmodelle;
- Datenfluss-, Verantwortungs- und Exit-Diagramm;
- TCO mit Bandbreiten und Sensitivitätsanalyse;
- eine Entscheidung plus verworfene Alternative;
- offenen technischen Nachweis vor Beschaffung oder Migration.

## 9. Volatile Primärquellen

Vor jeder Lehr- oder Beschaffungsverwendung direkt prüfen:

- [Hetzner Cloud](https://www.hetzner.com/cloud/)
- [Google Cloud](https://cloud.google.com/)
- [Amazon Web Services](https://aws.amazon.com/)
- [Microsoft Azure](https://azure.microsoft.com/)
- Dokumentation des konkret ausgewählten OpenStack- oder Managed-Service-Anbieters

## 10. Schlussfolgerung

Für den nächsten Erkenntnisschritt ist kein Providerwechsel vorentschieden. Fachlich sinnvoll ist zuerst ein Vergleich von **getrennter Self-managed-IaaS**, **IaaS mit Managed Data** und **Managed Application Platform**. Die Entscheidung fällt anhand von Zielhosttests, Betriebsverantwortung, Datenschutz, TCO und Exit-Fähigkeit — nicht anhand einer pauschalen Provider-Rangliste.
