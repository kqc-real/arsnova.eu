# 1B-002: Zwei-Host-Deployment als zwei VMs auf einem Rechner

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

1B Schritt 1 verlangt, das Zwei-Host-Deployment nachzubauen: App-Host mit App, PostgreSQL und Redis, Inferenz-Host mit `llama-server` ([ADR-0035](../../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md), [Zweit-Host-Runbook](../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md)). Der Prüfer stellt keine Laborhosts bereit: „Die Laborinstanz ist Ihr eigener Rechner“ ([Rahmendokument, Frage 4](../00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)). Verfügbar sind der Laptop des Autors (ThinkPad P50) und ein Desktop-PC an einem anderen Ort.

## Entscheidung

Beide Hosts laufen als KVM-VMs auf dem Laptop, in einem privaten virtuellen Netz. Der App-Host betreibt die echte App aus `docker-compose.prod.yml`, der Inferenz-Host die Runtime aus `docker-compose.llm.yml`. Jede VM liegt auf festen CPU-Threads; die Inferenz-VM bekommt einen Thread jedes der vier physischen Kerne. Keine Mail an den Prüfer; diese Begründung genügt (Autor, 2026-11-12). Einzelheiten: [1B-Design, Abschnitt 3.1](../specs/2026-11-12-1b-zwei-host-design.md#31-topologie-autor).

## Alternativen

- **Laptop und PC über WireGuard:** verworfen. Die Netzzeit würde einen Internet-Tunnel über zwei Heimanschlüsse messen, nicht ein privates Netz; die Verbindung am Arbeitsort ist instabil; ein abgestürzter oder ausgeschalteter PC ist aus der Ferne nicht wiederherstellbar.
- **Laptop und PC im selben Heimnetz:** verworfen; der Autor kann nur kurz vor Ort sein.
- **Same-Host-Profil `llm`:** verworfen; das ist kein Zwei-Host-Deployment, nach ADR-0035 nur Labor-Vergleichsvariante.
- **Zwei Container ohne VMs:** verworfen; `docker-compose.llm.yml` nutzt `network_mode: host` und bindet an eine private Host-IP, die Release-Dateien liefen dann nicht unverändert.

## Belege

- Laptop: i7-6820HQ, 4 Kerne / 8 Threads, 31 GiB RAM, VT-x, `/dev/kvm` vorhanden, 69 GB frei (geprüft 2026-11-12; Hardware wie im [1C-Laptop-Protokoll](../evidenz/1C/2026-11-05-labor.md)).
- Inferenzzeit mit 4 CPUs / 4 Threads auf dem Laptop: Median 223,7 s, Maximum 255,0 s ([1C-Nachlauf](../evidenz/1C/2026-11-09-labor-nachlauf.md)); mit 2 Kernen läge sie voraussichtlich über der Code-Grenze von 300 000 ms (`OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS`).

## Folgen

- Gültigkeitsgrenze: Beide „Hosts“ teilen CPU, Cache und Speicherbandbreite; die App-VM liegt auf den Hyperthread-Geschwistern der Runtime-Kerne. Für die Zeitzerlegung unkritisch, für die Rückwirkung auf den App-Host (Schritt 3) nicht ausreichend.
- Das virtuelle Netz modelliert das private Produktionsnetz, ist aber nicht dasselbe.
- Niklas nutzt für die Schritte 3–4 die Dateien, nicht die Geräte ([ADR 1B-009](1B-009-portabilitaet-linux-windows.md)).

_Ergänzt 2026-11-14 (Docs-Audit):_ Ein Same-Host-Vergleich (S1, App und Runtime in einer VM) wurde bewusst nicht gemessen; den Vergleich mit und ohne Strecke zwischen den Hosts liefert M2 (C0 nach Dossier 10.3). Begründung im [Design-Nachtrag 2026-11-13](../specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung), Ergebnis im [Laufprotokoll](../evidenz/1B/2026-11-13-lauf.md#nachtrag-2026-11-13-abends-ergänzende-messungen-m1m4).
