# Rahmen und Prüfung: Referat Thema 1

Stand: 2026-11-13; ursprüngliche Recherche vom 2026-10-16. Quellen: [CLOUD-COMPUTING-REFERAT-PRUEFUNG.md](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md)
(kanonische Repo-Fassung, Abschnitte 2–6 und 4.3) sowie die Kursunterlagen aus
„Woche 1“ (lokal, nicht im Repo): `3. Referatsprufung-Cloud-Computing.pdf` (49
Folien) und `2. Cloud_Architecture_Dossier.pdf` (15 Folien).

## Generalthema

> Wie bewährt sich der produktive Moderationskompass von arsnova.eu Release 1.3
> unter unterschiedlichen Cloud-Betriebsbedingungen, und welche begründeten
> Optimierungen ermöglichen es, dass Lehrende aus vielen Live-Signalen eine
> nachvollziehbare Lageeinschätzung gewinnen, die Kontrolle über ihre
> Lehrentscheidungen behalten und der Livebetrieb zuverlässig bleibt?

Zyklus **Wahrnehmen → Einordnen → Handeln**. Das System misst keinen Lernstand,
es unterstützt die Moderation. Verbindliche fachliche Grundlage ist
[Issue #456](https://github.com/kqc-real/arsnova.eu/issues/456), eingeordnet in
[Roadmap #463](https://github.com/kqc-real/arsnova.eu/issues/463).

Zusätzlich formuliert
[Referatsthemen.md](../didaktik/Modulkonzept%20Cloud%20Computing/Referatsthemen.md)
die Skalierungsfrage: 500 gleichzeitige Nutzer heute, Ziel 5.000 in einer
Session oder 100 parallele Sessions à 50.

## Thema 1

**KI-Inferenz für den Moderationskompass – Systemgrenzen und entkoppelte
Architektur.**

**Leitfrage:** Wie wirksam trennt die Architektur von Release 1.3 Anwendung,
Kontextaufbau und private Inferenz unter realer Last, und welche
Betriebsgrenzen ergeben sich für den Moderationskompass?

Basis: ADR-0035, Stories 1.14b/c und 8.9a–d, #456. Für das Deployment zusätzlich
`docker-compose.prod.yml`, `.env.production.example` und `scripts/deploy.sh` am
festgelegten Commit.

| Auftrag | Kurzfrage                                                                                      | Dossier                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1A      | Welche Ressourcenreserve hat der App-Host für optionale Analyse, ohne Live-Signale zu bremsen? | [../1A/1A-ressourcenisolation-app-host.md](../1A/1A-ressourcenisolation-app-host.md)                                                                                                            |
| 1B      | Welchen messbaren Isolationsgewinn und Betriebsaufwand bringt die zweite private Serverrolle?  | [../1B/1B-private-inferenz-zweiter-host.md](../1B/1B-private-inferenz-zweiter-host.md)                                                                                                          |
| 1C      | Hält der Kontextpfad seine Vertrags-, Konsistenz- und Entkopplungszusagen bis zur Inferenz?    | [../1C/1C-kontext-und-adapterpfad.md](../1C/1C-kontext-und-adapterpfad.md) (_aktualisiert 2026-11-12:_ überholter Recherche-Stand; maßgeblich ist [../1C/1C-ergebnis.md](../1C/1C-ergebnis.md)) |

**Gruppensynthese:** A bewertet die Ressourcengrenze des App-Hosts, B die
Isolation der privaten Inferenzrolle, C den realen Kontextübergang. Zusammen
entsteht eine evidenzbasierte Bewertung der 1.3-Architektur. Kapazität und
vollständige Sicherheitsprüfung gehören zu Thema 3 und 5 (Abgrenzungsfolie 39
der Kursunterlagen).

## Leistungsbestandteile und Bewertung

| Bestandteil              | Gewicht | Vorgabe                                                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------- |
| Schriftliche Einreichung | 30 %    | Handout max. 5 DIN-A4-Seiten, 350–1.800 Wörter, oder Poster; zwingend PDF |
| Vortrag                  | 30 %    | Teil der 15 Minuten je Prüfling, visuell gestützt                         |
| Diskussion               | 40 %    | Befragung direkt im Anschluss, innerhalb derselben 15 Minuten             |

Sieben Kriterien (Dossier-Folie 14): Sachkompetenz 25 %, Argumentationslinie
25 %, Eigenständigkeit 15 %, Kommunikation 15 %, Themenverständnis 10 %,
Methodik 5 %, Formalia 5 %.

Jede Person wird einzeln bewertet. Keine Gruppennote, kein Gruppenbonus. Jede
Ausarbeitung muss ohne die anderen lesbar sein.

## Pflicht-Nachweiskette je Person

1.3-Release-Tag/Commit und Referenzmanifest → unveränderter eigener Baselinelauf
→ genau bezeichnete Störung oder Variante → vergleichbare Messdaten → Befund mit
Gültigkeitsgrenze → konkrete Entscheidung (Beibehaltung, Konfiguration, Betrieb
oder Verbesserung) mit Kosten-, Risiko- oder Betriebsfolge.

Vor Beginn festzuhalten (Repo-Fassung 4.1.3): Titel, überprüfbare Hypothese,
ernsthafte Gegenalternative, Commit und Manifest, Zielumgebung, mindestens ein
eigener ausführbarer Test, Messgrößen, Wiederholungen, Entscheidungsschwellen,
eigener Anteil an gemeinsamen Artefakten.

Versuche nur in der isolierten Laborinstanz, nie gegen Produktion. Nur
synthetische oder freigegebene Daten. Ein Produktivpatch wird laut
Repo-Fassung nicht verlangt.

## KI-Nutzung

Agentengestütztes Lernen ist möglich; Art und Umfang der zulässigen Nutzung
für die formale Abgabe müssen nach der kanonischen Prüfungsspezifikation und
dem tatsächlichen Prüfungsauftrag bestätigt werden. Bei erlaubter Nutzung sind
Agenten, Modelle, wesentliche Aufträge und übernommene Beiträge offenzulegen. Jede Mess-, Preis-, Quellen- und Systemaussage muss gegen
Primärquelle oder reproduzierbare Evidenz geprüft sein. Keine Secrets, Tokens
oder personenbezogenen Daten in Prompts. Bei Täuschung (z. B. erfundene
Quellen): 0 Punkte.

Für dieses Projekt heißt das: Die Dossiers in diesem Ordner sind agentengestützt
erstellt (Claude Code mit Serena und codebase-memory). Jede Zeilenangabe vor
Übernahme ins Handout selbst prüfen.

## Widersprüche zwischen den Quellen

| Punkt         | Kursfolien „Woche 1“                       | Repo-Fassung / Dossier-PDF                   | Vorgehen                                     |
| ------------- | ------------------------------------------ | -------------------------------------------- | -------------------------------------------- |
| Anzahl Themen | 5 Themen, 10 Dreiergruppen, jedes Thema 2× | 6 Themen, 6 Dreiergruppen                    | Beim Prüfer bestätigen lassen                |
| Abgabefrist   | 48 Stunden vor der Prüfung                 | Spätestens am Vortag der ersten Prüfung      | Mit 48 Stunden planen                        |
| Gruppengröße  | Dreiergruppen                              | Dreiergruppen; Abweichung nur dokumentiert   | Zweiergruppe mit allen drei Aufträgen klären |
| PR als Abgabe | Nicht erwähnt                              | Nicht erwähnt; Produktivpatch nicht verlangt | Umfang der PR schriftlich geben lassen       |
| Poster-Format | DIN A0                                     | Mindestens DIN A3                            | Handout wählen oder Format klären            |

## Geklärte A1-Baseline und Laborumgebung

Laut [Issue #6, Stand 10.11.2026](https://github.com/NiklasSkulll/arsnova.eu/issues/6)
wurden der **eigene Rechner als Labor** und der **aktuelle Fork-`main` als
Baseline** mit dem Prüfer geklärt; die E-Mail ist dort mit dem 04.11.2026
vermerkt. Die E-Mail selbst liegt hier nicht vor. Die Freigabe wird deshalb
auf das Issue zurückgeführt, nicht auf eine selbst geprüfte E-Mail.

Für die aktuelle A1-Reihe vom 15.11.2026 wurde der Commit
`a19ca70ff37dcb5510a77ab2745c06b70ccc3565` (Version 1.4.0) eingefroren.
Die ältere Methodenfestlegung bleibt unverändert; die neue Baseline wird durch
den [Vorabnachtrag](../specs/2026-11-14-1a-messreihe-main-a19ca70f.md) gebunden.
Aufbau, Image-IDs und tatsächliche WSL2-Hardware mit 16 logischen CPUs stehen
in der [Versuchsanleitung](../1A/archiv/1A-versuchsreihe.md) und den Laufmanifesten.
Die Messung ist keine Kapazitätsfreigabe für den 8-vCPU-Produktionshost.
Ein Produktivpatch ist laut Issue nicht gefordert. Die Fork-PR soll gegen
`main` gehen und `Closes #6` enthalten; eine Upstream-PR ist davon getrennt.
Die konkrete Zweier-Aufteilung und die übrigen Abgabeformalitäten gelten
hierdurch nicht automatisch als genehmigt.

## Historische Ausgangsfrage: Tag `v1.3.0` oder aktueller `main`?

Im Repo existiert der Tag `v1.3.0` (`87c39334`, 2026-10-08). Der Stand, auf dem
diese Dossiers erstellt wurden (`27966e75`, 2026-10-16), liegt 131 Commits
später und weicht in zentralen Werten ab, zum Beispiel:

| Wert                            | `v1.3.0` | `27966e75` (HEAD) |
| ------------------------------- | -------- | ----------------- |
| `--ctx-size` der LLM-Runtime    | 4096     | 8192              |
| Default `QA_SUMMARY_TIMEOUT_MS` | 8000     | 90000             |
| Lernziel-Timeout                | 120 s    | 300 s             |
| RAM-Limit LLM-Container         | 5g       | 8g / memswap 10g  |
| Runtime-Statusprobe             | fehlt    | vorhanden         |
| Aufrufer des Label-Auftrags     | fehlt    | vorhanden         |

Alle Werte selbst geprüft mit `git show v1.3.0:<pfad>` gegen HEAD
(`docker/open-weight-llm/entrypoint.sh`, `docker-compose.llm.yml`,
`apps/backend/src/lib/qaSummaryConfig.ts`, `openWeightLlmConfig.ts`,
`openWeightLlmRuntimeProbe.ts`, `wordCloudTopicLabels.ts`). Die
Repo-Fassung verlangt, dass die Lehrperson den **produktiv eingesetzten**
Release-Tag und Commit fixiert. Für A1 ist diese Frage inzwischen wie oben beschrieben geklärt. Die folgende
Historie und die Dossier-Zeilen beziehen sich weiterhin auf den damaligen Stand.

<a id="offene-fragen-an-den-prüfer"></a>

## Klärungsstand der Fragen an den Prüfer

1. ~~Wir sind zu zweit und bearbeiten alle drei Aufträge 1A, 1B und 1C. Wie
   wird der dritte Auftrag zugeordnet und bewertet?~~ **Geklärt (mündliche
   Ansage des Prüfers in der Vorlesung, notiert 2026-10-24):** Die Aufteilung aus [01-aufteilung](./01-aufteilung.md) passt so und muss
   nicht mit dem Prüfer abgestimmt werden.
2. Was genau gehört in die PR an kqc-real (Tests, Messskripte,
   Instrumentierung, Evidenzordner, Code-Verbesserung)?
3. ~~**Baseline:** Dürfen wir den aktuellen `main` statt `v1.3.0` (`87c39334`)
   als Baseline nehmen?~~ **Geklärt (E-Mail des Prüfers, notiert
   2026-11-04):** „Aktualisieren Sie Ihren Fork und Clone vor Ihrer
   Auswertung / Untersuchung.“ Wir messen deshalb gegen den aktuellen `main`
   und weisen die Abweichungen zum Stand der modellfreien Tests (`248029dc`)
   aus ([1C-Labor-Design, Abschnitt 3.4](../specs/2026-10-25-1c-labor-design.md#34-abweichungen-des-referenzstands-gegenüber-248029dc)).
   Für A1 gelten zusätzlich die konkrete Baseline und Laborfreigabe aus
   [Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6); Messrevision siehe oben.
   Ursprüngliche Gründe:
   - In `v1.3.0` fehlen die späteren Fixes. Die Test-Suite läuft deutlich
     länger, Setup-Fixes fehlen, und einige Tests sind dort noch flaky.
   - Die zentralen Werte unterscheiden sich (siehe Tabelle oben).
   - Die Wahl ändert nichts an der Qualität der Arbeit, vereinfacht sie aber
     deutlich.
   - Die Ergebnisse lassen sich direkt auf den aktuellen Stand des Repos
     anwenden.
4. **Laborinstanz und zweiter Host:** **Geklärt (E-Mail des Prüfers, notiert
   2026-11-04):** „Die Laborinstanz ist Ihr eigener Rechner.“ Es gibt also
   keine bereitgestellten VMs; Modell und Runtime-Image laden wir selbst, der
   1C-Lauf nutzt den lokalen Laborpfad `npm run docker:up:llm:http`
   ([1C-Labor-Design, Abschnitt 3.1](../specs/2026-10-25-1c-labor-design.md#31-topologie)).
   Was das für die Zwei-Host-Reproduktion in 1B bedeutet, ist damit nicht
   ausdrücklich beantwortet. _Ergänzt 2026-11-13:_ Für 1B gelöst ohne erneute
   Rückfrage: zwei VMs in einem privaten virtuellen Netz auf dem eigenen Rechner
   ([ADR 1B-002](../adr/1B-002-topologie-zwei-vms-ein-rechner.md),
   [ADR 1B-003](../adr/1B-003-laborregel-virtuelles-netz.md)). Ursprünglich lautete die Frage: Laut Material
   stellt die Lehrperson die Laborinstanz einschließlich echter privater
   Runtime bereit (siehe
   [Recherche unten](#laborinstanz-und-zweiter-host-recherche-2026-10-24)).
   Konkret offen war:
   - Wo steht sie, wer betreut sie (Rolle „LB“), wie bekommen wir Zugang (SSH,
     Account), ab wann und bis wann?
   - Gibt es **zwei** VMs (App und Inferenz im selben privaten Netz)? 1B
     verlangt die Reproduktion des Zwei-Host-Deployments.
   - Welche Hardware und Architektur hat die Inferenz-VM (ARM oder x86)?
     Folie 16 sagt „gleiche Kapazität“ (8 vCPU / 16 GB).
   - Liegt das gepinnte Modell bzw. Runtime-Image bereit, oder dürfen wir es
     selbst laden (ca. 2,5 GB GGUF)?
   - Zählt eine lokale Messung (`npm run docker:up:llm:http`) als Evidenz oder
     nur als Vorversuch?
   - Wie hoch ist die Kostenobergrenze, und dürfen wir eigene Cloud-Server
     anlegen?
5. ~~Gilt die 48-Stunden-Frist der Folien oder der Vortag der Repo-Fassung?~~
   **Geklärt (mündliche Ansage des Prüfers in der Vorlesung, notiert
   2026-10-24):** Handout und Präsentation sind 48 Stunden (zwei Tage) vor der
   Prüfung abzugeben. Das ist strenger als die Repo-Fassung („spätestens am
   Vortag“, `CLOUD-COMPUTING-REFERAT-PRUEFUNG.md` Abschnitt 4 Punkt 4); wir
   richten uns nach der strengeren Frist.
6. Wo ist der geheimnisfreie Evidenzort (Repo-Ordner, Branch, eigener Speicher)?

## Laborinstanz und zweiter Host: Recherche (2026-10-24)

Durchsucht wurden das Repo, alle PDFs und Bilder aus „Woche 1“ und „Woche 2“
(teils per OCR) sowie alle sechs Audio- und Videodateien (transkribiert mit
faster-whisper). **Ergebnis:** Die Bereitstellung ist Pflicht der Lehrperson.
Anbieter, Hardware, Zugang, Kosten und Fristen der Laborinstanz stehen
nirgends. Hetzner oder Hostinger werden für einen Laborhost nicht genannt;
Hetzner erscheint nur als Hoster der App (Impressum).

Belege:

- Referatsprüfung-PDF, Folie 40: „Eine vollständige 1.3-Laborinstanz
  einschließlich echter privater Runtime ist bereitgestellt. Keine Abhängigkeit
  von der Lieferung anderer Gruppen.“
- [CLOUD-COMPUTING-REFERAT-PRUEFUNG.md](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md)
  Z. 84: Die Lehrperson stellt eine reproduzierbare Laborinstanz
  „einschließlich funktionsfähiger privater Runtime und freigegebener
  Testdaten bereit“. Versuche laufen „ausschließlich dort“. Z. 490: gleiche
  Anforderung im Abnahmecheck.
- `docs/didaktik/Modulkonzept Cloud Computing/Lehrenden_Runbook.md` Z. 87:
  „Für jede Gruppe steht ein rücksetzbarer Zielserver oder eine gleichwertige
  Sandbox ohne Produktionsdaten und Produktionszugänge bereit.“ Z. 53:
  Zuständig ist die Rolle „LB“ (Lehrlaborbetrieb).
- Referatsprüfung-PDF, Folie 16: „Die kanonische LLM-Rolle liegt auf einem
  separaten privaten Host gleicher Kapazität“ (Live-Host 8 vCPU / 16 GB).

Der **Produktions**-Inferenzhost `arsnova-privat` (8-Kern-ARM, privates Netz)
ist nicht die Laborinstanz. Studierende sollen ihn nicht ansprechen
([onboarding.md](../../onboarding.md) Z. 317–322; Zeilenangaben auf Stand `248029dc`, _aktualisiert 2026-11-10:_ auf `def56700` Z. 365–370), und Produktion darf kein
Testziel sein (REFERAT-PRUEFUNG Z. 84).

Erlaubte Alternativen und ihre Beweiskraft:

- **Lokal auf dem Laptop:** Profil `llm-http` (`npm run docker:up:llm:http`,
  [onboarding.md](../../onboarding.md) Z. 234–322; _aktualisiert 2026-11-10:_ auf `def56700` Z. 282–370). Laut REFERAT-PRUEFUNG Z. 106
  ist das ein getrennter Nachweis. „Baseline und Leistungsurteil beruhen auf
  dem echten Releasepfad“ (Z. 192). Gut für Vorversuche, nicht als alleinige
  Baseline.
- **Same-Host-Labor:** Profil `llm` (Z. 101, 194; ADR-0035 Z. 27–30). Nur als
  Vergleichsvariante zulässig.
- **Modellfreie Tests:** Sie brauchen keinen zweiten Host
  ([Test-Design](../specs/2026-10-24-1c-tests-design.md)).

Für das Aufsetzen eines zweiten Hosts gibt es ein vollständiges Runbook:
[OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md](../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md)
(Sizing Z. 44–51: mindestens 4 Kerne / 12 GiB, empfohlen 8 Kerne / 16 GiB;
Firewall §5; Abnahme §17).

## Abschlussstand A1

Auswertung, Abgabeentwürfe, nachträgliche Compose-Rekonstruktion und
[Prüf-/Übergabeunterlage](../1A/archiv/1A-abschluss-und-uebergabe.md) sind getrennt
nachgewiesen. Die Rekonstruktion ersetzt keine während der Messung gespeicherte
Compose-Ausgabe. Persönliche Abgabefreigabe, Abstimmung mit 1B/1C und der
GitHub-Merge werden nur nach tatsächlicher Durchführung als erledigt markiert.
