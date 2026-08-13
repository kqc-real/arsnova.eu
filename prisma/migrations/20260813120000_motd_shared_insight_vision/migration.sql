-- Vision-MOTD: Aus vielen Stimmen wird gemeinsame Erkenntnis.
-- Feste ID; idempotent fuer lokale Seeds und produktive Migrationen.

INSERT INTO "Motd" (
  "id",
  "status",
  "priority",
  "startsAt",
  "endsAt",
  "visibleInArchive",
  "contentVersion",
  "templateId",
  "createdAt",
  "updatedAt"
) VALUES (
  'c0555555-c555-4c55-8c55-c05555555555',
  'PUBLISHED',
  80,
  '2026-08-13 00:00:00'::timestamp(3),
  '2027-03-31 23:59:59.999'::timestamp(3),
  true,
  1,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "priority" = EXCLUDED."priority",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "visibleInArchive" = EXCLUDED."visibleInArchive",
  "contentVersion" = EXCLUDED."contentVersion",
  "templateId" = EXCLUDED."templateId",
  "updatedAt" = NOW();

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0555555-c555-4c55-8c55-c05555555555',
  'de',
  $mdde$### ✨ Unsere zentrale Vision: Aus vielen Stimmen wird gemeinsame Erkenntnis

arsnova.eu soll mehr leisten, als Antworten zu sammeln. Unsere Vision ist eine Lehrveranstaltung, in der die Gedanken eines ganzen Raumes sichtbar, verständlich und unmittelbar für die weitere Lehre nutzbar werden.

Die interaktive Begriffswolke zeigt, welche Themen die Teilnehmenden bewegen. Die sprachliche Normalisierung führt unterschiedliche Ausdrucksformen nachvollziehbar zusammen. Die semantische Themenanalyse erkennt inhaltlich verwandte Fragen und Positionen. Der Moderationskompass verbindet diese Erkenntnisse mit Quizresultaten, Kontroversen, Verständnisproblemen und Live-Feedback – und leitet daraus quellenbelegte Vorschläge für den nächsten sinnvollen Moderationsschritt ab.

**Das ist der künftige USP von arsnova.eu:** ein erklärbares gemeinsames Lagebild für dialogische Lehre, das kollektive Beteiligung, intelligente Analyse und konkrete didaktische Orientierung miteinander verbindet.

KI unterstützt, aber sie entscheidet nicht. Jede Aussage bleibt auf ihre Quellen zurückführbar, die Lehrperson behält jederzeit die pädagogische Kontrolle und der Livebetrieb funktioniert auch ohne NLP- oder LLM-Server vollständig weiter.

Mit den [Storys 1.14a–1.14c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md) und den [Storys 8.9a–8.9c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md) verwirklichen wir diese Vision Schritt für Schritt.

> **arsnova.eu verwandelt die vielen Stimmen einer Lehrveranstaltung in ein erklärbares gemeinsames Lagebild – damit Lehrende erkennen, was jetzt didaktisch wichtig ist.**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0555555-c555-4c55-8c55-c05555555555',
  'en',
  $mden$### ✨ Our defining vision: Turning many voices into shared insight

arsnova.eu should do more than collect responses. Our vision is a learning experience in which the thoughts of an entire room become visible, understandable and immediately useful for teaching.

The interactive word cloud reveals the topics that matter to participants. Linguistic normalization transparently brings together different ways of expressing the same idea. Semantic topic analysis identifies questions and viewpoints that are related in meaning. The moderation compass combines these insights with quiz results, points of controversy, signs of misunderstanding and live feedback – and turns them into source-grounded suggestions for the next meaningful facilitation step.

**This is the distinctive value we are building with arsnova.eu:** an explainable, shared view of the learning situation that connects collective participation, intelligent analysis and actionable teaching guidance.

AI supports educators; it does not make decisions for them. Every statement remains traceable to its sources, educators retain full pedagogical control, and the live experience continues to work in full even when no NLP or LLM server is available.

We are bringing this vision to life step by step through [user stories 1.14a–1.14c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md) and [user stories 8.9a–8.9c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md).

> **arsnova.eu turns the many voices in a learning session into an explainable, shared view – helping educators recognize what matters most for learning right now.**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0555555-c555-4c55-8c55-c05555555555',
  'fr',
  $mdfr$### ✨ Notre vision fondatrice : faire émerger une compréhension commune de toutes les voix

arsnova.eu doit aller au-delà du simple recueil de réponses. Notre vision est celle d’un enseignement dans lequel les réflexions de toute une salle deviennent visibles, compréhensibles et immédiatement utiles pour orienter la suite du cours.

Le nuage de mots interactif révèle les sujets qui mobilisent les participantes et participants. La normalisation linguistique rapproche de manière transparente différentes formulations d’une même idée. L’analyse thématique sémantique identifie les questions et les points de vue dont le sens est proche. La boussole de modération relie ces informations aux résultats des quiz, aux controverses, aux difficultés de compréhension et aux retours en direct – puis en déduit des suggestions étayées par des sources pour la prochaine intervention pédagogique.

**C’est la valeur distinctive que nous construisons avec arsnova.eu :** une vision commune et explicable de la situation d’apprentissage, associant participation collective, analyse intelligente et orientation pédagogique concrète.

L’IA assiste les enseignantes et enseignants, mais ne décide jamais à leur place. Chaque affirmation reste reliée à ses sources, la responsabilité pédagogique demeure entièrement entre leurs mains et la session en direct reste pleinement opérationnelle même sans serveur de traitement automatique du langage ou de LLM.

Nous concrétisons progressivement cette vision à travers les [user stories 1.14a–1.14c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md) et les [user stories 8.9a–8.9c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md).

> **arsnova.eu transforme les nombreuses voix d’une séance en une compréhension commune et explicable – afin d’aider les enseignantes et enseignants à reconnaître ce qui est pédagogiquement prioritaire à cet instant.**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0555555-c555-4c55-8c55-c05555555555',
  'it',
  $mdit$### ✨ La nostra visione guida: trasformare molte voci in una comprensione condivisa

arsnova.eu deve offrire più di una semplice raccolta di risposte. Immaginiamo un’esperienza didattica in cui i pensieri di un’intera aula diventino visibili, comprensibili e immediatamente utili per orientare le fasi successive della lezione.

La nuvola di parole interattiva mostra i temi più rilevanti per chi partecipa. La normalizzazione linguistica riunisce in modo trasparente formulazioni diverse della stessa idea. L’analisi semantica dei temi riconosce domande e punti di vista affini. La bussola di moderazione collega queste informazioni ai risultati dei quiz, alle controversie, alle difficoltà di comprensione e ai feedback in tempo reale – e ne ricava suggerimenti fondati su fonti verificabili per il successivo intervento didattico.

**Questo è il valore distintivo che vogliamo realizzare con arsnova.eu:** un quadro condiviso e spiegabile della situazione di apprendimento, capace di unire partecipazione collettiva, analisi intelligente e orientamento didattico concreto.

L’IA assiste chi insegna, ma non decide al suo posto. Ogni affermazione resta riconducibile alle proprie fonti, il controllo pedagogico rimane sempre nelle mani di chi conduce la lezione e la sessione live continua a funzionare pienamente anche senza un server NLP o LLM.

Realizziamo questa visione passo dopo passo attraverso le [user story 1.14a–1.14c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md) e le [user story 8.9a–8.9c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md).

> **arsnova.eu trasforma le molte voci di una lezione in una comprensione condivisa e spiegabile – per aiutare chi insegna a riconoscere ciò che è didatticamente prioritario in quel momento.**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0555555-c555-4c55-8c55-c05555555555',
  'es',
  $mdes$### ✨ Nuestra visión central: convertir muchas voces en una comprensión compartida

arsnova.eu debe ofrecer mucho más que una simple recopilación de respuestas. Nuestra visión es una experiencia educativa en la que las ideas de toda una sala se vuelvan visibles, comprensibles y útiles de inmediato para orientar los siguientes pasos de la enseñanza.

La nube de palabras interactiva muestra los temas que más interesan a quienes participan. La normalización lingüística reúne de forma transparente distintas maneras de expresar una misma idea. El análisis semántico de temas identifica preguntas y puntos de vista relacionados por su significado. La brújula de moderación conecta estas conclusiones con los resultados de los quiz, los puntos de controversia, las dificultades de comprensión y el feedback en directo – y los convierte en propuestas respaldadas por fuentes para el siguiente paso didáctico.

**Este es el valor distintivo que queremos hacer realidad con arsnova.eu:** una visión compartida y explicable de la situación de aprendizaje que une participación colectiva, análisis inteligente y orientación didáctica concreta.

La IA ayuda al profesorado, pero no decide en su lugar. Cada afirmación puede rastrearse hasta sus fuentes, el control pedagógico permanece siempre en manos de quienes dirigen la sesión y la experiencia en directo continúa funcionando plenamente incluso sin un servidor NLP o LLM.

Estamos haciendo realidad esta visión paso a paso mediante las [historias de usuario 1.14a–1.14c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md) y las [historias de usuario 8.9a–8.9c](https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md).

> **arsnova.eu convierte las muchas voces de una sesión educativa en una comprensión compartida y explicable – para que el profesorado reconozca qué es prioritario para el aprendizaje en cada momento.**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
