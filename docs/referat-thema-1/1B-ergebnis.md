# 1B: Ergebnisbericht – private Inferenz auf einem zweiten Host

Stand: 2026-11-13 (Entwurf, Schritte 1–2 von Jonas) · Prüfung durch den Autor: 2026-11-13, ohne Einwände; Nachträge bis 2026-11-14 geprüft am 2026-11-14, ohne Einwände · _Aktualisiert 2026-11-14 (Docs-Audit):_ Aufgabenabdeckung, Befunde und Issue-Links präzisiert, Qualitätstor an allen Aufträgen belegt

Auftrag, Leitfrage und Hintergrund: [1B-Dossier](1B-private-inferenz-zweiter-host.md). Design und Plan: [Design](specs/2026-11-12-1b-zwei-host-design.md), [Plan](specs/2026-11-12-1b-zwei-host-plan.md). Diagramme und Code-Belege: [1B-Diagramme](1B-diagrams.md). Entscheidungen: [ADR 1B-001 bis 1B-012](adr/README.md).

## Schritte 1–2 (Jonas)

**Leitfrage** (vom Autor bestätigt 2026-11-13, [ADR 1B-011](adr/1B-011-zeitbegriffe-und-leitfrage.md)): Wie schlüsselt sich die Zeit eines echten Kompass-Auftrags (Q&A-Zusammenfassung V2 mit der 1C-Referenzfixture) über die zweite private Serverrolle auf, und wie groß ist der Transportanteil im Vergleich zur Inferenz?

**Kurzantwort:** Fast die ganze Zeit ist Inferenz (99,9 %); der Transport kostet im Median 17,8 ms, davon Netz unter 1 ms (gewerteter Lauf, n = 10, Commit `8e9d1317`, ThinkPad P50). _Ergänzt 2026-11-13:_ Eine Kontrollanfrage über die Strecke ist nicht langsamer als lokal (−2,0 ms, C0 nach M2), und fällt die zweite Rolle aus, antwortet die App ohne Wartezeit extraktiv (88,5 ms, B0); Commit `9e111d35`, gleicher Rechner.

### Aufgabenabdeckung

