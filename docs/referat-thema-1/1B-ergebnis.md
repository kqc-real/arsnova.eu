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

_Aktualisiert 2026-11-16: Zwischenergebnis, Schritte 3–4 noch offen._ Übergabe und Befehle: [Runbook, Abschnitt 8](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34).

### Störversuche

Auf dem i7-10700K unter Hyper-V, Ausführungscommit `5e758d0a`, liegen die
[Normalreihe](evidenz/1B/2026-11-15-lauf-normal-summary.md) und die gewertete
[F1-/B0-Reihe](evidenz/1B/2026-11-15-lauf-f1-summary.md) für Summary vor.
Die F1-Reihe bestätigt RST und schnellen extraktiven Fallback; Rücknahme und
Nachprüfungen sind belegt. Die Normalreihe verwirft weiterhin sämtliche
Modellzusammenfassungen am Qualitätstor. Weitere Störvarianten, Label-Reihen
und der gerichtete Queue-/Breaker-Nachweis stehen aus.

_Ergänzt 2026-11-16:_ Die erste
[F2-Entwicklungsprobe](evidenz/1B/2026-11-16-lauf-dev-f2-summary.md) ist kein
DROP-Nachweis: ufw übersprang die Regel, die Inferenz blieb erreichbar.
Die Aktivierungsprüfung wurde lokal korrigiert; eine wirksame F2-Reihe fehlt weiterhin.

_Ergänzt 2026-11-16:_ Die
[zweite F2-Entwicklungsprobe](evidenz/1B/2026-11-16-lauf-dev-f2-summary-v2.md)
bestätigt nun die DROP-Wirkung des korrigierten Helfers auf der VM sowie
erfolgreiche Rücknahme und Nachprüfungen. Die gewertete F2-Reihe bleibt offen.

_Ergänzt 2026-11-16:_ Die [gewertete F2-Summary-Reihe](evidenz/1B/2026-11-16-lauf-f2-summary.md)
ist abgeschlossen und ausgewertet: wirksamer DROP bei allen Aufträgen,
Fallback innerhalb des Budgets, Live-Last ohne Fehler und erfolgreiche
Wiederherstellung. Der offengelegte versionsübergreifende Vergleich bestätigt
den Unterschied zu F1; die Beitrittslatenz überschreitet jedoch die
vorab festgelegte p95-Schwelle. Zahlen, Auswertungsstand und Grenzen stehen im
Laufprotokoll. Label-F2 und weitere Störvarianten bleiben offen.

_Ergänzt 2026-11-16:_ Die
[L3-Summary-Entwicklungsprobe](evidenz/1B/2026-11-16-lauf-dev-l3-summary.md)
bestätigt erstmals den verzögerten Fake auf den VMs, den Timeout-Fallback und
die Wiederherstellung der echten Runtime. Die gewertete L3-Reihe bleibt offen;
die Einzelprobe belegt keinen internen Breaker-Zustand.

_Ergänzt 2026-11-16:_ Die [gewertete L3-Summary-Reihe](evidenz/1B/2026-11-16-lauf-l3-summary.md)
ist erhoben und ausgewertet. Alle Aufträge erreichen den Timeout-Fallback
innerhalb der Toleranz; Live-Fehlerkriterium und Wiederherstellung bestehen.
Das Live-Latenzkriterium besteht wegen der Blitzlicht-p95 nicht vollständig.
Versionsvergleich, Client-/Job-Zeitunterschied und die begrenzte
Runtime-Ressourcenaufzeichnung sind im Protokoll offengelegt. Label-L3 und
gerichteter Queue-/Breaker-Nachweis bleiben offen.

_Ergänzt 2026-11-16:_ Die
[Slot-belegt-Summary-Entwicklungsprobe](evidenz/1B/2026-11-16-lauf-dev-busy-summary.md)
bestätigt den Busy-Fallback nach HTTP 503 bei der Slot-Abfrage, ohne
Completion-POST. Wiederherstellung bestanden; die gewertete Busy-Reihe bleibt
offen. Keine Aussage zum internen Circuit Breaker aus der Einzelprobe.

