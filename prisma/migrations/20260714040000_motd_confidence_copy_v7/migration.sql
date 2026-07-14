-- Ersetzt die Feature-MOTD zum Sicherheitsgrad durch die redaktionell
-- freigegebenen Texte in allen fünf Locales.

UPDATE "Motd"
SET
  "contentVersion" = 7,
  "updatedAt" = NOW()
WHERE "id" = 'c0111111-c111-4c11-8c11-c01111111111';

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'de',
  $mdde$### Neu im Quiz: Sicher ist nicht immer richtig

Nach dem Quiz zeigt dir arsnova.eu jetzt nicht nur, welche Antworten richtig oder falsch waren, sondern auch, wie sicher sich deine Teilnehmenden dabei waren.

So erkennst du sofort:

✅ **Gefestigtes Wissen** – richtig und sicher: Das sitzt.

🌱 **Fragiles Wissen** – richtig, aber unsicher: Das braucht Bestätigung.

⚠️ **Fehlkonzept-Risiko** – falsch, aber sicher: Genau hier wird es didaktisch spannend.

🧭 **Lernbedarf** – falsch und unsicher: Hier fehlt noch Orientierung.

Die wichtigsten Fragen stehen automatisch oben. So siehst du direkt, womit du die Nachbesprechung starten solltest.

Du findest die Auswertung am Ende der Session, später über **„Letzte Auswertung“** auf der Quizkarte und im **CSV-Export**. Alles bleibt anonym zusammengefasst. Punkte und Rangliste ändern sich nicht.

Aktiviere im Quiz-Editor einfach **„Sicherheitsgrad abfragen“** und probiere es im nächsten Quiz aus.$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'en',
  $mden$### New in quizzes: Confidence changes the picture

After a quiz, arsnova.eu now shows you more than right or wrong answers. It also shows how confident your participants were when they answered.

At a glance, you can spot:

✅ **Solid knowledge** – correct and confident: This is settled.

🌱 **Fragile knowledge** – correct but unsure: This needs reinforcement.

⚠️ **Misconception risk** – wrong but confident: This is where the discussion gets valuable.

🧭 **Learning need** – wrong and unsure: This needs orientation.

The most relevant questions are placed at the top automatically, so you know exactly where to start the debrief.

You will find the summary at the end of the session, later via **“Last evaluation”** on the quiz card, and in the **CSV export**. Everything remains anonymously aggregated. Scores and the leaderboard stay unchanged.

Enable **“Ask for confidence level”** in the quiz editor and try it in your next quiz.$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'fr',
  $mdfr$### Nouveau dans les quiz : la confiance change l’analyse

Après un quiz, arsnova.eu ne montre plus seulement quelles réponses étaient justes ou fausses. La plateforme indique aussi à quel point les participantes et participants étaient sûrs de leurs réponses.

En un coup d’œil, tu repères :

✅ **Savoir consolidé** – juste et sûr : c’est acquis.

🌱 **Savoir fragile** – juste, mais hésitant : cela mérite d’être renforcé.

⚠️ **Risque de fausse conception** – faux, mais sûr : c’est là que le débriefing devient le plus utile.

🧭 **Besoin d’apprentissage** – faux et incertain : il manque encore des repères.

Les questions les plus importantes apparaissent automatiquement en haut. Tu sais donc immédiatement par où commencer la discussion.

Tu trouveras le résumé à la fin de la session, plus tard via **« Dernière évaluation »** sur la carte du quiz, ainsi que dans l’**export CSV**. Tout reste agrégé de manière anonyme. Les points et le classement ne changent pas.

Active simplement **« Demander le degré de confiance »** dans l’éditeur de quiz et teste la fonction lors de ton prochain quiz.$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'es',
  $mdes$### Nuevo en los cuestionarios: la seguridad también cuenta

Después de un cuestionario, arsnova.eu ya no te muestra solo qué respuestas fueron correctas o incorrectas. Ahora también ves con qué seguridad respondieron tus participantes.

De un vistazo puedes detectar:

✅ **Conocimiento consolidado** – correcto y seguro: esto está claro.

🌱 **Conocimiento frágil** – correcto, pero con dudas: conviene reforzarlo.

⚠️ **Riesgo de concepto erróneo** – incorrecto, pero seguro: aquí es donde la revisión se vuelve especialmente valiosa.

🧭 **Necesidad de aprendizaje** – incorrecto e inseguro: aquí falta orientación.

Las preguntas más relevantes aparecen automáticamente arriba. Así sabes enseguida por dónde empezar la puesta en común.

Encontrarás el resumen al final de la sesión, más tarde en **« Última evaluación »** en la tarjeta del cuestionario y también en la **exportación CSV**. Todo permanece agregado de forma anónima. Los puntos y la clasificación no cambian.

Activa **« Preguntar grado de seguridad »** en el editor de cuestionarios y pruébalo en tu próximo quiz.$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'it',
  $mdit$### Novità nei quiz: la sicurezza fa la differenza

Dopo un quiz, arsnova.eu non mostra più soltanto quali risposte erano corrette o sbagliate. Ora ti indica anche quanto erano sicuri i partecipanti quando hanno risposto.

A colpo d’occhio puoi riconoscere:

✅ **Conoscenza consolidata** – corretta e sicura: questo è acquisito.

🌱 **Conoscenza fragile** – corretta, ma incerta: va rafforzata.

⚠️ **Rischio di misconcezione** – sbagliata, ma sicura: qui il confronto didattico diventa davvero interessante.

🧭 **Bisogno di apprendimento** – sbagliata e incerta: qui serve ancora orientamento.

Le domande più rilevanti vengono mostrate automaticamente in alto. Così sai subito da dove iniziare il debriefing.

Trovi il riepilogo alla fine della sessione, in seguito tramite **« Ultima valutazione »** sulla scheda del quiz e anche nell’**export CSV**. Tutto resta aggregato in forma anonima. Punteggi e classifica non cambiano.

Attiva **« Chiedi il grado di sicurezza »** nell’editor del quiz e provalo nel tuo prossimo quiz.$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