| Schritt des Auftrags                                           | Ergebnis                                                                                                                                                                                                                                                                                                                                                              | Beleg                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1: Zwei-Host-Deployment nach Release 1.3 reproduzieren         | Zwei KVM-VMs auf dem Laptop, aufgebaut mit einem Befehl (`labor.sh up`), alle automatischen Prüfungen bestanden; Abgleich mit ADR-0035 und dem Abnahmeprotokoll des Runbooks; Manifest nach Dossier 3.8; App-Adapter, Encoder (nicht gestartet) und LLM-Server getrennt ausgewiesen ([Komponenten](evidenz/1B/2026-11-12-aufbau.md#komponenten-am-stand-des-aufbaus)) | [Aufbauprotokoll](evidenz/1B/2026-11-12-aufbau.md), [Runbook](evidenz/1B/runbook.md)                                           |
| 2: realer Summary-Auftrag, Netz, Adapter und Inferenz getrennt | n = 10 über die echte App, Netz, Adapter und Inferenz je Auftrag getrennt (Mitschnitt auf beiden Hosts, `timings` der Runtime); dritter Versuch gewertet, zwei Abweichungen offengelegt; den Label-Auftrag aus #8 misst 1B bewusst nicht ([ADR 1B-004](adr/1B-004-summary-auftrag-referenzfixture.md))                                                                | [Laufprotokoll](evidenz/1B/2026-11-13-lauf.md)                                                                                 |
| Nachbau auf anderen Rechnern (Auftrag des Autors)              | Linux getestet; Windows mit Pester und teilweise auf echtem Windows 11 getestet; voller Aufbau unter Windows offen (in einer VM nicht verlässlich möglich), erster echter Aufbau durch Niklas. Beide Wege schützen den Rechner: Abbruch ohne Anlegen, wenn RAM oder Platz nicht reichen                                                                               | [Windows-Test](evidenz/1B/2026-11-13-windows-test.md), [ADR 1B-010](adr/1B-010-aufbau-automatisiert-mit-groessenempfehlung.md) |

### Kernaussage B: Wo steckt die Zeit?

**Die Zeit steckt in der Inferenz; die Zwei-Host-Topologie kostet keine relevante Zeit.** Gewerteter Lauf (n = 10, Commit `8e9d1317`, ThinkPad P50, [Laufprotokoll](evidenz/1B/2026-11-13-lauf.md)):

| Hypothese | Messwert                                 | Schwelle                         | Urteil  |
| --------- | ---------------------------------------- | -------------------------------- | ------- |
| H_B1      | Netz Median **0,43 ms**, Maximum 1,36 ms | Median ≤ 50 ms, Maximum ≤ 200 ms | erfüllt |
| H_B2      | Adapter Median **101 ms**                | Median ≤ 2 s                     | erfüllt |
| H_B3      | Inferenzanteil Median **99,92 %**        | ≥ 95 %                           | erfüllt |

Kalt (Auftrag 1) dauert ein Auftrag 213,7 s, warm (Prompt aus dem Cache, Aufträge 2–10) im Median 148,6 s. _Ergänzt 2026-11-13:_ Fünf weitere Kaltläufe mit je frischer Runtime: Median 200,5 s (187,1–210,1 s), Inferenzanteil 99,92–99,94 %, Netz im Median 0,37 ms; H_B3 gilt damit auch kalt mit n = 5 ([Laufprotokoll, Nachtrag M1–M4](evidenz/1B/2026-11-13-lauf.md#nachtrag-2026-11-13-abends-ergänzende-messungen-m1m4), Commit `9e111d35`). Hauptwert ist die Netzzeit in Millisekunden; der Prozentanteil fällt auf langsamer Hardware hoch aus. Die Netzmessung hat bei langen Aufträgen eine Auflösung von etwa ±1 ms (zwei VM-Uhren), weit unter der Schwelle.

Die Hypothesen und Schwellen standen vor dem Lauf fest ([Design Abschnitt 6](specs/2026-11-12-1b-zwei-host-design.md#6-hypothesen-messgrößen-regeln-autor-aussagen-b-und-c-schwellen-ki-vorschlag)): H_B1 Netz im Median ≤ 50 ms und höchstens 200 ms, H_B2 Adapter im Median ≤ 2 s, H_B3 Inferenz ≥ 95 % der Auftragszeit im Median. Fehlt bei einem Auftrag eine Komponente, gilt keine Hypothese als bestätigt oder widerlegt ([`zeitzerlegung.mjs`](evidenz/1B/messung/zeitzerlegung.mjs), Regel vom 2026-11-13, vom Autor bestätigt am 2026-11-13).

### Befund C: Im Betrieb sieht niemand, wohin die Zeit geht

Die App nimmt die `timings` der Runtime an, liest sie im Summary-Pfad aber nicht aus; an Zeiten enthält das Log nur die Gesamtzeit `latencyMs`. Netz, Adapter und Inferenz lassen sich deshalb nur mit Mitschnitt und Kontrollanfrage trennen. Belege mit Zeilen: [Aufbauprotokoll, Befund 6](evidenz/1B/2026-11-12-aufbau.md#befunde-für-kernaussage-c) und [Belegtabelle](1B-diagrams.md#belegtabelle). Neu aus dem Lauf: Warum eine Modellantwort verworfen wird, steht in keinem Log; das Log nennt nur den groben Grund `invalid_response` ([Laufprotokoll, Befund C](evidenz/1B/2026-11-13-lauf.md#befund-c-was-der-betrieb-sieht)). Weitere Lücken des Nachbaus (nicht öffentliche Image-Digests, Runbook §6 bricht den Produktionswrapper, fehlender Befehl für den Dritthost-Negativtest, App-Start hängt an der Redis-Bestätigung, Push großer Layer in die lokale Registry läuft in Timeouts): [Aufbauprotokoll, Befunde 1–5](evidenz/1B/2026-11-12-aufbau.md#befunde-für-kernaussage-c).

**Empfehlung (kein Patch):** Zeiten (`elapsedMs`, `timings`) für Summary und Label ohne Prompttext ins Log schreiben ([Design Abschnitt 6](specs/2026-11-12-1b-zwei-host-design.md#6-hypothesen-messgrößen-regeln-autor-aussagen-b-und-c-schwellen-ki-vorschlag)), dazu den Grund eines Fallbacks. Angelegt als Issues [#19](https://github.com/NiklasSkulll/arsnova.eu/issues/19) (Zeiten) und [#20](https://github.com/NiklasSkulll/arsnova.eu/issues/20) (Grund des Fallbacks); die Lücken des Nachbaus als [#21](https://github.com/NiklasSkulll/arsnova.eu/issues/21) (Runbook §6) und [#22](https://github.com/NiklasSkulll/arsnova.eu/issues/22) (Dritthost-Negativtest).

### Befund: Jede Modellantwort wird verworfen

In allen Aufträgen verwirft das Qualitätstor der App die vollständige Antwort von Qwen3-4B; keine der 40 Aussagen des gewerteten Laufs hat die Form „Stichwort: Text“, geprüft mit der Funktion des Tors an allen 10 Antworten (dazu Probe und Kaltläufe). Die Antworten sind außerdem englisch statt deutsch; die Sprache prüft das Tor aber nicht. Die Lehrperson sieht die extraktive Ersatzzusammenfassung. Das bestätigt [ADR 1C-018](adr/1C-018-quality-gate-verwirft-echte-antworten.md) im Zwei-Host-Aufbau. Damit gehen 99,9 % der Auftragszeit in ein Ergebnis, das nicht ankommt ([Laufprotokoll](evidenz/1B/2026-11-13-lauf.md#befund-jede-modellantwort-verworfen)).

### Nachtrag M1–M4: Kontrolle, Ausfall und Netzbelege

Vorab festgelegt und vom Autor freigegeben ([Design, Nachtrag 2026-11-13](specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung)); Commit `9e111d35`, ThinkPad P50, Labor am Abend von null neu aufgebaut ([Laufprotokoll, Nachtrag](evidenz/1B/2026-11-13-lauf.md#nachtrag-2026-11-13-abends-ergänzende-messungen-m1m4)):

| Hypothese      | Messwert                                                                 | Schwelle                         | Urteil  |
| -------------- | ------------------------------------------------------------------------ | -------------------------------- | ------- |
| H_C0 (M2)      | Differenz der Mediane app-host − llm-host **−2,0 ms** (348,7 / 350,7 ms) | ≤ 5 ms                           | erfüllt |
| H_B0 (M3)      | 10 von 10 `extractive`/`unavailable`, T_job Median **88,5 ms**           | alle `unavailable`, Median ≤ 2 s | erfüllt |
| H_B3 kalt (M4) | Inferenzanteil 99,92–99,94 % in 5 von 5, Netz Median 0,37 ms             | ≥ 95 % in allen; Netz ≤ 50 ms    | erfüllt |

M1 belegt die Netzannahme aus Dossier 10.6: Port 8080 hört nur auf der privaten Adresse und lässt nur den app-host zu; Anfragen kommen mit dessen Adresse an ([Belege](evidenz/1B/messung/2026-11-13-belege/)). S1 (Same-Host) wurde begründet nicht gemessen; C0 nach M2 grenzt den Transport direkter ab, weil es dieselbe Anfrage mit und ohne Strecke zwischen den Hosts misst. Was dadurch fehlt: ein Vergleich des ganzen Auftrags auf einem einzigen Host; der hätte zusätzlich die CPU-Teilung von App und Runtime gemessen ([Design, Nachtrag](specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung)).

### Gültigkeitsgrenze D

Ein privates Netz belegt weder Autorisierung noch Datenschutz; der Token läuft zwischen den Hosts im Klartext über HTTP. Weitere Grenzen des Labors (eine physische CPU für beide „Hosts“, weniger CPUs als in Produktion, virtuelles statt physisches Netz): [Design Abschnitt 8](specs/2026-11-12-1b-zwei-host-design.md#8-gültigkeitsgrenzen), [1B-Diagramme, Abweichungen und Grenzen](1B-diagrams.md#abbildung-1-topologie-des-labors).

### Entscheidung

H_B1–H_B3 erfüllt, daher nach der Regel aus [Design Abschnitt 6](specs/2026-11-12-1b-zwei-host-design.md#6-hypothesen-messgrößen-regeln-autor-aussagen-b-und-c-schwellen-ki-vorschlag): **Konfiguration. Der Hebel liegt am Inferenz-Host (Timeout je Host kalibrieren, Limits, Promptgröße); die Zwei-Host-Topologie kostet keine relevante Zeit.** Vorher lohnt es, das Qualitätstor mit dem ausgelieferten Modell abzustimmen (Issue [#13](https://github.com/NiklasSkulll/arsnova.eu/issues/13)), sonst bleibt jede schnellere Inferenz ohne Nutzen.

## Schritte 3–4 (Niklas)

_Gliederung, Inhalt folgt von Niklas._ Übergabe und Befehle: [Runbook, Abschnitt 8](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34).

### Störversuche

### Rückwirkung auf den App-Host

### Betriebsaufwand

## Gemeinsames Kurzfazit

_Platzhalter, nach beiden Hälften gemeinsam._
