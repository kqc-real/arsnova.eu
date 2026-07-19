# Nachbesprechungsplan — i18n-Glossar

Fachliche Leitbegriffe für die Berichtslabels (`libs/session-export-report`) und die Demo-PDFs.
Quellsprache ist **Deutsch** (Duzen in DE-UI). Ziel: idiomatisch, didaktisch präzise und in `en` / `fr` / `es` / `it` konsistent.

**Anrede**

- Französisch: Lehrkräfte-Interface grundsätzlich mit **vous** (nicht als übertragenes deutsches Du/`tu`).
- Spanisch und Italienisch: **neutrale, professionelle Handlungsformulierungen**; Personalpronomen möglichst vermeiden. Keine saloppe oder umgangssprachliche Ansprache (kein informelles Du wie `Revisa` / `Rivedi`).
  - Infinitiv: ES `Revisar primero la pregunta 4.` · IT `Rivedere prima la domanda 4.`
  - unpersönlich: ES `Conviene revisar primero la pregunta 4.` · IT `È consigliabile rivedere prima la domanda 4.`
  - Formell-direkt (`Revise` / `Riveda`) vermeiden — neutrale Varianten passen besser zu automatisierten Berichten.

---

## Verbindliche Kernbegriffe

| DE                                               | EN                                    | FR                                       | ES                                        | IT                                         |
| ------------------------------------------------ | ------------------------------------- | ---------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| Nachbesprechung                                  | debrief                               | débriefing                               | puesta en común                           | discussione dei risultati                  |
| Nachbesprechungsplan                             | debriefing plan                       | plan de débriefing                       | plan para la puesta en común              | piano per la discussione dei risultati     |
| Fehlkonzept                                      | misconception                         | conception erronée                       | concepción errónea                        | concezione errata                          |
| Hinweis auf ein mögliches Fehlkonzept (Langform) | indicator of a possible misconception | indice d’une possible conception erronée | indicio de una posible concepción errónea | indizio di una possibile concezione errata |
| Hinweis auf ein mögliches Fehlkonzept (kurz)     | Possible misconception                | Possible conception erronée              | Posible concepción errónea                | Possibile concezione errata                |
| Selbsteinschätzung (Fachbegriff)                 | self-rated confidence                 | degré de confiance autoévalué            | grado de seguridad autoevaluado           | grado di sicurezza autovalutato            |
| Selbsteinschätzung (kurzer Abschnittstitel)      | Answer confidence                     | Confiance dans la réponse                | Seguridad en la respuesta                 | Sicurezza nella risposta                   |
| Antwortsicherheit                                | confidence in the answer              | confiance dans la réponse                | seguridad en la respuesta                 | sicurezza nella risposta                   |
| gefestigtes Wissen                               | solid understanding                   | connaissances consolidées                | conocimiento consolidado                  | conoscenze consolidate                     |
| fragiles Wissen                                  | understanding not yet secure          | connaissances encore fragiles            | conocimiento aún no consolidado           | conoscenze non ancora consolidate          |
| Wissenslücke                                     | knowledge gap                         | lacune de connaissances                  | laguna de conocimientos                   | lacuna nelle conoscenze                    |
| Lösungsquote                                     | correct response rate                 | taux de réponses correctes               | tasa de acierto                           | tasso di risposte corrette                 |
| Distraktor                                       | distractor                            | distracteur                              | distractor                                | distrattore                                |
| Peer Instruction                                 | Peer Instruction                      | Peer Instruction                         | Peer Instruction                          | Peer Instruction                           |

### Italienisch: Nachbesprechung

`Revisione` / `piano di revisione` **nicht** verwenden — klingt nach Dokumentüberarbeitung, Prüfung oder Lernstoff-Wiederholung.

Verbindlich landessprachlich:

- Nachbesprechung → **discussione dei risultati**
- Nachbesprechungsplan → **piano per la discussione dei risultati**

Kompakte anglophone Alternativen (`debriefing` / `piano di debriefing`) nur, wenn Platz extrem knapp ist; für Lehrkräfte die landessprachliche Variante bevorzugen.

### Lösungsquote

Verbindlicher Standard in der Kernbegriff-Tabelle. Der Report meint den Anteil **vollständig richtiger** Antworten pro Frage.

- FR: **taux de réponses correctes** (nicht `taux de réussite` — das für übergeordnete Lern-/Prüfungsergebnisse reservieren).
- ES `tasa de acierto` und IT `tasso di risposte corrette` bleiben idiomatisch.
- Optionale Präzisionsvarianten in Definitionssätzen: ES `porcentaje de respuestas correctas` · IT `percentuale di risposte corrette`.

---

## Fachlich entscheidende Abgrenzung

Die Kategorie **falsch + hohe Sicherheit** beweist **kein** Fehlkonzept. In allen Sprachen muss zwischen der Fachkategorie „Fehlkonzept“ und dem **diagnostischen Hinweis** unterschieden werden.

