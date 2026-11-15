# A1 – Abschlussprüfung und Übergabe

Stand: 15.11.2026. Diese Unterlage trennt ausgeführte technische Prüfungen von
persönlicher Freigabe und tatsächlicher Abstimmung. Offene Felder sind keine
Behauptung einer bereits erfolgten Bestätigung.

## Technischer Nachweis

- [Aktuelle Reihe](./evidenz/1A/reihe-main-a19ca70f-20261115-122547/): vollständiger Vorlauf und 25 Messläufe auf main `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`.
- [Auswertung](./1A-auswertung.md): alle 80 Vergleiche und begründete Entscheidung.
- Compose: 50 tatsächlich vor den Phasen aufgelöste bereinigte Aufnahmen für die Hauptreihe;
  keine verbleibende Rekonstruktionslücke dieser Reihe.
- [Prüfstand](./1A-pruefstand.md): aktuelle technische Prüfungen und bekannte Projektgrenzen.
- Alte A1-Reihen und Prüfprotokolle wurden auf ausdrücklichen Wunsch entfernt;
  sie werden nicht als Nachweis dieses Arbeitsstands zitiert.

## Persönliche fachliche Gegenprüfung

Niklas prüft die folgenden Punkte selbst und dokumentiert anschließend die
tatsächliche Bestätigung. Die vorhandenen automatisierten Tests ersetzen
diese persönliche Prüfung nicht.

- [ ] Einen Vergleich in `live-vergleiche.csv` anhand der Rohstichproben
      nachvollzogen: aufsteigend sortieren, Rang `ceil(0.95 × n)`, anschließend
      relative **und** absolute Grenze vor Rundung prüfen.
