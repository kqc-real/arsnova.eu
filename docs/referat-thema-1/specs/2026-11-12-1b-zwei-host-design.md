# Design: 1B Schritte 1–2 – Zwei-Host-Deployment und ein echter Summary-Auftrag

- **Stand:** 2026-11-12, Entwurf zur Freigabe durch den Autor (Jonas); _aktualisiert 2026-11-13:_ vom Autor vor dem [Plan](2026-11-12-1b-zwei-host-plan.md) am 2026-11-12 freigegeben, der Nachtrag vom 2026-11-13 vor dessen Läufen
- **Branch:** `feature-1B-two-host`, abgezweigt von Fork-`main` `a19ca70f` (upstream am 2026-11-12 nachgezogen)
- **Umfang:** 1B Schritte 1–2 (Jonas). Schritte 3–4 (Niklas) bauen danach in einer eigenen PR darauf auf.
- **Kennzeichnung:** „Autor“ = im Gespräch vom Autor entschieden. „KI-Vorschlag“ = Entscheidung des Agenten, vom Autor beim Lesen zu prüfen. „Bauende entscheiden“ = bewusst offen gelassen.

## 1. Zweck

1B fragt, welchen messbaren Isolationsgewinn und Betriebsaufwand die zweite private Serverrolle bringt ([Auftrag 1B](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#gruppenauftrag-1b-private-inferenz-als-getrennte-serverrolle)). Die Schritte 1–2 liefern die Grundlage: einen nachgebauten Zwei-Host-Aufbau mit den Sicherungen des Releases und einen echten Summary-Auftrag, dessen Dauer in Netz, Adapter und Inferenz zerlegt ist. Niklas nutzt denselben Aufbau als Dateien (nicht dieselben Geräte) für Latenz, Ausfall und Rückwirkung auf den App-Host.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**

- Z1: Ausführbarer Zwei-Host-Aufbau aus zwei VMs, der die Release-Dateien `docker-compose.prod.yml` (App-Host) und `docker-compose.llm.yml` mit `scripts/open-weight-llm/prod-compose.mjs` (Inferenz-Host) möglichst unverändert nutzt.
- Z2: Abgleichtabelle Aufbau gegen ADR-0035, Zweit-Host-Runbook (§17 Abnahme) und Referenzmanifest; jede Zeile mit Status (erfüllt, abweichend, nicht prüfbar) und Prüfbefehl. App-Adapter, Encoder und LLM-Server getrennt ausweisen.
- Z3: Ein gewerteter Lauf mit echten Summary-Aufträgen über die echte App; Zeiten für Netz, Adapter und Inferenz getrennt, ohne Eingriff in den Release-Pfad.
- Z4: Der Aufbau ist portabel: unter Linux getestet, unter Windows dokumentiert, damit Niklas ihn auf seinem Rechner nachbauen kann.

**Nicht-Ziele**

- Latenz- und Ausfallversuche, Rückwirkung auf den App-Host unter Live-Last, Bewertung des Betriebsaufwands (Schritte 3–4, Niklas).
- Qualität der Modellantwort (1C, [ADR 1C-018](../adr/1C-018-quality-gate-verwirft-echte-antworten.md)).
- Sicherheitsprüfung über die Gültigkeitsgrenze hinaus (Thema 5).

**Anti-Ziele** (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Produktionscode ändern. Erlaubt sind Tests, Testhelfer und Skripte.
- Einen Prozentwert des Netzanteils als Hauptaussage verwenden (siehe 7, Falle der langsamen Hardware).
- Den Release-Pfad still ändern: Jede Abweichung steht in Tabelle 3.4.
- Etwas auf eine nicht isolierte Netzschnittstelle binden oder ins Internet öffnen.
- Tokens, `.env`-Inhalte oder Paketmitschnitte mit Bearer-Header einchecken.

## 3. Aufbau

### 3.1 Topologie (Autor)

Zwei KVM-VMs auf dem Laptop des Autors (ThinkPad P50, i7-6820HQ, 4 Kerne / 8 Threads, 31 GiB RAM, VT-x, `/dev/kvm` vorhanden; 69 GB frei, geprüft 2026-11-12). Der Desktop-PC wird nicht genutzt.

```text
Laptop (Arch/Omarchy, KVM)
├── VM app-host   (Ubuntu LTS, Docker): docker-compose.prod.yml → app, postgres, redis, pdf-worker
│        │  isoliertes virtuelles Netz (privates /24, keine Weiterleitung nach außen)
│        │  HTTP, TCP 8080, Authorization: Bearer <Token>
│        ▼
└── VM llm-host   (Ubuntu LTS, Docker, ufw): docker-compose.llm.yml über prod-compose.mjs
                  → llama-server b10524, Qwen3-4B-Instruct-2507 Q4_K_M, Bind auf die private VM-IP
```

- **Gastsystem:** Ubuntu LTS, weil das [Zweit-Host-Runbook](../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md) für APT und `ufw` geschrieben ist; der Nachbau prüft das Runbook damit mit (KI-Vorschlag).
- **Einrichtung:** je VM eine cloud-init-Konfiguration, die die Runbook-Schritte ausführt (Docker, Firewall, Repo-Stand, Modell, Start). Secrets entstehen in der VM, nie im Repo (KI-Vorschlag).
- **CPU (KI-Vorschlag nach Builder-Check):** Die llm-host-VM bekommt 4 vCPUs, fest auf je einen Thread der vier physischen Kerne gelegt; die Runtime läuft mit 4 Threads. Das entspricht dem 1C-Laptop-Nachlauf (4 CPUs, 4 Threads; Median der Inferenz 223,7 s, Maximum 255,0 s, [Nachlauf-Protokoll](../evidenz/1C/2026-11-09-labor-nachlauf.md)) und hält die Werte mit 1C vergleichbar. Mit nur 2 Kernen läge die Inferenz voraussichtlich über der Code-Grenze von 300 000 ms (`OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS` in `openWeightLlmConfig.ts`, gleiche Grenze in `qaSummaryConfig.ts`); dann gäbe es keine gültige Inferenzzeit. Die app-host-VM bekommt 2 vCPUs auf den Hyperthread-Geschwistern; sie wartet während der Inferenz fast nur. Das ist eine zusätzliche Gültigkeitsgrenze (8). **Abbruchregel:** Liegt die Kalibrierungsanfrage über 270 s, wird nicht gewertet gemessen; der Autor entscheidet neu (kein stilles Verkleinern von Fixture oder Prompt).
- **RAM:** llm-host mindestens 12 GiB (Runbook-Untergrenze), app-host nach Bedarf der App (Bauende entscheiden, Startwert 6 GiB).
- **Modell:** Das GGUF liegt aus 1C auf dem Laptop; ob es kopiert oder schreibgeschützt eingebunden wird, entscheiden die Bauenden. Geprüft wird es wie im Runbook per SHA-256 gegen `docker/open-weight-llm/model-manifest.json`.
- **Runtime-Image:** `prod-compose.mjs` verlangt eine Referenz mit `@sha256:`-Digest; im Repo steht kein Digest (Dossier, Abschnitt 13, Frage 2). Die Bauenden wählen den Weg (etwa eine lokale Registry in der llm-host-VM nach Runbook Anhang A) und dokumentieren ihn als Befund für Kernaussage C.
- **Encoder und spaCy** bleiben aus (Release-Default `false`, Profile werden nicht gestartet). Der Encoder wird in der Abgleichtabelle als Komponente des App-Hosts ausgewiesen, nicht betrieben.

**Verworfen** (für ADR 1B-002): PC plus Laptop über WireGuard (Netzzeit würde einen Internet-Tunnel messen, instabile Verbindung, PC aus der Ferne nicht wiederherstellbar); PC und Laptop im Heimnetz (Anwesenheit am Messtag nötig); Same-Host-Profil `llm` (kein Zwei-Host-Deployment). Grundlage der Wahl: Antwort des Prüfers „Die Laborinstanz ist Ihr eigener Rechner“ ([Rahmendokument, Frage 4](../00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)). Keine Mail an den Prüfer; die Begründung steht im ADR (Autor).

### 3.2 Portabilität (Autor)

Kern ist plattformneutral: Ubuntu-Cloud-Image plus cloud-init-Dateien. Darüber liegt je Plattform eine dünne Startschicht:

- **Linux** (libvirt/QEMU oder gleichwertig): gebaut und echt getestet.
- **Windows** (Niklas, WSL): Zwei WSL-Distributionen sind keine zwei Hosts, weil sie sich eine Hilfs-VM und ein Netz teilen. Die Bauenden wählen einen Weg mit zwei echten VMs (etwa Hyper-V, VirtualBox oder Multipass), prüfen ihn gegen die Herstellerdoku und dokumentieren ihn als „ungetestet, Niklas prüft“. Wenn ein Werkzeug wie Multipass beide Plattformen abdeckt, aber kein CPU-Pinning kann, wird das als Abwägung im ADR festgehalten.

### 3.3 Netz und Sicherheit (Autor, Formulierung KI-Vorschlag)

- Die Runtime bindet an die private IP der llm-host-VM im virtuellen Netz. **Eingehend** ist nichts aus Heimnetz oder Internet erreichbar (keine Portweiterleitung, kein Bridging an die physische Schnittstelle). **Ausgehend** ist NAT erlaubt, weil die Einrichtung Pakete und Images lädt (KI-Vorschlag nach Builder-Check; entspricht dem Produktionsfall, in dem die Hosts ausgehend ins Internet dürfen). Ein abgeschottetes Netz ohne ausgehenden Zugang ist nicht verlangt.
- `ufw` im llm-host wie im Runbook §5: Standard `deny incoming`, SSH, TCP 8080 nur von der IP des app-hosts.
- Bearer-Token wie im Runbook §8.2, nur in den VMs.
- Negativtests (Runbook §10–11, Dossier-Lücke 12): vom Laptop selbst als drittem Host muss `curl` auf `:8080` scheitern; ohne Token und mit falschem Token kommt 401; `/health` ist ohne Token erreichbar (nur vom app-host).
- Die Regel „Laborinstanzen nur auf `127.0.0.1`“ in [`docs/referat-thema-1/AGENTS.md`](../AGENTS.md) wird in dieser PR ergänzt: „`127.0.0.1` oder ein privates virtuelles Netz zwischen Labor-VMs auf demselben Rechner, das von außen nicht erreichbar ist (keine Portweiterleitung, kein Bridging); ausgehendes NAT für die Einrichtung ist erlaubt“. Die `AGENTS.md` im Wurzelverzeichnis bleibt unverändert (gehört upstream).

### 3.4 Abweichungen vom Release (vorab festgelegt)

| Abweichung                                                                                  | Art                          | Grund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QA_SUMMARY_TIMEOUT_MS` und `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` kalibriert statt 90 000 ms | gewählt (Autor)              | Auf dem Laptop lag die Inferenz in 1C über 90 s ([ADR 1C-023](../adr/1C-023-release-timeout-90-s-zu-kurz.md)); Kalibrierung nach dessen Muster: I = `prompt_ms + predicted_ms` einer nicht gewerteten Anfrage, Timeout = I plus Reserve, höchstens 300 000 ms                                                                                                                                                                                                                                                     |
| Runtime mit 4 statt 8 CPUs und 4 statt 8 Threads                                            | erzwungen durch die Hardware | Der Laptop hat 8 Threads insgesamt; Docker lehnt `cpus` über der Kernzahl der VM ab (von den Bauenden zu prüfen). `OPEN_WEIGHT_LLM_THREADS: '8'` steht in `environment:` der Compose-Datei und schlägt `.env.llm`. Override-Datei unter `evidenz/1B/` nach dem Muster von `evidenz/1C/labor-produktionslimits.override.yml`; `mem_limit 8g` und `memswap_limit 10g` bleiben                                                                                                                                       |
| Start der Runtime per `docker compose` mit Override statt über `prod-compose.mjs`           | erzwungen durch die Override | Der Wrapper ruft fest `docker compose -f docker-compose.llm.yml` ohne Platz für eine weitere `-f`-Datei auf. Vorgehen (KI-Vorschlag): Die Prüfungen des Wrappers (Digest, private Bind-Adresse, Token, GGUF-Hash) laufen unverändert, soweit er sie ohne Start ausführen kann (von den Bauenden zu prüfen); gestartet wird mit derselben Compose-Datei plus Override. Release-Dateien im Checkout der VM werden nicht editiert. Die Abgleichtabelle weist aus, welche Wrapper-Prüfungen tatsächlich gelaufen sind |
| Image-Digest aus eigenem Build statt von Release-Verantwortlichen                           | erzwungen                    | Kein Digest im Repo (3.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `QA_SUMMARY_ENABLED=true`, `OPEN_WEIGHT_LLM_ENABLED=true`                                   | nötig für den Auftrag        | Runbook §12.1 verlangt für den ersten Produktivtest `false`; im Labor ist der Summary-Pfad Gegenstand der Messung                                                                                                                                                                                                                                                                                                                                                                                                 |

Weitere Abweichungen, die beim Bauen auftauchen, kommen vor dem gewerteten Lauf in diese Tabelle (als datierter Nachtrag, wenn das Design schon freigegeben ist).

### 3.5 Referenzstand und Manifest

- Codestand: Fork-`main` `a19ca70f` plus Branch-Commits, die nur Doku, Skripte und Testhelfer ändern. ADR 1B-001 begründet die Baseline nach [ADR 1C-001](../adr/1C-001-baseline-aktueller-main.md).
- Manifest: Tabelle 3.8 des [Dossiers](../1B-private-inferenz-zweiter-host.md#38-tabelle-aller-gepinnten-artefakte-und-werte-referenzmanifest-entwurf) am aktuellen Stand ausfüllen (Image-Digest, GGUF-Digest, Flags, Limits, Timeouts) und im Laufprotokoll ablegen. Alle Zeilenangaben des Dossiers (Stand `27966e75`) werden am Stand `a19ca70f` nachgeprüft; sie haben sich verschoben (z. B. `runOpenWeightLlm` jetzt `openWeightLlmClient.ts` Z. 480–589).

## 4. Der Auftrag (Autor)

- **Typ:** Summary V2 (nicht Label), damit 1B an 1C anschließt.
- **Daten:** Referenzfixture aus 1C (Sechs-Fragen-Szenario #456 §12, `apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts`), damit Kontextgröße und Budgets mit 1C vergleichbar sind.
- **Auslösung:** über die echte App im app-host per tRPC (`qa.requestSummary`) mit echter Host-Authentisierung, kein Mock der Tokenprüfung. Wie die Fixture in die Datenbank kommt (über die öffentliche API oder als Seed in die PostgreSQL des app-hosts) und wie das Treiberskript Host-Token und Ergebnis abholt, entscheiden die Bauenden; der Weg wird im Protokoll beschrieben.

## 5. Zeitmessung (KI-Vorschlag)

Ohne Eingriff in den Release-Pfad. Der aufzeichnende Proxy aus 1C passt nicht: Er lauscht nur auf `127.0.0.1` im Vitest-Prozess (`startRecordingProxy` in `apps/backend/src/__tests__/lib/recording-proxy.ts`), und der App-Container erreicht ihn nicht, ohne den Pfad zu ändern.

| Zeit                     | Quelle                                                                                                                                                               | Gemessen auf                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| T_job                    | `latencyMs` aus der Logzeile `qa_summary:completed` (`processJob` in `apps/backend/src/lib/qaSummaryQueue.ts`; umfasst zwei `prepare`-Läufe und den Runtime-Aufruf)  | app-host                                    |
| T_app_wire               | `tcpdump` auf der Schnittstelle des app-hosts zum isolierten Netz: erstes Anfrage-Byte bis letztes Antwort-Byte, je für `GET /slots` und `POST /v1/chat/completions` | app-host                                    |
| T_srv_wire               | dieselben Zeitpunkte per `tcpdump` im llm-host                                                                                                                       | llm-host                                    |
| T_infer                  | `timings.prompt_ms + timings.predicted_ms` aus der Antwort der Runtime (im Mitschnitt lesbar, weil HTTP)                                                             | llm-host (Runtime)                          |
| **Netz**                 | T_app_wire − T_srv_wire, summiert über beide Anfragen                                                                                                                | Differenz je Host, kein Uhrenabgleich nötig |
| **Inferenz**             | T_infer                                                                                                                                                              |                                             |
| **Server ohne Inferenz** | T_srv_wire − T_infer (Template, Tokenisierung, Serialisierung)                                                                                                       |                                             |
| **Adapter**              | T_job − T_app_wire                                                                                                                                                   |                                             |

- Jede Differenz entsteht aus Zeitpunkten **eines** Rechners; die Uhren der VMs müssen nicht abgeglichen sein.
- Zuordnung Mitschnitt ↔ Auftrag: Es läuft immer nur ein Auftrag (ein Slot, ein Inflight); die Bauenden ordnen über die Reihenfolge und Zeitfenster zu.
- **Kontrolle C0:** Dieselbe Anfrage (Body aus dem Mitschnitt) einmal direkt im llm-host per `curl -w` an die eigene IP. Sie zeigt den Serveranteil ohne Netz.
- **Datenschutz:** Mitschnitte enthalten den Bearer-Token. Sie bleiben außerhalb des Repos (wie `LABOR_OUTDIR` in 1C); eingecheckt werden nur abgeleitete Zeitpunkte, Größen und Statuscodes. Der Token wird nach dem Lauf verworfen.
- **Ausführbarer Test:** Die Auswertung (Mitschnitt-Zeitpunkte und Log → Zeitzerlegung) bekommt einen eigenen Test mit synthetischen Eingaben, der in `npm test` oder einer dokumentierten Testsuite läuft (Pflicht „mindestens ein eigener ausführbarer Test“).

## 6. Hypothesen, Messgrößen, Regeln (Autor: Aussagen B und C; Schwellen KI-Vorschlag)

**Kernaussage B:** Die Zeit eines Summary-Auftrags steckt in der Inferenz, nicht im Netz und nicht im Adapter; der Hebel liegt am Inferenz-Host, nicht an der Topologie.

- **H_B1:** Netzzeit je Auftrag (beide Anfragen) im Median ≤ 50 ms und im Maximum ≤ 200 ms.
- **H_B2:** Adapterzeit je Auftrag im Median ≤ 2 s.
- **H_B3:** T_infer ≥ 95 % von T_job im Median.
- **Gegenalternative:** Netz und Adapter zusammen kosten einen relevanten Anteil (> 5 % oder > 2 s), etwa durch zwei Anfragen je Auftrag, doppelten Kontextaufbau oder Server-Overhead außerhalb der Inferenz.
- **Regel:** H_B1–H_B3 erfüllt → Entscheidung „Konfiguration: Hebel am Inferenz-Host (Timeout je Host kalibrieren, Limits, Promptgröße); Zwei-Host-Topologie kostet keine relevante Zeit“. Eine verfehlt → Befund mit Ursache benennen, Entscheidung „Topologie bzw. Adapter genauer prüfen“, keine Beibehaltungsaussage.
- **Hauptwert ist die Netzzeit in Millisekunden.** Der Prozentanteil wird nur mit dem Hinweis genannt, dass er auf langsamer Hardware zu klein ausfällt.

**Zweiter Punkt C:** Im Betrieb sieht heute niemand, wohin die Zeit geht.

- **Befund aus dem Aufbau:** Je Zeitkomponente aus 5 festhalten, ob sie im Release-Betrieb ohne Laborwerkzeug sichtbar ist (Logzeile, Status-API) oder nur mit Mitschnitt bzw. Kontrollanfrage. Dazu die Lücken des Nachbaus (Image-Digest, fehlende Kommandos im Runbook u. Ä.).
- **Entscheidung:** Empfehlung, kein Patch: Zeiten (`elapsedMs`, `timings`) für Summary und Label ins Log, ohne Prompttext (Dossier-Lücken 1–3).

**Gültigkeitsgrenze D (ein Satz):** Ein privates Netz belegt weder Autorisierung noch Datenschutz; der Token läuft zwischen den Hosts im Klartext über HTTP.

**Wiederholungen:** n = 10 gewertete Aufträge in einer Reihe, nach einer nicht gewerteten Kalibrierungsanfrage, mit frisch gestarteter Runtime. Kalt- und Warmfall werden über `timings.cache_n` getrennt ausgewiesen.

## 7. Bekannte Fallen aus 1C (Autor: Timeout; KI-Vorschlag: Rest)

- **Timeout:** siehe 3.4; die einzige gewählte Abweichung.
- **`--cache-ram` / OOM ([ADR 1C-024](../adr/1C-024-prompt-cache-ram-begrenzen.md)):** Release-Wert bleibt. Je Reihe höchstens 10 Aufträge nach frischem Start (1C: Kill beim 21. Auftrag); Speicher des Runtime-Containers im 15-s-Takt protokollieren. Ein OOM wäre ein Befund, kein Messfehler.
- **Quality-Gate ([ADR 1C-018](../adr/1C-018-quality-gate-verwirft-echte-antworten.md)):** Erwarteter Endstatus `ready/extractive/invalid_response`, vorab festgelegt. Die Zeiten gelten trotzdem, weil die Runtime vollständig rechnet, bevor das Gate verwirft.
- **Langsame Hardware:** Absolute Inferenzzeiten gelten nur für diesen Laptop und diese Limits. Siehe Hauptwert in 6.

## 8. Gültigkeitsgrenzen

- Zwei VMs teilen eine physische CPU, Cache und Speicherbandbreite. Für die Zeitzerlegung unkritisch (die App wartet während der Inferenz), für Aussagen zur Rückwirkung auf den App-Host nicht ausreichend (Schritt 3, eigene Hardware von Niklas).
- Das virtuelle Netz ist ein Modell des privaten Produktionsnetzes, nicht dasselbe.
- Runtime mit weniger CPUs als in Produktion (3.4).
- Die app-host-VM liegt auf den Hyperthread-Geschwistern der Runtime-Kerne (3.1); die beiden „Hosts“ teilen sich also auch physische Kerne.
- **App-Image:** `docker-compose.prod.yml` verlangt auch für `app` und `pdf-worker` eine Digest-Referenz (`ARSNOVA_IMAGE`); sie wird wie das Runtime-Image selbst gebaut (Bauende entscheiden den Weg, Befund für C).
- **Fixture:** `createReferenceScenario` aus `qa-summary-pg-fixture.ts`, nicht `createFullContextScenario` (die zweite enthält einen Encoder-Themensnapshot, der Encoder ist aber aus).
- Die Aussagen gelten für den Stand `a19ca70f` und die im Protokoll genannten Artefakte.

## 9. Ergebnisse und Ablage (KI-Vorschlag nach den Ordnerregeln)

- `docs/referat-thema-1/1B-ergebnis.md`: gemeinsames Hauptdokument mit Abschnitten zu Schritten 1–2 und 3–4 und gemeinsamem Kurzfazit (Autor). Diese PR füllt Schritte 1–2 und legt die Gliederung für 3–4 an.
- ADRs `1B-001…019` (Autor); mindestens: Baseline (001), Topologie zwei VMs (002), Netzregel (003), Summary mit 1C-Fixture (004), Abweichungen vom Release (005), Zeitmessung per Mitschnitt (006), Umgang mit den 1C-Fallen (007), Kernaussagen und Schwellen (008), Portabilität (009). Zuschnitt entscheiden die Bauenden.
- `evidenz/1B/`: Laufprotokoll(e), Abgleichtabelle, abgeleitete Rohdaten, Runbook für den Nachbau.
- Skripte und cloud-init-Dateien: unter `evidenz/1B/` oder `scripts/` (Bauende entscheiden; Testhelfer bleiben außerhalb von Produktionscode).
- Belegtabelle mit Zeilennummern in einer Diagrammdoku zu 1B (Ordnerregel „Code-Belege“).
- Eigenanteil je Person (Autor); Datei und Zuschnitt entscheiden die Bauenden.
- `01-aufteilung.md`: Vorschlag „zwei PRs nacheinander, Niklas zweigt nach dem Merge ab“ eintragen, als noch mit Niklas abzustimmen (Autor). `README.md` des Ordners um die neuen Dateien ergänzen. `AGENTS.md` des Ordners nach 3.3.

## 10. Ablauf und Regeln für die Arbeit

- Erst Plan, dann Umsetzung. Läufe am Laptop nur nach Rückfrage beim Autor; der Laptop ist während der Läufe ausgelastet.
- Hypothesen und Schwellen aus 6 gelten mit der Freigabe dieses Designs; Änderungen danach nur als datierter Nachtrag vor dem Lauf.
- Eingefrorene 1C-Dateien bleiben unverändert.
- Commits Englisch nach Conventional Commits, ohne KI-Attribution, nie `--no-verify`.
- Markdown prüfen: `npx prettier --check <dateien>` und `git diff --check`.

## 11. Was den Bauenden überlassen ist

Hypervisor-Werkzeug unter Linux und Windows (3.2), Weg zum Image-Digest (3.1), Fixture-Befüllung und Treiberskript (4), Zuordnung der Mitschnitte (5), Größe der app-host-VM, Ablageort der Skripte, ADR-Zuschnitt (9).

## Nachtrag 2026-11-12: beim Aufbau dazugekommen

Festgehalten nach dem Aufbau, vor Kalibrierung und gewertetem Lauf (Belege: [Aufbauprotokoll](../evidenz/1B/2026-11-12-aufbau.md)).

- **Abhängigkeiten im llm-host:** `npm ci --ignore-scripts` ohne `--omit=dev`, weil der Produktionswrapper sonst `dotenv` nicht findet (Abweichung von Runbook §6, Befund für C).
- **App-Start:** bis zu 3 min Warten auf den automatischen Neustart der App, wenn der Entrypoint an der Redis-Bestätigung scheitert; Release-Verhalten unverändert.
- **Laufsteuerung im app-host:** Mitschnitt, Neustart der Runtime und Kontrolle C0 steuert `lauf.sh` im app-host; dafür ein Labor-SSH-Schlüssel app-host → llm-host im privaten Netz.
- **Kontrolle C0 an frischer Runtime:** vor C0 wird die Runtime neu gestartet, damit keine Runtime mehr als 10 Anfragen sieht (ADR 1B-007).
- **Cooldown zwischen Aufträgen:** 31 s Pause, weil ein Auftrag mit gleichem Inhalt innerhalb von 30 s aus dem Cache käme (`requestQaSummary`).
- **Offen, vom Autor vor dem gewerteten Lauf zu entscheiden:** Ab dem zweiten Auftrag auf derselben Runtime kommt der Prompt aus dem KV-Cache des Slots (Entwicklungslauf: `cache_n` 2346, Prefill 0,26 s statt 85 s). Vorschlag: wie festgelegt 10 Aufträge je frischer Runtime, zusätzlich Auftrag 1 (kalt) und 2–10 (warm) getrennt berichten; Schwellen unverändert. _Ergänzt 2026-11-13:_ Vom Autor bestätigt (Option a), während des dritten gewerteten Versuchs; die Auswertung trennte schon vorher nach `cache_n` und lief unverändert.

## Nachtrag 2026-11-13: ergänzende Messungen nach der Vollständigkeitsprüfung

Eine unabhängige Prüfung gegen Issue #8 und das Dossier fand Lücken: Netzbelege (`ufw status`, `ss -ltnp`, `tcpdump` zur NAT-Annahme) fehlen als Dateien, C0 hat nur n = 1, kalt nur n = 1, B0 und S1 sind weder gemessen noch begründet. Der Autor hat entschieden, die Lücken zu messen (2026-11-13). Hypothesen und Schwellen stehen hier **vor** den Läufen fest (KI-Vorschlag; vom Autor am 2026-11-13 vor den Läufen unverändert freigegeben). Labor: wie gewertet (Linux, ThinkPad P50, Größen und Pinning wie ADR 1B-002, Hintergrund-Updates aus), neu aufgebaut mit dem aktuellen Stand.

| Messung                 | Was                                                                                                                                                                                                                                                                   | Wiederholungen     | Hypothese und Schwelle                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 Belege               | `ufw status verbose` beider Hosts, `ss -ltnp` auf dem llm-host, `tcpdump` am llm-host (nur Kopfzeilen, kein Inhalt), `chronyc tracking` beider Hosts, `.env.llm` und `.env.production` ohne Secrets (Token nur als SHA-256), Manifest (Commit, Image-Digests, Modell) | einmal             | keine Hypothese; Annahme aus Dossier 10.6 belegen: Anfragen der App erscheinen am llm-host mit Quelle `192.168.150.10`, Port 8080 nur auf `192.168.150.20` und nur vom app-host erlaubt      |
| M2 C0 nach Dossier 10.3 | dieselbe kurze Anfrage (`max_tokens` 16, fester Prompt) per `curl` vom llm-host an sich selbst und vom app-host an den llm-host                                                                                                                                       | je 30, abwechselnd | **H_C0:** Differenz der Mediane von `time_total` (app-host − llm-host) ≤ 5 ms. Gegenalternative: ≥ 5 ms, Transport zwischen den Hosts kostet messbar                                         |
| M3 B0                   | Summary-Auftrag bei ausgeschalteter Runtime (`docker stop` vor dem Treiber)                                                                                                                                                                                           | 10                 | **H_B0:** alle 10 enden mit `effectiveMode` extractive und Grund `unavailable`; T_job im Median ≤ 2 s (der Ausfall kostet keine Wartezeit). Gegenalternative: Wartezeit bis zu einem Timeout |
| M4 kalt                 | je ein Auftrag an frisch gestarteter Runtime (`lauf` mit n = 1, fünfmal)                                                                                                                                                                                              | 5                  | **H_B3 kalt:** Inferenzanteil ≥ 95 % in allen 5; Netz im Median ≤ 50 ms (Schwellen wie ADR 1B-008)                                                                                           |

**S1 (Same-Host-Labor) wird nicht gemessen.** S1 soll den Transportanteil gegen eine Messung ohne Netz abgrenzen. Das leisten hier M2 (gleiche Anfrage mit und ohne Strecke zwischen den Hosts) und die Messung an beiden Hosts direkter. Ein Summary-Lauf mit App und Runtime in einer VM würde zusätzlich die CPU-Teilung von App und Runtime mitmessen und wäre mit B2 nicht vergleichbar. Begründung und Kosten im Ergebnis ([ADR 1B-011](../adr/1B-011-zeitbegriffe-und-leitfrage.md) für die Begriffe).

**B0 laut Dossier** meint „Live-Aktionen ohne Inferenz“ als Basis für die Rückwirkung auf den App-Host; diese Basis gehört zu Schritt 3 (Niklas, gleiche Live-Last wie 1A). M3 misst den Teil für Schritte 1–2: was ein Auftrag kostet, wenn die zweite Rolle fehlt.

**Wertung:** M2 bis M4 sind gewertete Läufe dieses Nachtrags; jeder Lauf trägt `umgebung` und Commit. Ergebnis im Laufprotokoll als eigener Abschnitt, Rohdaten unter `messung/`.

## Nachtrag 2026-11-14: Korrektur aus dem Docs-Audit

_Korrigiert 2026-11-14:_ Die Begründung der 31-s-Pause im [Nachtrag 2026-11-12](#nachtrag-2026-11-12-beim-aufbau-dazugekommen) gilt nicht für die tatsächlichen Läufe. Der Cache greift nur, wenn das letzte Ergebnis kein extraktiver Fallback mit `retry: 'manual'` ist (`apps/backend/src/lib/qaSummaryQueue.ts` Z. 494–508); jeder Auftrag endete aber genau so (`qaSummaryRuntimeAdapter.ts` Z. 147–150 mit Standard `manual`, Z. 93). Die Pause war im Lauf also nicht nötig, aber harmlos: Sie liegt zwischen den Aufträgen und geht in keine Messgröße ein.
