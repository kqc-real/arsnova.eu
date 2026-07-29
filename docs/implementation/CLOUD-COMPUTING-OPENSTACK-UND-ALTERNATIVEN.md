<!-- markdownlint-disable MD060 -->

# OpenStack, Kubernetes und Alternativen (Kurzabhandlung)

**Zweck:** Kompakte Einordnung von **OpenStack** und **Kubernetes** gegenüber **Hetzner Cloud** und anderen Optionen — für Lehre und Architekturdiskussion um **arsnova.eu**. **Kein** Pflicht-Laborplan und **kein** Ersatz für den [Provider-Vergleich](./CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md).

**Stand:** 2026-07-28

---

## 1. Was OpenStack ist

OpenStack ist eine **Open-Source-IaaS-Plattform**: Software zum Betreiben einer eigenen Cloud (Compute, Netz, Speicher, Identität), typischerweise in Rechenzentren oder als Basis öffentlicher Anbieter.

Zentrale Bausteine (vereinfacht):

| Dienst                 | Rolle                                    |
| ---------------------- | ---------------------------------------- |
| **Nova**               | Compute (VMs)                            |
| **Neutron**            | Netzwerke, Floating IPs, Security Groups |
| **Cinder** / **Swift** | Block- bzw. Object Storage               |
| **Glance**             | Images                                   |
| **Keystone**           | Identität und Projekte (Tenants)         |
| **Horizon**            | Web-Dashboard                            |

Lehrwert: OpenStack macht die **IaaS-Abstraktionen** sichtbar (Flavor, Image, Network, Volume, Project), die bei proprietären Clouds hinter Produktnamen stecken.

---

## 2. OpenStack und Hetzner — klare Trennung

| Aussage                      | Fakt                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Hetzner ist OpenStack“      | **Nein.**                                                                                                                                                 |
| **Hetzner Cloud**            | Eigene IaaS-API und Konsole (Server, Volumes, Networks, Load Balancer, Firewalls). Europäisch, kostengünstig, gut für Self-Managed-Stacks wie arsnova.eu. |
| **Hetzner Root / Dedicated** | Bare Metal. Darauf _kann_ man OpenStack **selbst** installieren (Lab/All-in-One oder Cluster). Das ist **kein** Hetzner-Managed-OpenStack.                |
| Aufwand Self-OpenStack       | Hoch: Netz/IPs (oft extra Subnet für Floating IPs), Storage, Betrieb der Control Plane. Für Kursziele meist zu dominant.                                  |

**Fazit:** Hetzner eignet sich hervorragend als **IaaS-Praxis** (Cloud-Server + Compose). OpenStack auf Hetzner-Hardware ist eine **eigene Plattform-Übung**, nicht der produktnahe Weg für arsnova.eu.

---

## 3. Kubernetes auf Hetzner Cloud

OpenStack und Kubernetes sind **verschiedene Schichten**: OpenStack orchestriert typischerweise **VMs und IaaS**; Kubernetes orchestriert **Container-Workloads** auf vorhandener Compute-Infrastruktur.

### 3.1 Was Hetzner anbietet — und was nicht

