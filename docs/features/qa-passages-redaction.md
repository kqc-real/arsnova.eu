# Q&A: Passagen schwärzen

> Stand: 2026-09-29 · Issue [#485](https://github.com/kqc-real/arsnova.eu/issues/485)

## Ziel

Der Host kann **konkrete, voneinander getrennte Passagen** einer Q&A-Frage
dauerhaft unkenntlich machen, ohne den übrigen Wortlaut frei zu editieren. Die
Frage trägt für alle das Label »Passagen durch Moderation geschwärzt«. Die
Aktion ist dauerhaft und kann erneut auf den verbliebenen Text angewendet
werden.

## Vertrag

- Schema-first: `QaQuestion.passagesRedacted`, `QaQuestionDTO.passagesRedacted`,
  `updatedAt` als Textversion, Mutation `qa.redactPassages`
  (`RedactQaPassagesInputSchema`).
- Nur `hostProcedure` plus serverseitige Prüfung der Frage-Session-Zugehörigkeit.
- Client sendet Frage-ID, `expectedUpdatedAt` und disjunkte Codepunkt-Bereiche —
  **keinen** Ersatztext. Der Server erzeugt den Platzhalter
  `[geschwärzt]` (`QA_REDACTION_PLACEHOLDER`).
- Grenzen: max. 10 Bereiche, je 1–80 Codepunkte; keine Überlappung; keine
  Auswahl in bestehenden Platzhaltern; Ergebnis darf nicht leer sein.
- Bei veralteter Version: `CONFLICT` und Reload statt alter Offsets.
- Stimmen, Autor und Moderationsstatus bleiben erhalten.
- Kein Originalwortlaut in Historie, Audit, Fehlerantwort oder neuer Spalte.

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
- Label als eigenes DTO-Merkmal in Host-, Teilnehmer- und Present-Ansicht.

## Grenzen für Betrieb

Logs und Backup-Aufbewahrung können frühere Klartexte enthalten. Operatoren
sollten Retention und Zugriff entsprechend der Datenschutzhinweise prüfen.
