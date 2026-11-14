# Referat 2B – Wie Kategorien und Themen in den #456-Kontext gelangen

Stand: Commit `a657798e` (upstream `kqc-real/arsnova.eu`, main). Alle Pfade relativ
zu `apps/backend/src/`, sofern nicht anders angegeben.

## Kurzfassung

Der #456-Kontext **startet keine neue Analyse**. Er liest nur Ergebnisse, die
vorher auf anderem Weg entstanden und gespeichert wurden:

|                                   | Kategorien (8.9b)                                                               | Themen (1.14c)                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Wann entsteht das Ergebnis?       | automatisch nach jeder neuen Q&A-Frage, wenn `QA_NLP_ENABLED=true`              | nur wenn die Lehrperson in der Wortwolke den Modus **Thema** öffnet und der Encoder ein frisches Ergebnis liefert |
| Wo wird es gespeichert?           | Datenbank, Spalten `nlpStatus`, `nlpCategory`, `nlpConfidence` … an jeder Frage | Redis (flüchtig, mit TTL): letzter Themen-Snapshot je Session, **ohne** Fragetexte, nur IDs und Text-Hashes       |
| Wie liest der Kontext es?         | `projectStoredQaNlp()` übersetzt den gespeicherten Status                       | `collectQaTopicContext()` prüft den Snapshot gegen die aktuelle Datenbank                                         |
| Was passiert, wenn nichts da ist? | Status `disabled`/`pending`/`failed` mit Begründung                             | Abschnitt `topics` = `disabled` oder `unavailable` mit ausdrücklicher Einschränkung                               |

## Pfad 1: Kategorien

1. **Erzeugung:** `routers/qa.ts:1740` / `:1866` – beim Einreichen einer Frage
   wird `nlpStatus` auf `PENDING` gesetzt (`:1804`) und `enqueueQaNlpJob()`
   aufgerufen (`:1832`). Der Worker klassifiziert asynchron und schreibt das
   Ergebnis in die Frage. Das Einreichen wartet nicht darauf.
2. **Übernahme in den Kontext:** `lib/moderationQaContext.ts:496` ruft
   `projectStoredQaNlp()` (`:250`) für jede Frage auf. Abbildung:
   - `CLASSIFIED` → `classified` mit Kategorie und Konfidenz,
     ausdrücklich gekennzeichnet als `uncalibrated-model-score` (`:285`);
   - unter der Schwelle → `uncertain` mit Kandidatenkategorie (`:293–301`);
   - `PENDING`, `DISABLED`, `FAILED` → entsprechender Zustand mit Grund;
   - unvollständige Datensätze → `failed` statt Raten (`:243`, `:276`).
3. **Änderungserkennung:** `buildNlpRevision()` (`:304`) bildet einen Hash über
   alle gespeicherten Klassifikationen, damit ein veralteter Kontext erkennbar ist.

## Pfad 2: Themen

1. **Erzeugung:** Nur wenn der Host den Themenmodus der Q&A-Wortwolke abruft
   (`routers/wordCloud.ts:458` (auf `efd71b44`: `:541`), Callback `onFreshOutput`), wird nach einer
   frischen Encoder-Analyse `recordLatestQaSemanticTopicSnapshot()`
   (`lib/qaSemanticTopicSnapshot.ts:240`) aufgerufen.
2. **Was gespeichert wird:** `buildQaSemanticTopicSnapshot()` (`:150`) speichert
   nur echte Encoder-Ergebnisse (kein lexikalischer Fallback, Status `ready`
   oder `uncertain`), je Thema die Mitglieds-IDs mit SHA-256 des Fragetexts,
   die ID der Label-Frage und die Cluster-Konfidenz. Fragetexte selbst werden
   nicht gespeichert.
   Die Einträge stammen aus der Wortwolken-Ausgabe, die bereits auf die
   **12 stärksten Themen** gekürzt ist (`lib/wordCloudSemanticAnalyze.ts:643`
   `rankSemanticClusters`, `WORD_CLOUD_SEMANTIC_MAX_TOPICS = 12`).