_Ergänzt 2026-11-16:_ Die [gewertete Slot-belegt-Summary-Reihe](evidenz/1B/2026-11-16-lauf-busy-summary.md)
ist ausgewertet. Alle Jobs zeigen den erwarteten Busy-Fallback ohne
Completion-POST, Live-Fehlerkriterium und Wiederherstellung bestehen.
Beitritts- und Blitzlicht-p95 überschreiten die festgelegte Latenzschwelle.
Zahlen, Versionsprüfung und Grenzen stehen im Protokoll. Damit liegen die
geplanten Summary-Reihen Normal, F1/B0, F2, L3 und Slot-belegt vor;
Label-Reihen und gerichteter Queue-/Breaker-Nachweis bleiben offen.

_Ergänzt 2026-11-16:_ Die [erste Label-Normalprobe](evidenz/1B/2026-11-16-lauf-dev-normal-label.md)
ist nach erfolgreicher Encoder-Einrichtung am fehlenden Label-Nachweis
abgebrochen. Kein vollständiges Messfenster und keine gewertete Baseline.
Ursache noch offen; Labordiagnose ergänzt. Encoder und SEMANTIC bleiben aktiv,
Dienste sind nach dem Abbruch gesund. Node-Version und effektiver
Encoder-Timeout sind vor gewerteten Label-Reihen zusätzlich zu klären.

_Ergänzt 2026-11-16:_ Die [Label-Diagnoseprobe](evidenz/1B/2026-11-16-lauf-dev-normal-label-diagnose.md)
zeigt den übersprungenen LLM-Pfad nach einem Semantic-Cluster-Fallback.
Der Label-Testkorpus wurde lokal korrigiert; VM-Nachweis steht aus.
Die App läuft bereits mit Node 24, die VM-Helfer noch mit Node 22.
Deren Umstellung erfolgt vor dem nächsten Label-Test; keine neue gewertete
Baseline und keine Aussage zur semantischen Modellqualität.

_Ergänzt 2026-11-16:_ Die [Node-24-Umstellung beider VMs](evidenz/1B/2026-11-16-node24-upgrade.md)
ist ausgeführt und nachgeprüft. Dienste gesund; der VM-Nachweis für den
korrigierten Label-Korpus bleibt offen. Noch keine gewertete Label-Baseline.

_Ergänzt 2026-11-16:_ Die [Label-Probe v2](evidenz/1B/2026-11-16-lauf-dev-normal-label-v2.md)
bestätigt den korrigierten Korpus mit tatsächlicher Inferenz und übernommener
Label-Antwort. Vollständige Live-/Ressourcenmessung und Dienstprüfungen.
Vor der gewerteten Baseline sind die lokal korrigierte Manifest-Erfassung
und Korpusauswahl regulär zu committen; die Probe bleibt Entwicklung.

_Ergänzt 2026-11-16:_ Die [gewertete Label-Normalreihe Teil 1](evidenz/1B/2026-11-16-lauf-normal-label-01.md)
auf `7c64dd6a` liegt vollständig vor, einschließlich bestätigter Manifest-
Erfassung, übernommener Modellantworten und vollständiger Messfenster.
Zehn von 30 geplanten Normalaufträgen erhoben. Passende Label-B0/F1-Referenz,
weitere Normalaufträge und Störreihen stehen aus; noch kein Label-Isolationsurteil.

_Ergänzt 2026-11-16:_ Auch die [Label-Normalreihe Teil 2](evidenz/1B/2026-11-16-lauf-normal-label-02.md)
ist vollständig ausgewertet, mit kompatiblem Manifest zu Teil 1 und bestandenen
Dienstprüfungen. Damit liegen 20 von 30 geplanten Label-Normalaufträgen vor.
Teil 3 und die eigene Label-B0/F1-Referenz stehen aus; weiterhin kein
Label-Isolationsurteil. Messwerte und gemeinsame Einordnung im Protokoll.

_Ergänzt 2026-11-16:_ [Teil 3 und Gesamtauswertung der Label-Normalreihe](evidenz/1B/2026-11-16-lauf-normal-label-03.md)
liegen vollständig vor. Damit ist die geplante Normalreihe abgeschlossen.
Die eigene Label-B0/F1-Referenz ist der nächste Schritt; Störreihen und
Isolationsurteil bleiben offen. Zahlen, Manifestprüfung und Messgrenzen im
Protokoll. Schritt 3 insgesamt ist noch nicht abgeschlossen.

