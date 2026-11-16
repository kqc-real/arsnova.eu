# Abgebrochene Label-Diagnoseprobe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat die freigegebene Entwicklungsprobe mit einem Label-Auftrag und
Live-Last über `labor-wsl.sh --arbeitsstand` ausgeführt.
Ausführungsstand `8f735b0402a9b78937cc9f7868a0f2fb198ac1cb`, nur Entwicklung.
Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.

Lauf-ID `20261116T095604-dev-normal-label-diagnose`, lokal etwa
10:56–10:57 Uhr MEZ. Quellen im app-host unter
`~/labor-1b/20261116T095604-dev-normal-label-diagnose/`, insbesondere
`treiber.log` und `wiederherstellung.json`; Windows-Log
`%USERPROFILE%\labor-1b\log-lauf-20261116T105545.txt`.
Kein vollständiges Messfenster oder Ergebnis-JSON, keine gewertete Baseline.

## Ursache des übersprungenen Label-Pfads

Die neue Diagnose meldet `status=fallback`, `mode=SEMANTIC`,
`effectiveMode=THEME`, `fallbackUsed=true`, `labelSettlement=null`,
`encoderModelPresent=true`, drei analysierte Fragen und einen lexikalischen
Ergebniseintrag. Das ist kein deaktivierter Encoder.

Die entsprechenden Fallback-Zweige in `wordCloudSemanticAnalyze.ts` liefern
Encoder-Modellmetadaten, wenn `hasReliableSemanticCluster` nicht erfüllt ist.
Andere frühe Abbrüche wie Kill-Switch, zu kleiner Korpus oder Encoder-Fehler
liefern dort keine Modellversion. `wordCloudTopicLabels.ts` überspringt bei
`fallbackUsed=true` die LLM-Beschriftung. Der bisherige Summary-Korpus erreicht
den beabsichtigten Label-Pfad nicht verlässlich. Die Abbruchbedingung des
Labortreibers bleibt richtig.

Der Wordcloud-Aufruf sieht nur ACTIVE/PINNED-Fragen, hier B, C und E.
Die übrigen Fragen sind PENDING. Eine Mindestzahl von Fragen allein garantiert
keinen tragfähigen Themencluster. Wiederherstellung bestätigt:
`restored=true, checksPassed=true`. Encoder und SEMANTIC bleiben aktiv.

## Lokale Korrektur des Testkorpus

`korpus.mjs` wählt nur für Label den Korpus `label-identical-pair-v1`:
B und C erhalten denselben synthetischen Fragetext; E bleibt Gegenbeispiel.
Fragen verschiedener Teilnehmer bleiben getrennte Quellen. Stimmen, Status
und Schlüssel bleiben erhalten. Identische Texte ergeben identische Embeddings
und sollen den Clusterpfad reproduzierbar erreichen. Die Wirkung auf der VM
ist in einer neuen Probe noch zu bestätigen.

Das ist eine kontrollierte Last-/Fehlerfixture, kein Test semantischer Qualität.
Summary und Breaker verwenden weiterhin die unveränderte Referenz.
Korpuskennung in Log und Treiber-JSON; alle folgenden Label-Reihen müssen
denselben Korpus verwenden. Produktionscode bleibt unverändert.

Der Regressionstest zeigte mit der alten Auswahl kein identisches Paar im
sichtbaren Korpus. Danach bestehen zehn ausgewählte Korpus-/Auftrags-/
Auswertungstests unter lokalem Node 24.18.0; Treiber-Syntax geprüft.
Kein bestandener VM-Lauf aus diesen lokalen Tests abgeleitet.

## Node-Version: vor dem nächsten Label-Test umstellen

Lesend im Labor geprüft: Beide VM-Hosts verwenden v22.23.5 aus NodeSource
`node_22.x`. Die App im Container verwendet bereits v24.19.0.
Node 22 betrifft Treiber, Messhelfer und Fake auf den VMs; es ist keine
belegte Ursache des beobachteten Cluster-Fallbacks.

Issue #9 verlangt Node 24. Umstellung beider VMs jetzt vor dem nächsten
Label-Entwicklungstest, zwingend vor der gewerteten Label-Baseline.
Danach alle Label-Varianten mit derselben Node-Version messen. Alte Summary-
Daten behalten ihre tatsächlich verwendete VM-Version; keine nachträgliche
Umdeutung in Node-24-Läufe.

Vorbereitet ist je VM: in `/etc/apt/sources.list.d/nodesource.sources`
`node_22.x` durch `node_24.x` ersetzen, Paketindex aktualisieren, `nodejs`
installieren und Version prüfen. Noch kein Upgrade oder weiterer Test
ausgeführt. Danach Dienste prüfen und die korrigierte Probe separat freigeben.
Die Abweichung zwischen erfasstem und effektivem Encoder-Timeout bleibt vor
gewerteten Label-Reihen zusätzlich zu klären.
