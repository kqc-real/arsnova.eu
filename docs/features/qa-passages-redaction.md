# Q&A: Passagen schwärzen

> Stand: 2026-09-29 · Issue [#485](https://github.com/kqc-real/arsnova.eu/issues/485)

## Ziel

Der Host kann **konkrete, voneinander getrennte Passagen** einer Q&A-Frage
dauerhaft unkenntlich machen, ohne den übrigen Wortlaut frei zu editieren. Die
Frage trägt für alle das Label »Passagen durch Moderation geschwärzt«. Die
Aktion ist dauerhaft und kann erneut auf den verbliebenen Text angewendet
werden.

## Vertrag

- Schema-first: `QaQuestion.passagesRedacted`, `QaQuestion.passagesRedactedAt`,
  `QaQuestionDTO.passagesRedacted` / `passagesRedactedAt`, Mutation
  `qa.redactPassages` (`RedactQaPassagesInputSchema`).
- Nur `hostProcedure` plus serverseitige Prüfung der Frage-Session-Zugehörigkeit.
- Client sendet Frage-ID, `expectedTextVersion` (Hash des aktuellen Fragetexts)
  und disjunkte Codepunkt-Bereiche — **keinen** Ersatztext. Der Server ersetzt
  jeden Original-Codepunkt durch das Blockzeichen `█` (`QA_REDACTION_CHAR`,
  längenerhaltend). Die UI rendert jedes Blockzeichen als dunkles Rechteck
  gleicher Breite (Markdown: `.qa-redacted-passage` / `.qa-redacted-char`).
- Ältere Datensätze mit dem Legacy-Platzhalter `[geschwärzt]`
  (`QA_REDACTION_PLACEHOLDER_LEGACY`) bleiben lesbar und werden ebenfalls als
  Balkenreihe dargestellt (Länge des Legacy-Strings).
- `expectedTextVersion` ist unabhängig von `updatedAt`, damit Stimmen und
  abweichende Zeitstempel-Serialisierung die Schwärzung nicht blockieren.
- Grenzen: max. 10 Bereiche, je 1–80 Codepunkte; keine Überlappung; keine
  Auswahl in bestehenden Platzhaltern/Blockläufen; Ergebnis darf nicht leer sein.
- Bei veralteter Textfassung: `CONFLICT` und Reload statt alter Offsets.
- Stimmen, Autor und Moderationsstatus bleiben erhalten.
- Kein Originalwortlaut in Historie, Audit, Fehlerantwort oder neuer Spalte;
  die **Länge** der geschwärzten Stelle bleibt über die Balkenanzahl sichtbar.
- `passagesRedactedAt` speichert den Zeitpunkt der **letzten** Schwärzung.

## Ableitungen

- `qaRankingRevision` steigt über den bestehenden Trigger bei Textänderung.
- `invalidateQaSummaryForSession` verwirft laufende/gecachte Zusammenfassungen.
- NLP-Felder werden zurückgesetzt; die In-Memory-Generation wird immer
  invalidiert. Bei aktivem Kill-Switch wird nur der geschwärzte Text neu
  enqueued.
- Wortwolke und Exporte lesen den aktuellen `text`; PDF/CSV enthalten keinen
  Klartext der geschwärzten Stellen mehr.
- Bereits gesehene Inhalte, Screenshots, externe Exporte und Backups werden
  **nicht** rückwirkend entfernt.

## UI

- Host-Kartenaktion »Passagen schwärzen« (auch vor Freigabe).
- Dialog mit auswählbarem Klartext, optionaler Suche für Touch, Vorschau und
  Bestätigung der Irreversibilität.
- Host-Dialog bleibt bis zum Speichern-Ergebnis offen; `expectedTextVersion`
  kommt vom **angezeigten Dialogtext**, nicht aus einer inzwischen
  aktualisierten Host-Liste. Weicht die Liste ab, gibt es lokalen Konflikt ohne
  Mutation; bei Server-`CONFLICT` wird der aktuelle Text geladen und die
  Auswahl verworfen (kein Blind-Retry).
- Offset-Obergrenze `QA_REDACTION_MAX_OFFSET` deckt Legacy-Textwachstum ab;
  längenerhaltende Blockzeichen bleiben im 500er-Fenster. Die Server-Prüfung
  bleibt an der tatsächlichen Textlänge.
- NLP: bei jeder Schwärzung `invalidateQaNlpForQuestion` (auch wenn NLP gerade
  deaktiviert ist). Persist schreibt nur per `updateMany` mit dem erwarteten
  Fragetext — ein vor dem Commit begonnener Altjob überschreibt die geschwärzte
  Frage nicht.

## Grenzen für Betrieb

Logs und Backup-Aufbewahrung können frühere Klartexte enthalten. Operatoren
sollten Retention und Zugriff entsprechend der Datenschutzhinweise prüfen.