| Aussage                                                              | Fakt                                                                                                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eigenes natives **Managed Kubernetes** von Hetzner (wie GKE/EKS/AKS) | Im aktuellen Produktportfolio nicht ausgewiesen; self-managed und Drittanbieterangebote auf Hetzner-Infrastruktur sind davon zu unterscheiden.                             |
| Hetzner Cloud liefert                                                | Server, Private Networks, Volumes, Load Balancer, Firewall — also die Bausteine unter einem Cluster.                                                                       |
| Kubernetes auf Hetzner                                               | **Ja**, aber self-managed oder über Drittanbieter; Hetzner pflegt dafür einen [Cloud Controller Manager](https://github.com/hetznercloud/hcloud-cloud-controller-manager). |

### 3.2 Typische Wege

| Weg                                           | Kurzbeschreibung                                                                                                            | Aufwand                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Self-managed (k3s / kubeadm)**              | Cluster auf Cloud-Servern selbst aufsetzen; oft mit **Hetzner Cloud Controller Manager** (Nodes, LB) und **CSI** (Volumes). | Mittel bis hoch                              |
| **Terraform-Module** (z. B. kube-hetzner)     | Deklarativer Cluster auf Hetzner Cloud, häufig k3s, HA-fähig.                                                               | Mittel; Infra-as-Code-Kenntnisse             |
| **Managed auf Hetzner-Infra** (Drittanbieter) | Control Plane gemanagt, Worker bei Hetzner (z. B. Angebote wie Cloudfleet, Syself).                                         | Niedriger Betrieb, Extra-Kosten/Abhängigkeit |
| **Nur Konzepte**                              | Deployment, Service, Ingress, HPA erklären; Praxis bleibt Compose.                                                          | Niedrig — oft kursgeeignet                   |

### 3.3 Bezug zu arsnova.eu

- **Heute:** Docker Compose mit genau einem App-Container auf einem Produktionshost — passend zum einfachen Rehost/Replatform auf Hetzner Cloud. Historisch belegt sind 500 Produktions-Joins; die vollständige produktionsnahe 500er-Live-Abnahme ist offen.
- **K8s-Nutzen:** horizontale Replicas, Rolling Updates, klarere Trennung von App vs. Sidecars; nicht automatisch Lösung für Postgres-, Redis- oder WebSocket-/Realtime-Engpässe.
- **Lehrprofile** (**100 × 50 Classrooms**, **1 × 5.000 Konferenz**): Kubernetes kann Orchestrierung und Skalierung der App-Schicht unterstützen; Stateful Dienste und Live-Kanäle bleiben eigene Entwurfsfragen. Die Profile sind keine freigegebene Kapazität.
- **Kurs:** K8s als **Vertiefung** (Konzepte oder kleines Lab), nicht als Pflichtinfra. Voller Cluster-Betrieb frisst sonst ähnlich Zeit wie Self-OpenStack.

### 3.4 Pragmatische Stufen bei Hetzner

1. **Zuerst:** Ist-Pfad und formalen Zielhostnachweis stabilisieren.
2. **Replatform-Labor:** App und DB/Redis auf getrennten Cloud-Servern testen.
3. **Optionales Orchestrierungs-Labor:** kleines k3s-/Kubernetes-Cluster erst nach bestandenem Zwei-Instanz-Design.
4. **Produktion mit Kubernetes:** nur wenn Upgrades, Observability, Stateful Workloads und instanzübergreifende Live-Signale bewusst gelöst sind.

---

## 4. Alternativen im Überblick

### 4.1 Proprietäre Public Clouds (IaaS + Managed)

- **Hetzner Cloud** — europäische Self-managed-IaaS mit vergleichsweise kleinem Produktkatalog; kein im aktuellen Produktportfolio ausgewiesenes natives Managed Kubernetes.
- **Google Cloud / AWS / Azure** — Managed Kubernetes (GKE/EKS/AKS) plus Managed Datenbank-/Cache-Angebote; Kosten und Lernaufwand sind nur am konkreten Nutzungsmodell vergleichbar. Details: [CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md](./CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md).

### 4.2 Öffentliche Clouds mit OpenStack-API

- z. B. **OVH Public Cloud** und vergleichbare Anbieter: echte OpenStack-ähnliche API, ohne Control Plane selbst zu betreiben.
- Lehrwert: CLI/`openstack`-Client, Projekte, Floating IPs — näher am Lehrbuch als Hetzner Cloud, aber anderer Betriebs- und Kostenkontext als der aktuelle arsnova.eu-Host.

### 4.3 Private / Lab-OpenStack

- **DevStack**, **MicroStack**, Packstack/RDO u. ä. auf Lab-VMs oder wenigen Roots.
- Lehrwert: Architektur der Cloud _selbst_; Nachteil: Zeit, Fragilität, wenig Bezug zu Produktionslast von arsnova.eu.

### 4.4 Container-Orchestrierung vs. IaaS

- **Docker Compose** = aktueller arsnova.eu-Pfad auf IaaS.
- **Kubernetes** = optionale nächste Orchestrierungsschicht auf derselben IaaS (bei Hetzner: self-managed oder Drittanbieter).
- OpenStack und K8s ersetzen sich nicht: IaaS unter dem Cluster vs. Workload-Orchestrierung darüber.

### 4.5 Nur Konzepte vergleichen (ohne Cluster)

Für den Kurs oft ausreichend:

1. IaaS-Begriffe an OpenStack erklären
2. dieselben Ideen an **Hetzner Cloud** (Server ≈ Nova, Volume ≈ Cinder, Network/Firewall ≈ Neutron-Ausschnitt) festmachen
3. Container-Orchestrierung an Compose vs. K8s-Begriffen festmachen
4. Managed-Schritte (DB/Redis, optional Managed K8s) an GCP/AWS/Azure diskutieren

---

## 5. Bezug zu den arsnova.eu-Lehrprofilen

Lehrprofile: **100 Classrooms à 50** (Quiz, Q&A, Blitzlicht) und **1 × 5.000 Konferenz**. Beide sind ungetestete Architektur- und Lastszenarien, keine freigegebene Produktkapazität.

| Ansatz                                    | Passung                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Hetzner Cloud + Compose / entkoppelte VMs | Pragmatisch für Rehost/Replatform und Kosten; Stücklisten: [CLOUD-COMPUTING-HETZNER-STUECKLISTE.md](./CLOUD-COMPUTING-HETZNER-STUECKLISTE.md) |
| Hetzner Cloud + self-managed K8s          | Mittelfristige Orchestrierung; Betriebsaufwand nicht unterschätzen                                                                            |
| GCP/AWS/Azure Managed (inkl. K8s)         | Zu prüfen, wenn DB/Redis/LB, Observability und Managed Control Plane mitwachsen sollen                                                        |
| Self-OpenStack auf Hetzner                | Lehrt Plattformbau; hilft wenig direkt bei App-Skalierung und Lasttests                                                                       |
| OpenStack-Public (z. B. OVH)              | Gut für API-/IaaS-Vergleich; eigener Migrationspfad                                                                                           |

6R und Providerwahl bleiben in [CLOUD-COMPUTING-6R-EINORDNUNG.md](./CLOUD-COMPUTING-6R-EINORDNUNG.md) und dem Provider-Vergleich.

---

## 6. Kurzempfehlung

- **OpenStack** = Referenzmodell und akademische IaaS-Sprache.
- **Hetzner Cloud** = praxisnahe Self-managed-IaaS für den aktuellen Stack — **kein** Managed OpenStack und kein im aktuellen Produktportfolio ausgewiesenes natives Managed Kubernetes.
- **Kubernetes auf Hetzner** = möglich (self-managed oder Drittanbieter); für Kurs und Produkt eher **optionale Vertiefung** nach Compose + getrennten Diensten.
- **Hyperscaler** = Alternative, wenn Managed Services (inkl. Managed K8s) und Grosslast-Betrieb Vorrang haben.
- Self-hosted OpenStack oder voller Self-K8s-Betrieb auf Hetzner: nur als **optionale Vertiefung**, nicht als Pflichtinfrastruktur für die Lehrprofile.

## Kurzform

OpenStack ist eine Open-Source-IaaS-Plattform; Hetzner Cloud ist eine proprietäre europäische IaaS ohne Hetzner-eigenes Managed OpenStack oder Managed Kubernetes. Kubernetes lässt sich auf Hetzner Cloud selbst oder über Drittanbieter betreiben. Für `arsnova.eu` und den Kurs genügen zunächst OpenStack-/Kubernetes-Konzepte plus Compose und ein Zwei-Instanz-Entwurf; ein eigener OpenStack- oder Produktions-Kubernetes-Cluster ist optional und betriebsintensiv.
