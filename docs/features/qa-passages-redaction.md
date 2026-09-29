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
  und disjunkte Codepunkt-Bereiche — **keinen** Ersatztext. Der Server erzeugt
  den Platzhalter `[geschwärzt]` (`QA_REDACTION_PLACEHOLDER`).
- `expectedTextVersion` ist unabhängig von `updatedAt`, damit Stimmen und
  abweichende Zeitstempel-Serialisierung die Schwärzung nicht blockieren.
- Grenzen: max. 10 Bereiche, je 1–80 Codepunkte; keine Überlappung; keine
  Auswahl in bestehenden Platzhaltern; Ergebnis darf nicht leer sein.
- Bei veralteter Textfassung: `CONFLICT` und Reload statt alter Offsets.
- Stimmen, Autor und Moderationsstatus bleiben erhalten.
- Kein Originalwortlaut in Historie, Audit, Fehlerantwort oder neuer Spalte.
- `passagesRedactedAt` speichert den Zeitpunkt der **letzten** Schwärzung.

## Ableitungen

- `qaRankingRevision` steigt über den bestehenden Trigger bei Textänderung.
- `invalidateQaSummaryForSession` verwirft laufende/gecachte Zusammenfassungen.
- NLP-Felder werden zurückgesetzt und bei aktivem Kill-Switch neu enqueued —
  nur mit dem geschwärzten Text.
- Wortwolke und Exporte lesen den aktuellen `text`; PDF/CSV enthalten keinen
  Klartext der geschwärzten Stellen mehr.
- Bereits gesehene Inhalte, Screenshots, externe Exporte und Backups werden
  **nicht** rückwirkend entfernt.

## UI

- Host-Kartenaktion »Passagen schwärzen« (auch vor Freigabe).
- Dialog mit auswählbarem Klartext, optionaler Suche für Touch, Vorschau und
  Bestätigung der Irreversibilität.
- Host-Dialog bleibt bis zum Speichern-Ergebnis offen; bei Konflikt wird der
  aktuelle Text geladen und die Auswahl verworfen (kein Blind-Retry).
- Offset-Obergrenze `QA_REDACTION_MAX_OFFSET` deckt Textwachstum durch
  Platzhalter ab; die Server-Prüfung bleibt an der tatsächlichen Textlänge.
- NLP: `invalidateQaNlpForQuestion` verwirft Warteschlange und macht laufende
  Altjobs schreibgeschützt, bevor der Job mit geschwärztem Text neu eingeplant wird.

## Grenzen für Betrieb

Logs und Backup-Aufbewahrung können frühere Klartexte enthalten. Operatoren
sollten Retention und Zugriff entsprechend der Datenschutzhinweise prüfen.