_Ergänzt 2026-11-16:_ Die [eigene F1/B0-Label-Referenz und der Normalvergleich](evidenz/1B/2026-11-16-lauf-f1-label.md)
liegen vor, einschließlich tatsächlicher RST-Netzversuche und bestandener
Wiederherstellung. Normal/Label gegenüber dieser Referenz zeigt keine
zusätzlichen Live-Fehler, überschreitet aber die vorab festgelegte
Beitritts-p95-Schwelle. H2-Latenz ist in diesem Vergleich nicht erfüllt;
kein allgemeiner Isolationsnachweis. Zahlen, Teilreihenabweichungen und
Kausalitätsgrenzen im Protokoll. Weitere Störreihen bleiben offen.

_Ergänzt 2026-11-16:_ Die [L1-Entwicklungsprobe für Labels](evidenz/1B/2026-11-16-lauf-dev-l1-label.md)
bestätigt die Verzögerung im Mitschnitt und den funktionierenden Label-Pfad.
Vollständige Messung und erfolgreiche Rücknahme; keine gewerteten L1-Daten.
Als Nächstes erste gewertete L1-Teilreihe nach gesonderter Freigabe.

_Ergänzt 2026-11-16:_ [L1/Label Teil 1](evidenz/1B/2026-11-16-lauf-l1-label-01.md)
ist vollständig ausgewertet. Verzögerung und Wiederherstellung bestätigt;
keine zusätzlichen Live-Fehler, Latenzschwellen bei Beitritt und Blitzlicht
überschritten. Zahlen und Kausalitätsgrenzen im Protokoll. Zweite Hälfte der
L1-Reihe bleibt offen.

### Aufgabenabdeckung Schritte 3–4, abgeglichen am 2026-11-16

