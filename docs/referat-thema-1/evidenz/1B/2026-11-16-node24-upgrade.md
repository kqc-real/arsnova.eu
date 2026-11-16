# Node-24-Umstellung der Labor-VMs, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

Niklas hat beide vorhandenen Labor-VMs vor dem nächsten Label-Test von
Node 22.23.5 auf Node 24.22.3 umgestellt. Je VM über `labor-wsl.sh vm`:

```bash
sudo sed -i 's|node_22.x|node_24.x|g' /etc/apt/sources.list.d/nodesource.sources
sudo apt-get update
sudo apt-get install -y nodejs
node --version
```

Beide Paketprotokolle bestätigen `nodejs` 24.22.3-1nodesource1 als einziges
aktualisiertes Paket; andere angebotene Updates wurden nicht installiert.
`debconf` wechselte mangels interaktivem Terminal auf Teletype. Installation
erfolgreich, keine Dienste oder Container laut Paketprotokoll neu zu starten.

Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
Die Umstellung betrifft die Host-Helfer (Treiber, Sampler, Fake), nicht den
Node-Prozess im unveränderten App-Image. Die zuletzt ausgeführte Diagnoseprobe
hatte Arbeitsstand `8f735b0402a9b78937cc9f7868a0f2fb198ac1cb`; Paketinstallation
ist ein eigener Umgebungswechsel, kein neuer Ausführungscommit oder Messlauf.

## Lesende Nachprüfung

Nach Niklas' Installation ausschließlich über `labor-wsl.sh` geprüft:

| Komponente            | Ergebnis                           |
| --------------------- | ---------------------------------- |
| Node im app-host      | v24.22.3                           |
| Node im llm-host      | v24.22.3                           |
| Node im App-Container | v24.19.0                           |
| App, Encoder          | Container healthy                  |
| Postgres, Redis       | Container healthy                  |
| App-Health            | Status ok, Redis ok                |
| LLM-Runtime           | Container healthy, Healthstatus ok |

Die Node-24-Voraussetzung aus Issue #9 ist damit vor der nächsten Label-Probe
erfüllt. Keine neue Analyse oder Inferenz für diese Nachprüfung gestartet.
Die [Korpuskorrektur](2026-11-16-lauf-dev-normal-label-diagnose.md) bleibt
auf der VM noch zu erproben; vor gewerteten Label-Reihen weiterhin den
effektiven Encoder-Timeout und die vollständige Laufzeitkonfiguration erfassen.

Alte Summary-Messungen behalten ihre tatsächliche VM-Node-Version 22.23.5.
Alle neuen Label-Baselines und Varianten mit derselben Node-Version messen;
Vergleiche über den Umgebungswechsel ausdrücklich kennzeichnen.
Die Cloud-init-Vorlagen im bisherigen Repo-Stand installieren weiterhin
Node 22; bei einem Neuaufbau die Umstellung erneut berücksichtigen.