3. **Übernahme in den Kontext:** `lib/moderationQaContext.ts:1027` liest den
   Snapshot aus dem Cache, **ohne den Encoder aufzurufen** (Kommentar `:621–623`).
   `collectQaTopicContext()` (`:625`) dann:
   - prüft, ob die Themenfunktion aktiv ist und ein Snapshot existiert (`:634`, `:654`);
   - lädt die Mitgliedsfragen in **einer** begrenzten Datenbankabfrage neu (`:692`);
   - verwirft ein Thema vollständig, wenn ein Mitglied gelöscht oder sein Text
     geändert wurde (Hash-Vergleich `:720`), statt ein altes Label zu übernehmen;
   - überspringt Einzelthemen (`:708`);
   - begrenzt auf 30 Themen, 200 Mitglieder je Thema, 500 Quellen (`:32–35`);
   - markiert den Stand als `analysis-stale`, wenn sich die Q&A-Revision oder
     die Sortierung seit der Analyse geändert hat (`:835–856`).
     Jedes Thema erhält Stimmen-Aggregate, ein extraktives Label (Text einer
     Mitgliedsfrage) und die Konfidenz, wieder als `uncalibrated-model-score` (`:796–800`).

## Wofür der Kontext die Ergebnisse nutzt

`lib/moderationPromptContextPacking.ts:451–516`: Wenn das Eingabebudget des
Modells knapp ist, wählt das Packing reihum (Round-Robin) aus 13 Listen aus.
Die ersten drei sind:

1. Fragen mit Kategorie `organization` (nur Status `classified`),
2. Fragen mit Kategorie `technical` (nur Status `classified`),
3. Themen, sortiert nach Mitgliederzahl.

Danach folgen angepinnte, offene, kontroverse, gut bewertete Fragen usw.
Zweck: organisatorische und technische Anliegen sollen in der Kurzfassung nicht
untergehen. Fragen mit Status `uncertain` erhalten keinen eigenen Platz in diesen Listen.

## Folgen aus den eigenen Messungen

- **Falsche Kategorien verschieben die Auswahl.** Bei ausgeliefertem
  Betriebspunkt sind rund 30 % der Fragen sicher, aber falsch klassifiziert
  (Messung v2). Eine fälschlich als `organization` erkannte Fachfrage erhält
  einen bevorzugten Platz; eine echte Organisationsfrage, die als `content`
  erkannt wurde, verliert ihn. Sie fällt nicht heraus, konkurriert aber in den
  allgemeinen Listen. Das ist die konkrete Kostenstelle der Fehlklassifikation
  im #456-Pfad.
- **Themen gibt es nur, wenn der Host sie vorher angesehen hat.** Ohne Aufruf
  des Themenmodus enthält der Kontext `topics: unavailable`. Die Anforderung
  aus 2B („nur bereits verfügbare Themen, keine neue Analyse beim
  Kontextabruf“) ist damit erfüllt, kostet aber Abdeckung.
- **Höchstens 12 Themen**, obwohl der Kontext 30 zuließe: Die Grenze kommt aus
  der Wortwolken-Anzeige, nicht aus #456. Bei 500 Fragen deckten die 12
  angezeigten Themen in der Messung nur 13–32 % der Fragen ab.
- **Batch-Abhängigkeit:** Der Snapshot hält das Ergebnis eines bestimmten
  Encoder-Laufs fest. Weil Embeddings von der Batch-Zusammensetzung abhängen,
  kann ein späterer Lauf leicht andere Themen liefern; der Kontext zeigt immer
  den zuletzt gespeicherten.
- **Sauber gelöst:** Gelöschte oder geänderte Fragen können nicht über alte
  Themen-Labels in den Kontext rutschen (Hash-Prüfung). Konfidenzen sind
  ausdrücklich als nicht kalibriert markiert – passend zur eigenen
  ECE-Messung (≈ 0,24).

## Kontexttests mit den #456-Paaren A–F

Die Fixture-Paare A/B, C/D, E/F (`libs/shared-types/src/moderation-prompt-context-fixtures.ts`)
legen die Themen ausdrücklich fest. Sie prüfen Vertrag und Aggregation (z. B.
Stimmen je Thema), **nicht** die Qualität des Encoders. In der Ausarbeitung
deshalb getrennt halten: Themenqualität aus dem eigenen Referenzset,
Kontextverhalten aus den Fixture-Paaren.