### Lange Form (Erläuterungstexte)

| EN                                    | FR                                       | ES                                        | IT                                         |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| indicator of a possible misconception | indice d’une possible conception erronée | indicio de una posible concepción errónea | indizio di una possibile concezione errata |

### Kurze Form (Karten, Legenden, Kennzahlen)

| EN                     | FR                          | ES                         | IT                          |
| ---------------------- | --------------------------- | -------------------------- | --------------------------- |
| Possible misconception | Possible conception erronée | Posible concepción errónea | Possibile concezione errata |

### Im Satz (EN-Beispiel)

> This pattern may indicate a possible misconception.

Nicht verwenden: `misconception hint`; kategorisches `misconception` als Zellenlabel ohne „possible“; EN-Langform nur als `possible misconception` ohne „indicator of“; `idea errónea` / `idea errata` als Ersatz für den Fachbegriff; IT `ripresa` / `piano di ripresa` / `revisione` für die Nachbesprechung.

---

## Selbsteinschätzung: UI-Label vs. Fachbegriff

Die Skala misst **Antwortsicherheit**, nicht allgemeine Selbstevaluation. Deshalb zwei Register:

| Verwendung                                        | EN                        | FR                                | ES                                  | IT                                  |
| ------------------------------------------------- | ------------------------- | --------------------------------- | ----------------------------------- | ----------------------------------- |
| Abschnittstitel / kurze UI-Labels                 | **Answer confidence**     | **Confiance dans la réponse**     | **Seguridad en la respuesta**       | **Sicurezza nella risposta**        |
| erklärender Fachbegriff (Leitfaden, Definitionen) | **Self-rated confidence** | **Degré de confiance autoévalué** | **Grado de seguridad autoevaluado** | **Grado di sicurezza autovalutato** |

`Antwortsicherheit` / `confidence in the answer` / `confiance dans la réponse` / … bleibt der neutrale Messwert-Begriff in Diagrammachsen und Detailzeilen.

---

## Frageformate (über „Antwort“, nicht „Auswahl“)

Englisch `Multiple choice` und spanisch `opción múltiple` sind oft mehrdeutig (auch bei nur einer richtigen Antwort). Deshalb über **Antwortanzahl** lokalisieren:

### Volle Bezeichnung (Fließtext, Typenlisten)

| DE-Systembegriff | EN                       | FR                            | ES                             | IT                          |
| ---------------- | ------------------------ | ----------------------------- | ------------------------------ | --------------------------- |
| Single Choice    | Single-answer question   | Question à réponse unique     | Pregunta de respuesta única    | Domanda a risposta singola  |
| Multiple Choice  | Multiple-answer question | Question à réponses multiples | Pregunta de respuesta múltiple | Domanda a risposta multipla |

### Kurze Badge-Texte

| EN               | FR                 | ES                 | IT                |
| ---------------- | ------------------ | ------------------ | ----------------- |
| Single answer    | Réponse unique     | Respuesta única    | Risposta singola  |
| Multiple answers | Réponses multiples | Respuesta múltiple | Risposta multipla |

---

## Warum diese Fassung (Kurzbegründung)

| Begriff (alt → neu)                                                                                       | Problem                                                                      | Entscheidung                             |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| EN `misconception hint` → kurz **Possible misconception**, lang **indicator of a possible misconception** | Klingt wie Hinweis _an_ Lernende; Kurzform allein zu knapp für Erläuterungen | Label vs. Erläuterung trennen            |
| IT `ripresa` / `revisione` → **discussione dei risultati**                                                | Missverständlich (Erholung / Redaktion / Stoffwiederholung)                  | Gemeinsame Besprechung der Quizresultate |
| FR `sécurité de la réponse` → **confiance dans la réponse**                                               | Technische „Sicherheit“                                                      | Antwortsicherheit                        |
| EN `fragile knowledge` → **understanding not yet secure**                                                 | Übersetzt / etikettierend                                                    | Natürlicher für Lehrkräfte               |
| bloßes `self-assessment` → UI **Answer confidence** + Fach **self-rated confidence**                      | Zu breit bzw. zu schwerfällig                                                | Register trennen                         |
| ES/IT `idea errónea` / `idea errata` → **concepción / concezione …**                                      | Fachlich schwächer                                                           | Didaktisch präziser                      |
| EN `success rate` → **correct response rate**                                                             | Mehrdeutig                                                                   | Anteil vollständig richtiger Antworten   |
| EN `solid knowledge` → **solid understanding**                                                            | Weniger pädagogisch                                                          | Natürlicher für Lehrkräfte               |
| ES `plan de …` → **plan para la puesta en común**                                                         | Weniger idiomatisch                                                          | Schulsprachlich natürlicher              |
| Frageformate über „choice/opción“ → über **answer/respuesta**                                             | SC/MC-Mehrdeutigkeit                                                         | Eindeutig Ein-/Mehrfachantwort           |

