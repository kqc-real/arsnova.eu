# Aufteilung 1A/1B/1C auf zwei Personen

Stand: 2026-11-13; Aufteilungsentscheidung vom 2026-10-23. Grundlage: [CLOUD-COMPUTING-REFERAT-PRUEFUNG.md](../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md)
Abschnitte 4.1.2, 4.1.3 und 4.3 sowie die Lückenlisten der Dossiers 1A, 1B
und 1C. Die Aufwandsschätzungen sind eigene Einschätzungen, keine Vorgabe.

## Entscheidung (2026-10-23)

Wir haben uns für **Option 1** entschieden:

| Person     | Rolle                       | Umfang                          |
| ---------- | --------------------------- | ------------------------------- |
| **Niklas** | X: Ressourcen und Isolation | 1A vollständig, 1B Schritte 3–4 |
| **Jonas**  | Y: Pfad und Verträge        | 1C vollständig, 1B Schritte 1–2 |

Die gemeinsamen Artefakte sind wie in der Tabelle
[unten](#gemeinsame-artefakte-gleichmäßig-verteilen-und-kennzeichnen) verteilt.
**Geklärt:** Eine Abstimmung der Aufteilung mit dem Prüfer ist nicht nötig
(mündliche Ansage in der Vorlesung, notiert 2026-10-24; siehe
[00-rahmen](./00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)).

**Nachweisstand:** Für A1 sind eigener Rechner und aktueller Fork-`main` gemäß
[Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6) geklärt.
Die A1-Messwerkzeuge und Fixture liegen vor;
die tatsächliche Übernahme durch 1B/1C wird in der
[Übergabeunterlage](./1A-abschluss-und-uebergabe.md) abgeglichen.
Niklas' zusätzliche 1B-Schritte 3–4 werden nicht mit dem Abschluss von 1A
als erledigt erklärt.

## Feste Regeln für jede Variante

Laut Repo-Fassung gilt (4.1.2, 4.1.3):

- **Einzelbewertung:** Jede Person wird einzeln bewertet (30/30/40). Es gibt
  keine Gruppennote.
- **Eigene Nachweiskette pro Person:** Hypothese, Gegenalternative, mindestens
  ein eigener ausführbarer Test, eigener Baselinelauf, Störung oder Variante,
  Befund mit Gültigkeitsgrenze und Entscheidung.
- **Eigenständig lesbar:** Jede Ausarbeitung muss ohne die andere verständlich
  sein.
- **Keine Aufteilung nach Abschnitten:** Eine Verteilung nach Einleitung,
  Technik und Schluss ist ausgeschlossen. Jede Person verfolgt eine eigene
  Teilfrage durch den ganzen Argumentationsgang.
- **Infrastruktur zählt nicht als Nachweis:** Gemeinsame Infrastruktur ersetzt
  keinen eigenen Nachweis. Geteilte Daten und Abbildungen werden als solche
  gekennzeichnet.
- **Vorher festlegen:** Eine abweichende Vergabe muss vor Beginn verbindlich
  dokumentiert und in Aufwand und Qualifikationsbezug gleichwertig sein.
  Außerdem gilt: „Niemand muss allein den Umfang der drei Gruppenaufträge
  erledigen.“
- **Prüfungszeit:** Jede Person hat 15 Minuten, einschließlich Befragung.

## Aufwand der drei Aufträge (Einschätzung)

| Auftrag | Infrastruktur                                                                          | Analyse und Tests                                                                                                               | Externe Abhängigkeit                               | Gesamt |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| 1A      | Niedrig: lokales Compose mit spaCy-Profil reicht                                       | Mittel: spaCy-Lastskript fehlt (L-01), p95 der Liveaktionen (L-02), Container-Metriken (L-14)                                   | Keine                                              | Mittel |
| 1B      | Hoch: zweiter Host, LLM-Runtime mit GGUF-Modell, Netz und Firewall, Runbook            | Mittel: Zeiten für Netz, Adapter und Inferenz trennen (Lücken 2 und 3), Fake-`llama-server` für Störversuche (Lücke 4)          | Zugang zum zweiten Host (Prüfer oder eigener Host) | Hoch   |
| 1C      | Niedrig bis mittel: meist lokale Tests, für Schritt 2 ein realer Lauf über die Runtime | Hoch: #456-Zuordnung, Verträge, Snapshot und Hash, neue Tests für G1, G2, G5, G7 und G9, Vergleich Vorschau gegen Nutzlast (G8) | Für den realen Lauf: die Runtime aus 1B            | Hoch   |

Grobe Gewichtung: 1A ≈ 1, 1B ≈ 1,5, 1C ≈ 1,5. Insgesamt also ≈ 4 Einheiten,
das heißt ≈ 2 pro Person.

## Optionen

### Option 1: 1B entlang seiner Schritte teilen (Empfehlung)

1B zerfällt natürlich in zwei Hälften:

- **Schritte 1–2:** Deployment und realer Auftrag mit getrennten Zeiten.
- **Schritte 3–4:** Störung, Rückwirkung auf den App-Host und
  Betriebsaufwand.

Jede Hälfte passt zu einem der anderen Aufträge.

| Person                          | Umfang                                                                                                                              | Eigene Leitfrage (Vorschlag)                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **X: Ressourcen und Isolation** | 1A vollständig, dazu 1B Schritte 3–4: Störversuche mit Fake-`llama-server`, Rückwirkung auf den App-Host, Betriebsaufwand           | Wo darf optionale Analyse laufen: in der Reserve des App-Hosts oder auf einer zweiten Serverrolle?          |
| **Y: Pfad und Verträge**        | 1C vollständig, dazu 1B Schritte 1–2: Zwei-Host-Deployment reproduzieren, realer Auftrag, Netz-, Adapter- und Inferenzzeit getrennt | Hält der Weg vom autorisierten Kontext bis zur privaten Inferenz Verträge, Konsistenz und Latenzbudget ein? |

- **Pro:**
  - Beide Referate ergeben je eine geschlossene Argumentation.
  - Die Messmethoden lassen sich wiederverwenden. X nutzt dieselben
    p95-, CPU- und RAM-Messungen für Sidecar und Inferenz-Host. Y braucht den
    realen Runtime-Lauf ohnehin für 1C Schritt 2.
  - Der Aufwand liegt bei ≈ 1,75 bzw. ≈ 2,25 Einheiten. Er lässt sich
    ausgleichen, indem X zusätzlich die gemeinsamen Artefakte übernimmt (siehe
    unten).
- **Contra:**
  - Weicht von „eine Person, ein Auftrag“ ab. Die Aufteilung muss deshalb
    vorher dokumentiert und mit dem Prüfer abgestimmt sein.
  - X hängt für die Schritte 3–4 von der Runtime ab, die Y aufbaut.

### Option 2: Je ein Auftrag, der dritte nach Teilschritten geteilt

Zum Beispiel X = 1A, Y = 1B, und 1C wird geteilt:

- Schritte 1–2 (Rekonstruktion, Vorschau gegen Nutzlast) gehen an eine
  Person.
- Schritte 3–4 (Negativproben, Stimmenänderung, Quellenlöschung) gehen an die
  andere.

- **Pro:** Kommt der Grundidee „ein Auftrag pro Person“ am nächsten.
- **Contra:**
  - 1C ist inhaltlich eng verzahnt. Beide müssen den ganzen Kontextpfad
    verstehen.
  - Eine Kombination wie 1A + halbes 1C ergibt schwer eine Argumentation, die
    in 15 Minuten trägt.
  - 1B bleibt zusätzlich der schwerste Einzelblock.

### Option 3: 1A und 1B zusammen, 1C allein

X = 1A + 1B ergibt einen natürlichen Vergleich: dieselbe Isolationsfrage auf
demselben Host und auf einem zweiten Host. Y = 1C.

- **Pro:** Für X die inhaltlich stimmigste Kombination.
- **Contra:** Sie ist klar ungleich (≈ 2,5 gegen ≈ 1,5). Infrastruktur und
  Synthese gleichen das für Y nicht aus, weil gemeinsame Infrastruktur keinen
  eigenen Nachweis ersetzt. Nur sinnvoll, wenn Y zusätzlich 1B Schritt 2
  übernimmt. Dann entsteht praktisch Option 1.

### Option 4: Umfang beim Prüfer reduzieren lassen

Die Repo-Fassung sagt, niemand müsse allein den Umfang aller drei Aufträge
erledigen. Bei zwei Personen ließe sich beantragen:

- je ein Auftrag (zum Beispiel 1A und 1C, oder 1B und 1C), oder
- das Einzelreferat-Format des kleinen Kurses.

- **Pro:** Der geringste Aufwand und die sauberste Bewertungsgrundlage.
- **Contra:** Setzt eine Zustimmung voraus. Laut eurer Information verlangt der
  Prüfer bisher alle drei Aufträge.

## Gemeinsame Artefakte (gleichmäßig verteilen und kennzeichnen)

| Artefakt                                                                            | Gebraucht von        | Vorschlag Option 1 |
| ----------------------------------------------------------------------------------- | -------------------- | ------------------ |
| Laborinstanz (Compose, Baseline-Commit, Referenzmanifest)                           | beide                | Y                  |
| Inferenz-Host mit LLM-Runtime                                                       | beide                | Y                  |
| Fixture: Sechs-Fragen-Szenario aus #456 Abschnitt 12 plus Gegenfälle                | beide                | X                  |
| Last- und Messskript für Liveaktionen (p95 für Vote, `qa.submit`, Blitzlicht; L-02) | beide                | X                  |
| Fake-`llama-server` für Latenz und Ausfall (1B Lücke 4)                             | X, optional Y für G3 | X                  |
| Gruppensynthese (eine Seite)                                                        | beide                | gemeinsam          |

Stand 2026-10-24: Für die 1C-Tests hat Jonas (Y) die Sechs-Fragen-Fixture als
Datenbank-Helfer selbst gebaut
(`apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts`), ebenso eine
Test-Runtime für Latenz und Ausfall
(`apps/backend/src/__tests__/lib/open-weight-test-runtime.ts`). Beides weicht
von der vorgeschlagenen Zuordnung ab; ob X die Helfer für 1A/1B übernimmt, ist
mit Niklas abzustimmen.

_Aktualisiert 2026-11-12:_ Die Test-Runtime ist kein Ersatz für den
vorgeschlagenen Fake-`llama-server`. Sie läuft im Vitest-Prozess
(`node:http`-Server auf `127.0.0.1` mit freiem Port, verdrahtet per
`vi.stubEnv`), bildet nur `GET /slots?fail_on_no_slot=1` (Status per
`slotsStatus`, Standard 200 mit Antwort `[]`) und `POST /v1/chat/completions` sowie den
Legacy-Text-Pfad nach;
`/health` oder `/props` gibt es nur, wenn ein Test sie als zusätzliche Route
übergibt. Als eigenständiger Fake-Server für einen zweiten Host (1B) taugt sie
so nicht. Für Latenz und Ausfall auf dem echten Pfad wäre der aufzeichnende
Proxy (`apps/backend/src/__tests__/lib/recording-proxy.ts`) der Ort; er hat
aber noch keine Option für Verzögerung oder Fehler.

## Wer übernimmt was

Folgende Kriterien helfen bei der Wahl, wer X und wer Y wird:

- **Zugang zum zweiten Host:** Wer ihn hat oder einrichtet, übernimmt sinnvoll
  Y.
- **Erfahrung:** Wer mit dem Backend-Code und Tests vertrauter ist, übernimmt
  sinnvoll 1C.
- **Interesse:** Betrieb und Ressourcen (X) oder Verträge und Datenfluss (Y)?

## Gemeinsame Präsentation (Empfehlung, offen)

Stand 2026-11-10, Empfehlung von Jonas; _aktualisiert 2026-11-12:_ mit Niklas so gut
wie vereinbart, endgültig steht es noch nicht fest. Die Präsentation ist gemeinsam und deckt 1A, 1B und 1C ab; jeder
stellt seinen Teil aus der [Entscheidung](#entscheidung-2026-10-23) vor.

**Empfohlene Reihenfolge:** 1A → 1B (beide Hälften) → 1C. Sie folgt dem Weg
der Analyse: erst die Reserve des App-Hosts, dann die Auslagerung auf den
zweiten Host, dann der Kontextpfad bis zur Inferenz; 1C baut auf dem auf,
was 1B zeigt.

| Teil                                                 | Wer    |
| ---------------------------------------------------- | ------ |
| 1A Ressourcen auf dem App-Host                       | Niklas |
| 1B Schritte 1–2 (Zwei-Host-Aufbau, echter Auftrag)   | Jonas  |
| 1B Schritte 3–4 (Latenz, Ausfall, Betriebsaufwand)   | Niklas |
| 1C Autorisierter Kontext und asynchroner Adapterpfad | Jonas  |

- **Folge:** dreimal Sprecherwechsel; die Übergänge werden geplant (etwa
  von 1B 1–2 zu 3–4: „Der Pfad läuft auf dem zweiten Host – was passiert,
  wenn der langsam wird oder ausfällt?“).
- **Verworfen:** 1B 1–2 direkt vor 1C ziehen. Dann wechselt der Sprecher
  nur einmal statt dreimal, aber 1B wird auseinandergerissen und Schritt 3–4
  käme vor dem Aufbau aus Schritt 1–2.
- **Offen:** Zeitaufteilung (Vorgabe: 15 min je Prüfling, Vortrag und
  Befragung zusammen; siehe
  [Rahmendokument](./00-rahmen-und-pruefung.md#leistungsbestandteile-und-bewertung)),
  wer Einstieg und Gruppensynthese übernimmt, gemeinsames Foliendesign.

_Ergänzt 2026-11-15:_ Jonas schlägt eine andere Reihenfolge vor: Niklas (1A)
→ Jonas (der Auftrag am Stück, 1C und 1B Schritte 1–2 verwoben) → Niklas
(1B Schritte 3–4), also zwei Sprecherwechsel. Dazu ein gemeinsames Deck, das
eine Person von Anfang bis Ende teilt. Noch mit Niklas abzustimmen; Begründung
und Übergänge im [Präsentations-Design, Abschnitt 3](./specs/2026-11-15-praesentation-jonas-design.md#3-reihenfolge-der-gruppe).

## 1B: zwei PRs nacheinander (Vorschlag, mit Niklas abzustimmen)

_Ergänzt 2026-11-12._ Vorschlag von Jonas, mit Niklas noch nicht abgestimmt:

- **Reihenfolge:** Jonas' PR mit den Schritten 1–2 zuerst. Niklas zweigt nach deren Merge von Fork-`main` für die Schritte 3–4 ab.
- **Gemeinsames Hauptdokument:** `1B-ergebnis.md` mit je einem Abschnitt zu den Schritten 1–2 und 3–4 und einem gemeinsamen Kurzfazit. Eigenanteil je Person.
- **ADR-Nummern:** `1B-001`–`1B-019` Jonas, `1B-020`–`1B-039` Niklas ([ADR-Index](adr/README.md#adrs-zu-1b)).
- **Aufbau:** zwei VMs auf einem Rechner ([ADR 1B-002](adr/1B-002-topologie-zwei-vms-ein-rechner.md)). Niklas nutzt die Dateien, nicht die Geräte von Jonas; der Windows-Weg steht in `evidenz/1B/vm/WINDOWS.md` ([ADR 1B-009](adr/1B-009-portabilitaet-linux-windows.md)). Sein eigener Lauf auf eigener Hardware ist zugleich der Wiederholbarkeitsnachweis aus Schritt 3.

## Nächste Schritte

1. **Erledigt:** Option 1 gewählt und X/Y zugeordnet (Tabelle oben).
2. Die Aufteilung schriftlich festhalten: je Person Titel, Hypothese,
   Gegenalternative, eigener Test und Anteil an gemeinsamen Artefakten. Die Zuordnung ist
   wie oben dokumentiert geklärt; offene gemeinsame Artefakte werden abgestimmt.
3. **A1 verfügbar, Stand 15.11.2026:** [Aktuelle Messreihe und Auswertung](./1A-auswertung.md),
   Laboraufbau, Fixture und Live-Messwerkzeuge sind dokumentiert.
   Die gemeinsame Übernahme sowie die private Runtime für 1B/1C gesondert abgleichen.