- [ ] Erklärt, warum die [aktuellen Grenzverletzungen](./1A-auswertung.md#live-aktionen-und-hypothesen)
      H1 und H2 nicht bestätigen, einschließlich der absoluten V3-Verletzungen.
- [ ] Erklärt, warum V4 mit `forwarded: 0` Timeout/Rückstau/Fallback untersucht
      und keine langsam rechnende spaCy-Inferenz nachweist.
- [ ] CPU-Limit als Obergrenze, nicht als Reservierung erklärt; RAM-Lebenszeitpeak
      einschließlich Aufwärmung und CPU-Drosselungsquote auseinandergehalten.
- [ ] Gültigkeitsgrenzen geprüft: WSL2, gemeinsamer Lastgenerator-/Dockerhost,
      Beitrittswelle, synthetischer Wortschatz, kein Rendering-/LLM-Nachweis.
- [ ] Kosten-/Betriebsfolge und lexikalische Gegenalternative fachlich vertreten.
- [ ] [Handout und Folien](./abgabe/README.md) vollständig gelesen und anhand
      der Messdaten, Quellen und tatsächlichen Prüfungsanforderungen freigegeben.

**Persönlich geprüft von / Datum / Anmerkungen:** noch offen.

## Gemeinsame Artefakte für 1B und 1C

| Artefakt           | Version und Vertrag                                                                                                                                       | Übergabezweck                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemeinsame Fixture | `scripts/load/fixtures/resource-isolation-v1.manifest.json`; Seed `438314513`, SHA-256 `da24eeb3db1f7e08399583f527bf5f889ccb98cddd67fd0be84ec0e4dea17ded` | Sechs Referenzfragen plus Gegenfälle; Originalzustand und A1-Analyseprojektion gemäß [Fixture-Dokumentation](./1A-fixture.md) unterscheiden.   |
| Live-Messung       | `scripts/load/artillery/processor.mjs`, `scripts/load/lib/artillery-live-messungen.mjs`; [Messvertrag](./1A-live-messungen.md)                            | Roh-Laufzeiten, p50/p95/p99, Fehler und geplante Arbeit für Beitritt, Quiz, Q&A und Tempo; keine dauerhafte 500-Client-Parallelität behaupten. |
| Analyse-Last       | `scripts/load/host-analyze-loop.mjs`; [Anleitung](./1A-analyse-last.md)                                                                                   | Reguläre Host-Autorisierung, getrennte Sessions und konstanter Korpus; keine Tokens in Übergabeunterlagen.                                     |
| A1-Ergebnisse      | Baseline `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`, [Auswertung](./1A-auswertung.md)                                                                     | Als A1-Nachweis zitieren; keine Messung der privaten LLM-Rolle oder des vollständigen 1C-Kontextpfads.                                         |

- [ ] Jonas hat die benötigten Artefakte erhalten und die tatsächlich verwendete
      Version beziehungsweise den Commit festgehalten.
- [ ] Unterschiede zur eigenen 1C-Fixture
      `apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts` aus Issue #10/PR #12
      gemeinsam abgeglichen: Statusprojektion, Raumgröße, Bewertungen und Hash.
- [ ] Übernommene Tabellen, Skripte und Daten in beiden Arbeiten als gemeinsam
      beziehungsweise übernommen gekennzeichnet.
- [ ] Gruppensynthese abgestimmt; Niklas' 1B-Schritte 3–4 gesondert nachgewiesen.

**Tatsächliche Abstimmung mit / Datum / verwendete Revisionen:** noch offen.
Diese Datei wurde nicht an andere Personen versendet.

## KI- und Quellenkennzeichnung

OpenAI Codex unterstützte Implementierung, Tests, Berechnung und Dokumententwürfe.
Die aktuelle reale Messreihe führte Niklas anhand der bereitgestellten Befehle aus.
Die genutzten Projektquellen und gemeinsamen Artefakte sind im Eigenanteil offengelegt;
eine ausschließlich manuelle Umsetzung wird nicht behauptet.

Wesentliche Aufträge aus diesem Chat, **sinngemäß zusammengefasst**:

1. Projekt, Serena-Memories und GitHub-Issue für A1 prüfen, keine vorhandenen
   Funktionen oder Messwerte annehmen und zunächst einen Plan vorlegen.
2. Sieben Schritte einzeln umsetzen, Änderungen erklären, Nachprüfbarkeit und
   deutsche Conventional-Commit-Nachrichten liefern.
3. Vollständige reale Messreihe nach Unterbrechung sauber neu beginnen und
   bestehende abgebrochene Nachweise zunächst getrennt erhalten.
4. Ergebnisse nach unveränderten Kriterien auswerten, Gesamtübersicht,
   Abgabeentwürfe und Eigenanteil dokumentieren.
5. Produktionsbezug und offene Anforderungen erneut auditieren sowie Compose-
   Nachweis, Dokumentation, Review und Übergabe vervollständigen.
6. Nach dem main-Merge auf aktueller Baseline neu messen; anschließend alte A1-Nachweise
   entfernen und lebende Dokumentation sowie Abgabeentwürfe auf die neue Reihe umstellen.

Substanziell übernommene Beiträge und Git-Prüfgrundlage stehen im
[Eigenanteilsnachweis](./1A-eigenanteil.md). Keine ausschließlich manuelle
Erstellung durch Niklas wird behauptet.

- [ ] Erlaubten KI-Umfang, Zitierweise und erforderliche Erklärung anhand des
      tatsächlichen Prüfungsauftrags/myCampus bestätigt.
- [ ] Literatur-/Systemaussagen und alle übernommenen Messwerte persönlich geprüft.
- [ ] Prüfungsdatum, Empfänger, Dateinamen und Abgabefrist geprüft; final freigegebene
      PDFs tatsächlich eingereicht.

## GitHub-Abschluss

Die [lokale PR-Beschreibung](./1A-pr-beschreibung.md) folgt dem Repositorytemplate.
Niklas hat Commit und Push der aktuellen Messung im Chat bestätigt.
Die anschließende Bereinigung wurde hier weder committet noch gepusht oder gemergt.
Ein früherer Reviewstand ersetzt keine unabhängige Prüfung des endgültigen Gesamtdiffs.

- [ ] Bereinigten Gesamtstand von Niklas geprüft, committet und gepusht.
- [ ] Unabhängige Gesamtprüfung sowie PR-Vorlagengate und CI-Status geprüft.
- [ ] PR gegen Fork-main tatsächlich gemergt; erst dann Merge-Kriterium erfüllt.

**PR / Merge:** hier nicht ausgeführt oder als erfolgt bestätigt.
Persönliche Gegenprüfung, erlaubter KI-Umfang und Abstimmung mit Jonas bleiben offen,
solange Niklas sie nicht ausdrücklich bestätigt. Es wurden keine Nachrichten versendet.