Abgleich mit [Issue #9](https://github.com/NiklasSkulll/arsnova.eu/issues/9),
[Prüfungsrahmen](00-rahmen-und-pruefung.md#pflicht-nachweiskette-je-person)
und [Aufteilung](01-aufteilung.md#entscheidung-2026-10-23).
Niklas bearbeitet Schritte 3–4; das übernommene Labor aus Schritten 1–2
ist Voraussetzung, kein Ersatz für die eigene Nachweiskette.

| Teil                                                                           | Stand                                                            | Beleg                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vorabplanung, Hypothesen, Schwellen                                            | dokumentiert                                                     | [Planung](1B-3u4-Planung.md)                                                                                                                                                                              |
| Deterministischer Fake, Störungshelfer, Live-/CPU-/RSS-Erfassung und Vergleich | implementiert, lokale Tests vorhanden, mehrere VM-Pfade erprobt  | [Runbook §8–9](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34)                                                                                                                                    |
| Normal/Summary                                                                 | erhoben und ausgewertet; Qualitätsfallback trotz echter Inferenz | [Normalprotokoll](evidenz/1B/2026-11-15-lauf-normal-summary.md)                                                                                                                                           |
| F1, F2, L3, Slot belegt / Summary                                              | geplante Reihen erhoben und ausgewertet                          | [F1](evidenz/1B/2026-11-15-lauf-f1-summary.md), [F2](evidenz/1B/2026-11-16-lauf-f2-summary.md), [L3](evidenz/1B/2026-11-16-lauf-l3-summary.md), [Slot belegt](evidenz/1B/2026-11-16-lauf-busy-summary.md) |
| Normal/Label                                                                   | geplante Reihe vollständig                                       | [Gesamtauswertung](evidenz/1B/2026-11-16-lauf-normal-label-03.md)                                                                                                                                         |
| F1/B0 / Label                                                                  | eigene Referenz vollständig, Normalvergleich ausgewertet         | [F1/B0 Label](evidenz/1B/2026-11-16-lauf-f1-label.md)                                                                                                                                                     |
| L1 / Label                                                                     | erste Hälfte vollständig, zweite Hälfte offen                    | [Teil 1](evidenz/1B/2026-11-16-lauf-l1-label-01.md)                                                                                                                                                       |
| L2 / Label                                                                     | offen, zuerst Entwicklungsprobe mit Wirkungsnachweis             | [Planung](1B-3u4-Planung.md)                                                                                                                                                                              |
| L3, F2, Slot belegt / Label                                                    | offen                                                            | [Planung](1B-3u4-Planung.md)                                                                                                                                                                              |
| Gerichteter Queue-/Breaker-Nachweis                                            | offen; lange Abstände der bisherigen Reihen reichen nicht        | [Runbook](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34)                                                                                                                                         |
| Race zwischen Slot-Sonde und POST                                              | optional, noch offen                                             | [Issue #9](https://github.com/NiklasSkulll/arsnova.eu/issues/9)                                                                                                                                           |
| Schritt 4: S1, Betriebsaufwand, begründete Entscheidung                        | offen                                                            | [Dossier §10–11](1B-private-inferenz-zweiter-host.md#11-betriebsaufwand-bewertung)                                                                                                                        |
| Abschluss: Autorenprüfung, eigener Anteil/KI, PR und Merge                     | offen                                                            | [Eigenanteil](1B-eigenanteil.md#schritte-34-niklas)                                                                                                                                                       |

Die eigene Nachweiskette ist damit weit fortgeschritten, insgesamt aber
unvollständig. Keine pauschale Isolationsbestätigung aus fehlenden Live-Fehlern:
Latenzschwellen wurden mehrfach überschritten. Interne Label-Fallback-Zeiten
und Transportanteil sind weiterhin nur eingeschränkt bzw. nicht nachgewiesen.
Issue-Checkboxen bleiben unverändert; Tabellenstand beschreibt die lokale Evidenz.

_Ergänzt 2026-11-16:_ [L1 Teil 2 und Gesamtvergleich](evidenz/1B/2026-11-16-lauf-l1-label-02.md)
schließen die L1-Reihe ab. Teil 2 hält die Latenzschwellen ein; gemeinsam mit
Teil 1 sind sie bei Beitritt und Blitzlicht überschritten. Keine zusätzlichen
Live-Fehler, vollständige Messungen und bestandene Wiederherstellung.

_Aktualisiert 2026-11-16 auf Wunsch von Niklas:_ Der [gekürzte Restplan](1B-3u4-Planung.md#nachtrag-2026-11-16-l1-abgeschlossen-restumfang-auf-pflichtnachweise-begrenzt)
ersetzt die offenen Umfangsvorschläge der vorstehenden Übersicht: L1 ist
abgeschlossen; L2, L3/Label und F2/Label erhalten jeweils drei Aufträge.
Race und zusätzliche Slot-belegt-Label-Reihe entfallen. Pflichtnachweise zu
Queue/Breaker, Transport, S1 und Betriebsentscheidung bleiben bestehen.
Kleine Wiederholungszahlen begrenzen die Aussagekraft, Schwellen bleiben gleich.

_Ergänzt 2026-11-16:_ [L2/Label](evidenz/1B/2026-11-16-lauf-l2-label.md)
ist mit dem vorab reduzierten Umfang vollständig. Tatsächliche Verzögerung
bestätigt, Label-Antworten übernommen, Messfenster vollständig und
Wiederherstellung bestanden. H2-Fehler und H2-Latenz für diese kleine Reihe
erfüllt; kein allgemeiner Isolationsnachweis daraus. Normal-/L1-Befunde bleiben
erhalten. Im gekürzten Label-Programm stehen noch L3 und F2 aus.

_Ergänzt 2026-11-16:_ [L3/Label](evidenz/1B/2026-11-16-lauf-l3-label.md)
ist mit dem vorab reduzierten Umfang vollständig. Verzögerter POST-Pfad und
transientes Label-Ergebnis beobachtet, vollständige Messfenster und bestandene
Wiederherstellung. H2-Fehler/Latenz für diese Reihe erfüllt; interne
Fallback-Frist bleibt wegen fehlender API-Zeiten nicht vollständig prüfbar.
Im gekürzten Label-Programm steht nur noch F2 aus. Gerichteter Queue-/Breaker-
Nachweis, Transportauswertung und Schritt 4 bleiben separat offen.

_Ergänzt 2026-11-16:_ [F2/Label](evidenz/1B/2026-11-16-lauf-f2-label.md)
ist vollständig ausgewertet, einschließlich bestätigtem Kernel-DROP,
Netzversuchen und bestandener Wiederherstellung. Keine zusätzlichen Live-
Fehler, Latenzschwellen bei Beitritt und Blitzlicht überschritten. Das
gekürzte Label-Programm ist abgeschlossen. Schritt 3 insgesamt bleibt wegen
gerichtetem Queue-/Breaker-Nachweis und offener Transportauswertung
unvollständig; Schritt 4 folgt separat. Interne Label-Zeitkriterien bleiben
mangels API-Zeiten nicht bewertbar.

_Ergänzt 2026-11-16:_ Die [gerichtete F1-Breaker-Kontrolle](evidenz/1B/2026-11-16-lauf-breaker-f1-summary.md)
ist bestätigt: drei tatsächliche RST-Fehler, danach `circuit_open` ohne neuen
Netzversuch. Wiederherstellung bestanden. Das belegt die zählende
Kontrollfolge, beantwortet aber noch nicht H-Queue. Als Nächstes dieselbe
kurze Folge mit L3-Timeouts, ohne zusätzliche lange Live-Fenster.

_Ergänzt 2026-11-16:_ Der [gerichtete H-Queue-Nachweis mit F1-Kontrolle](evidenz/1B/2026-11-16-lauf-breaker-l3-summary.md)
ist ausgewertet. Anders als bei den zählenden F1-Fehlern erreicht auch der
vierte Queue-Timeout-Auftrag erneut die Runtime. Das stützt H-Queue für den
beobachteten Ablauf; interner `aborted`-Status nicht direkt ausgelesen,
Codebezug und Timer-Grenzen im Protokoll. Wiederherstellung bestanden.
Keine weiteren optionalen Breaker-Versuche geplant. Transportauswertung
und Schritt 4 bleiben offen; kein vorschneller Gesamtabschluss von Schritt 3.

_Aktualisiert 2026-11-16:_ Die [Offline-Transportauswertung](evidenz/1B/2026-11-16-transportauswertung.md)
schließt die zuvor offene Transportbetrachtung: tatsächliche Runtime-Timings
aller Label-Normalaufträge mit Drahtzeiten zugeordnet, eigene Summary-
Zerlegung reproduziert. Die Label-Transportschwelle ist im beobachteten
Normalbetrieb unterschritten; kein neuer Laborlauf. Frühere Hinweise auf
fehlende Label-Inferenzzeiten beschreiben die API und den damaligen
Auswertungsstand; die Normal-Inferenzzeiten konnten nun aus den vorhandenen
Runtime-Antworten gewonnen werden. Interne Label-Fallback-Zeiten bleiben
weiterhin nicht direkt messbar.

Schritt 3 ist für den vereinbarten gekürzten Umfang inhaltlich bearbeitet.
Die Latenzschwellen sind mehrfach nicht erfüllt, weshalb ein allgemeiner
Isolationsgewinn nicht bestätigt wird. Autorenprüfung und Eigenanteil/KI
bleiben offen; Schritt 4 mit S1 und Betriebsentscheidung sowie PR/Merge
sind hiermit nicht abgeschlossen.

### Rückwirkung auf den App-Host

Live-Fenster und CPU/RSS sind in beiden Reihen vollständig, ohne Live-Fehler.
Der getrennte Normal-zu-F1-Vergleich überschreitet bei Quizstimmen die
festgelegte p95-Schwelle. Messwerte und Gültigkeitsgrenzen stehen im
[F1-Protokoll](evidenz/1B/2026-11-15-lauf-f1-summary.md#live-last-und-app-ressourcen).
Ein allgemeiner Isolationsgewinn ist damit noch nicht nachgewiesen; die weiteren
Varianten werden gegen die vorab vorgesehene B0/F1-Referenz geprüft.

_Ergänzt 2026-11-16:_ Für Labels ist die eigene B0/F1-Referenz inzwischen
vorhanden; auch hier besteht der Normalvergleich die Latenzschwelle nicht.
Der [Label-Vergleich](evidenz/1B/2026-11-16-lauf-f1-label.md#normalreihe-gegenüber-eigener-b0f1-referenz)
enthält die getrennte Auswertung. Der ältere Summary-Befund bleibt erhalten.

### Betriebsaufwand

Bewertung folgt nach den Störreihen. Noch keine abschließende Entscheidung
zum Verhältnis von Isolationsgewinn und Aufwand der zweiten Serverrolle.

## Gemeinsames Kurzfazit

_Platzhalter, nach beiden Hälften gemeinsam._
