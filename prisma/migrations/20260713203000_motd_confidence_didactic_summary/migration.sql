-- Erweitert die Feature-MOTD zum Sicherheitsgrad um die didaktisch-paedagogische
-- Abschlussauswertung. contentVersion 6 zeigt die idiomatisch ueberarbeitete Fassung
-- auch Personen erneut an, die eine vorherige Version bereits geschlossen hatten.

UPDATE "Motd"
SET
  "contentVersion" = 6,
  "updatedAt" = NOW()
WHERE "id" = 'c0111111-c111-4c11-8c11-c01111111111';

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'de',
  $mdde$# Was sitzt wirklich?

## Mehr sehen als richtig oder falsch

**Neu: Du siehst sofort, was ihr noch besprechen solltet.**

Eine richtige Antwort heißt nicht immer: „Das sitzt.“ Vielleicht war sie nur gut geraten. Deshalb können Lernende nach jeder Antwort angeben, wie sicher sie sind.

Nach dem Quiz zeigt dir die Auswertung:

- **Gefestigtes Wissen** – richtig und sicher: Das sitzt.
- **Fragiles Wissen** – richtig, aber unsicher: Das ist noch wackelig.
- **Fehlkonzept-Risiko** – falsch und sicher: Das solltet ihr euch noch einmal ansehen.

Die wichtigsten Fragen stehen gleich oben. So weißt du, womit du die Nachbesprechung beginnen kannst.

Du findest die Zusammenfassung am Ende der Session, später über **„Letzte Auswertung“** auf der Quizkarte und im CSV-Export. Alles bleibt **anonym zusammengefasst**. Punkte und Rangliste ändern sich nicht.

**Im Quiz-Editor „Sicherheitsgrad abfragen“ einschalten und ausprobieren.**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'en',
  $mden$# What have your learners really understood?

## Look beyond right and wrong

**New: see at a glance what needs another look.**

A correct answer does not always mean the idea has been understood. It may have been a good guess. Learners can therefore say how confident they are after each answer.

After the quiz, the analysis shows:

- **Solid knowledge** — correct and confident: this is secure.
- **Fragile knowledge** — correct but unsure: this needs reinforcing.
- **Misconception risk** — incorrect but confident: discuss this together.

The most important questions appear first, so you know where to start the debrief.

Find the summary when the session ends, later under **“Latest analysis”** on the quiz card, and in the CSV export. Everything remains **anonymous and aggregated**. Scoring and the leaderboard do not change.

**Turn on “Ask for confidence level” in the quiz editor and give it a try.**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'fr',
  $mdfr$# Qu’est-ce que tes apprenant·es maîtrisent vraiment ?

## Ne t’arrête pas à « juste » ou « faux »

**Nouveau : repère immédiatement ce qu’il faut reprendre.**

Une bonne réponse ne signifie pas toujours que la notion est maîtrisée. Elle peut aussi être due au hasard. Après chaque réponse, les apprenant·es peuvent donc indiquer leur degré de certitude.

Après le quiz, l’analyse te montre :

- **Connaissances solides** — réponse juste et assurée : c’est acquis.
- **Connaissances fragiles** — réponse juste mais hésitante : à consolider.
- **Risque d’idée fausse** — réponse fausse mais assurée : à reprendre ensemble.

Les questions qui méritent le plus d’être discutées apparaissent en premier. Tu sais ainsi par où commencer.

Tu retrouves le résumé à la fin de la session, plus tard via **« Dernière analyse »** sur la carte du quiz et dans l’export CSV. Tout reste **agrégé et anonyme**. Les points et le classement ne changent pas.

**Active « Demander le niveau de confiance » dans l’éditeur de quiz et essaie.**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'es',
  $mdes$# ¿Qué domina realmente tu alumnado?

## Ve más allá de «correcto» o «incorrecto»

**Nuevo: detecta de un vistazo qué conviene repasar.**

Una respuesta correcta no siempre significa que el contenido esté dominado. También puede ser fruto del azar. Por eso, después de cada respuesta, el alumnado puede indicar su grado de seguridad.

Al terminar el quiz, el análisis te muestra:

- **Conocimiento sólido** — respuesta correcta y dada con seguridad: está dominado.
- **Conocimiento frágil** — respuesta correcta, pero dada con dudas: conviene reforzarlo.
- **Riesgo de idea errónea** — respuesta incorrecta, pero dada con seguridad: conviene revisarla en grupo.

Las preguntas que más conviene comentar aparecen primero. Así sabes por dónde empezar el repaso.

Encontrarás el resumen al terminar la sesión, más tarde mediante **«Último análisis»** en la tarjeta del quiz y en la exportación CSV. Todo permanece **agregado y anónimo**. La puntuación y la clasificación no cambian.

**Activa «Preguntar grado de seguridad» en el editor de quiz y pruébalo.**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0111111-c111-4c11-8c11-c01111111111',
  'it',
  $mdit$# Che cosa hanno capito davvero i tuoi studenti?

## Vai oltre «giusto» o «sbagliato»

**Novità: individua subito cosa vale la pena riprendere.**

Una risposta corretta non significa sempre che l’argomento sia stato capito. Potrebbe anche essere un colpo di fortuna. Per questo, dopo ogni risposta, gli studenti possono indicare quanto sono sicuri.

Al termine del quiz, l’analisi mostra:

- **Conoscenza solida** — risposta corretta e sicura: concetto acquisito.
- **Conoscenza fragile** — risposta corretta ma incerta: da consolidare.
- **Rischio di malintesi** — risposta sbagliata ma sicura: da rivedere insieme.

Le domande che vale più la pena discutere compaiono per prime. Così sai da dove iniziare il confronto finale.

Trovi il riepilogo alla fine della sessione, in seguito tramite **«Ultima analisi»** sulla scheda del quiz e nell’esportazione CSV. Tutto resta **aggregato e anonimo**. Punteggio e classifica non cambiano.

**Attiva «Chiedi il livello di sicurezza» nell’editor del quiz e provalo.**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