### Englisch (zusätzlich)

- `debrief` / `debriefing plan` bleiben verbindlich. `Post-quiz review` wäre unmittelbarer, aber weniger kompakt — kein Ersatz.
- Fehlkonzept-Hinweis: Langform immer mit **indicator of …**; Kurzform nur auf Karten/Legenden.

### Französisch (zusätzlich)

- `Débriefing` bleibt; `mise en commun` nicht als Ersatz für die gesamte diagnostische Nachbesprechung.
- Lösungsquote verbindlich **taux de réponses correctes**; `taux de réussite` nicht für Frage-Lösungsquoten.

### Spanisch (zusätzlich)

- `puesta en común` idiomatisch; `Quiz` in digitalen Lernumgebungen ok (formeller: `cuestionario` nur bei bereits formellem Kontext).
- `tasa de acierto` bleibt verbindlich; Präzisionsvariante optional.

### Italienisch (zusätzlich)

- Verbindlich **discussione dei risultati** / **piano per la discussione dei risultati**.
- `Distrattore`, `conoscenze consolidate`, `tasso di risposte corrette` bleiben korrekt.

---

## Cognates (dürfen DE ≈ Locale bleiben)

Nur wenn in der Zielsprache idiomatisch und verständlich:

- `quizName` → „Quiz“ (en / fr / it; es optional „Quiz“ oder kontextuell „cuestionario“)
- `bonusCode` → „Code“ (fr / en), sonst übersetzen (es: Código, it: Codice)
- `Median`, `Team`, `Nickname`, `Status`, `Upvotes` (en)
- **Nicht** als Cognate belassen: `Single Choice` / `Multiple Choice` (siehe Frageformate oben)

---

## Mapping auf Label-Keys (Orientierung)

| Glossar                                                | Typische Keys / Kontexte                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nachbesprechungsplan                                   | `actionPlanTitle`, `tocActionPlan`, Cover-Untertitel                                                                                             |
| Hinweis kurz / lang                                    | kurz: `confidenceRisk`, Heatmap-Legende, Cover-Kennzahl · lang EN: _indicator of a possible misconception_; FR/ES/IT: _indice/indicio/indizio …_ |
| Answer confidence / Fachbegriff                        | Titel vs. Erklärtexte in Confidence-Sektion                                                                                                      |
| correct response rate / taux de réponses correctes / … | `hardestQuestion*`, Action-Plan-Kriterien, Team-Lernprofil                                                                                       |
| understanding not yet secure / …                       | Fragile-Kategorie in Leitfaden und Heatmap                                                                                                       |
| solid understanding / …                                | Mastery-Kategorie                                                                                                                                |
| Single-/Multiple-answer                                | `questionTypeSingleChoice`, `questionTypeMultipleChoice`                                                                                         |

---

## Pflege

1. Neue Berichtslabels zuerst in `labels-de.ts` und Angular `$localize` (`sessionReport.*`).
2. Locales: `npm run sync-i18n -w @arsnova/frontend` (XLF) und danach  
   `npm run sync-labels-from-xlf -w @arsnova/session-export-report` (Shared-Lib).
3. Nach Sync: Strings gegen **dieses** Glossar gegenlesen (XLF-Rohübersetzungen oft zu wörtlich).
4. CI: `labels-locale.util.test.ts` prüft unbeabsichtigte DE-Fallbacks.
5. Demo-PDFs regenerieren, wenn Labels oder Showcase-JSON glossarkonform sind:  
   `npm run generate:session-pdf-demo -w @arsnova/frontend` (Backend + DB).

## Qualitätsgate (Review)

Vor Freigabe einer Locale im Demo-PDF:

- [ ] Cover + Datenschutz ohne DE-Reste
- [ ] Confidence: Abschnittstitel kurz (**Answer confidence** / Äquivalent); Definitionen mit Fachbegriff
- [ ] Risiko: kurze Labels (**Possible misconception** / Äquivalent); Erläuterungen EN mit **indicator of a possible misconception**
- [ ] IT: **discussione dei risultati** / **piano per la discussione…** (kein ripresa / revisione)
- [ ] Frageformate über Antwortanzahl (Single-/Multiple-answer bzw. landessprachlich)
- [ ] FR Lösungsquote: **taux de réponses correctes** (nicht taux de réussite)
- [ ] Fragiles Wissen / Nachbesprechungsplan gemäß Tabellen
- [ ] FR: vous; ES/IT: Infinitiv oder unpersönlich (kein `Revisa` / `Rivedi`)
- [ ] Action-Plan / Next-Steps mit korrekten Platzhaltern `{0}`…
- [ ] Glossar-Begriffe konsistent (nicht synonym-wild)
