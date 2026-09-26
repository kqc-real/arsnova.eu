-- Ankündigung der geplanten einfacheren Host-Benutzerführung (Issue #470).
-- Feste ID; idempotent für lokale Seeds und produktive Migrationen.

INSERT INTO "Motd" (
  "id", "status", "priority", "startsAt", "endsAt", "visibleInArchive",
  "contentVersion", "templateId", "createdAt", "updatedAt"
) VALUES (
  'c0999999-c999-4c99-8c99-c09999999999',
  'PUBLISHED',
  120,
  '2026-09-26 00:00:00'::timestamp(3),
  '2026-12-31 23:59:59.999'::timestamp(3),
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

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES (
  gen_random_uuid()::text,
  'c0999999-c999-4c99-8c99-c09999999999',
  'de',
  $mdde$### Einfacher durch Quiz, Q&A und Blitzlicht

Wir möchten arsnova.eu für Lehrende und Moderierende leichter bedienbar machen. Auf der Startseite soll eine kurze Auswahl zum aktuellen Einsatz passen: Unterricht begleiten, eine Veranstaltung moderieren oder schnell ein einzelnes Format starten. In der Live-Ansicht sollen der nächste Schritt und wichtige Rückmeldungen im Vordergrund stehen. Weitere Einstellungen und Werkzeuge bleiben bei Bedarf erreichbar.

So soll der Weg zum Start kürzer werden und die Steuerung während einer Veranstaltung mehr Überblick bieten. Wo musst du heute suchen oder zu viele Entscheidungen treffen? Schreib uns bitte per E-Mail; die Kontaktadresse findest du im [Impressum](https://arsnova.eu/de/legal/imprint/). Besonders hilfreich sind konkrete Situationen aus deinem Einsatz.$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES (
  gen_random_uuid()::text,
  'c0999999-c999-4c99-8c99-c09999999999',
  'en',
  $mden$### A simpler way to run quizzes, Q&A and live polls

We want to make arsnova.eu easier to use for teachers and event hosts. A short choice on the home page will help you start with what you need today: support a class, moderate an event or launch a single activity quickly. During a live session, the next step and the information that matters most should be easy to spot. More settings and tools will still be available when you need them.

Our aim is to make getting started quicker and live sessions easier to manage. Where do you currently have to hunt for a control or make too many choices? Please email us using the contact address in the [legal notice](https://arsnova.eu/en/legal/imprint/). Specific examples from your sessions are especially helpful.$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES (
  gen_random_uuid()::text,
  'c0999999-c999-4c99-8c99-c09999999999',
  'fr',
  $mdfr$### Animer plus facilement des quiz, des questions-réponses et des sondages rapides

Nous voulons rendre arsnova.eu plus simple à utiliser pour les enseignants et les personnes qui animent des événements. Sur la page d’accueil, un choix rapide vous aidera à partir de votre besoin du moment : accompagner un cours, animer un événement ou lancer rapidement une seule activité. Pendant une session, la prochaine action et les informations essentielles seront mises en avant. Les autres réglages et outils resteront accessibles au besoin.

Notre objectif est de vous permettre de démarrer plus vite et de mieux garder le fil pendant l’animation. Quelles commandes avez-vous du mal à trouver aujourd’hui ? Où devez-vous faire trop de choix ? Écrivez-nous par courriel à l’adresse indiquée dans les [mentions légales](https://arsnova.eu/fr/legal/imprint/). Les exemples concrets tirés de vos sessions nous aideront particulièrement.$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES (
  gen_random_uuid()::text,
  'c0999999-c999-4c99-8c99-c09999999999',
  'es',
  $mdes$### Más fácil dirigir cuestionarios, preguntas y sondeos rápidos

Queremos que arsnova.eu sea más fácil de usar para docentes y quienes moderan eventos. En la página de inicio, una selección breve te ayudará a empezar según lo que necesites en ese momento: dar clase, moderar un evento o iniciar rápidamente una sola actividad. Durante la sesión, destacaremos el siguiente paso y la información más útil. Las demás opciones y herramientas seguirán disponibles cuando las necesites.

Queremos que empezar lleve menos tiempo y que sea más fácil mantener el control durante la sesión. ¿Qué función te cuesta encontrar ahora? ¿Dónde tienes que tomar demasiadas decisiones? Escríbenos por correo electrónico a la dirección que figura en el [aviso legal](https://arsnova.eu/es/legal/imprint/). Nos ayudan especialmente los ejemplos concretos de tus sesiones.$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES (
  gen_random_uuid()::text,
  'c0999999-c999-4c99-8c99-c09999999999',
  'it',
  $mdit$### Più semplice gestire quiz, domande e sondaggi rapidi

Vogliamo rendere arsnova.eu più facile da usare per chi insegna e per chi modera un evento. Nella pagina iniziale, una breve scelta ti aiuterà a partire da ciò che ti serve in quel momento: gestire una lezione, moderare un evento o avviare rapidamente una sola attività. Durante la sessione, il passo successivo e le informazioni più utili saranno in primo piano. Le altre impostazioni e gli strumenti resteranno disponibili quando servono.

Il nostro obiettivo è farti iniziare più rapidamente e aiutarti a mantenere il quadro della situazione durante la sessione. Quali comandi fai fatica a trovare oggi? Dove devi prendere troppe decisioni? Scrivici via email all’indirizzo indicato nelle [note legali](https://arsnova.eu/it/legal/imprint/). Gli esempi concreti tratti dalle tue sessioni ci saranno particolarmente utili.$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
