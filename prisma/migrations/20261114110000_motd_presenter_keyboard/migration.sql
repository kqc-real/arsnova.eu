-- Die Presenter-Ankündigung erscheint für sieben Tage ab der Auslieferung.
-- Ein vorhandener Entwurf wird mit seinen vorhandenen Texten veröffentlicht.

BEGIN;

WITH publication AS (
  SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS starts_at
), published AS (
  INSERT INTO "Motd" (
    "id", "status", "priority", "startsAt", "endsAt", "visibleInArchive",
    "contentVersion", "templateId", "createdAt", "updatedAt"
  )
  SELECT
    '138b06dd-5b1f-4f49-8516-19abc962a8d6', 'PUBLISHED'::"MotdStatus", 130,
    starts_at, starts_at + INTERVAL '7 days',
    false, 1, NULL, starts_at, starts_at
  FROM publication
  ON CONFLICT ("id") DO UPDATE SET
    "status" = EXCLUDED."status",
    "priority" = EXCLUDED."priority",
    "startsAt" = EXCLUDED."startsAt",
    "endsAt" = EXCLUDED."endsAt",
    "updatedAt" = EXCLUDED."updatedAt"
  WHERE "Motd"."status" = 'DRAFT'
  RETURNING "id"
)
INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
SELECT gen_random_uuid()::text, published."id", content.locale, content.markdown
FROM published
CROSS JOIN (VALUES
  ('de', $mdde$## Neu auf der Bühne

Ob im Unterricht, in der Vorlesung oder bei einem Vortrag: Mit **arsnova** steuerst du dein Live-Quiz auf dem Beamer per Tastatur und kannst frühere Ergebnisse für die Diskussion noch einmal zeigen.

- **Mit Pfeiltasten steuern.** Drücke **→**, sobald der nächste Schritt im Quiz verfügbar ist. Mit **↑** und **↓** blätterst du durch mehrseitige Fragen und Ergebnisse.
- **Frühere Ergebnisse besprechen.** Mit **←** rufst du ein früheres Ergebnis auf. Währenddessen kann dein Publikum die aktuelle Frage weiter beantworten. Mit **→** blätterst du vorwärts bis zur Live-Ansicht.
- **Richtige Antworten auf einen Blick.** Sobald du das Ergebnis zeigst, werden die richtigen Antwortoptionen grün hervorgehoben.

Wähle in deiner Live-Session **»Präsentation starten«** und probier die Bühne beim nächsten Quiz aus.$mdde$),
  ('en', $mden$## What’s new on the big screen

Planning a live quiz for your next class, lecture or talk? With **arsnova**, you can run the presentation from your keyboard and bring earlier results back on screen for discussion.

- **Use the arrow keys.** Press **→** when the next step in the quiz is available. Use **↑** and **↓** to move through questions and results that span several pages.
- **Revisit earlier results.** Press **←** to bring up an earlier result. Your audience can keep answering the current question while you discuss it. Use **→** to work your way back to the live view.
- **See the correct answers at a glance.** When you reveal the results, the correct options are highlighted in green.

Launch the presentation from your live session and give it a go in your next quiz.$mden$),
  ('fr', $mdfr$## Du nouveau sur grand écran

Vous prévoyez un quiz pour votre prochain cours ou votre prochaine conférence ? Avec **arsnova**, vous pouvez piloter la présentation au clavier et réafficher des résultats pour en discuter avec votre public.

- **Pilotez le quiz avec les flèches.** Appuyez sur **→** lorsque vous pouvez passer à l’étape suivante. Utilisez **↑** et **↓** pour parcourir les questions et les résultats qui tiennent sur plusieurs pages.
- **Revenez sur un résultat précédent.** Appuyez sur **←** pour le réafficher. Pendant que vous en discutez, le public peut continuer à répondre à la question en cours. Avancez avec **→** jusqu’à retrouver la question en cours.
- **Repérez les bonnes réponses d’un coup d’œil.** Lorsque vous affichez les résultats, les bonnes réponses sont mises en évidence en vert.

Lancez la présentation depuis votre session et essayez ces nouveautés lors de votre prochain quiz.$mdfr$),
  ('es', $mdes$## Novedades en la pantalla grande

¿Vas a hacer un quiz en tu próxima clase o charla? Con **arsnova** puedes controlar la presentación con el teclado y volver a mostrar resultados anteriores para comentarlos con el público.

- **Maneja el quiz con las flechas.** Pulsa **→** cuando puedas pasar al siguiente paso. Usa **↑** y **↓** para recorrer las preguntas y los resultados que ocupan varias páginas.
- **Comenta un resultado anterior.** Pulsa **←** para volver a mostrarlo. Mientras lo comentas, el público puede seguir respondiendo a la pregunta en curso. Pulsa **→** para avanzar hasta volver a la vista en directo.
- **Identifica las respuestas correctas de un vistazo.** Al mostrar los resultados, las opciones correctas se resaltan en verde.

Inicia la presentación desde tu sesión y prueba estas novedades en tu próximo quiz.$mdes$),
  ('it', $mdit$## Novità sul grande schermo

Stai preparando un quiz per la prossima lezione o per il tuo prossimo intervento? Con **arsnova** puoi gestire la presentazione dalla tastiera e tornare ai risultati precedenti per discuterne con il pubblico.

- **Usa i tasti freccia.** Premi **→** quando puoi passare alla fase successiva del quiz. Usa **↑** e **↓** per sfogliare le domande e i risultati che occupano più pagine.
- **Rivedi un risultato precedente.** Premi **←** per mostrarlo di nuovo. Mentre ne discuti, il pubblico può continuare a rispondere alla domanda in corso. Premi **→** per avanzare fino a tornare alla domanda in corso.
- **Riconosci a colpo d’occhio le risposte corrette.** Quando mostri i risultati, le opzioni corrette vengono evidenziate in verde.

Avvia la presentazione dalla tua sessione e prova queste novità al prossimo quiz.$mdit$)
) AS content(locale, markdown)
ON CONFLICT ("motdId", "locale") DO NOTHING;

COMMIT;
