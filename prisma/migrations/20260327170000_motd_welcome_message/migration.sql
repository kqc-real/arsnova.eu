-- Dauerhafte Willkommens-MOTD (feste ID, niedrige Priorität: Admin-MOTDs mit priority >= 0 gehen vor).
-- Inhalt synchron halten mit scripts/seed-dev-motd.mjs

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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'PUBLISHED',
  -100,
  '2026-03-24 00:00:00'::timestamp(3),
  -- Mittag UTC: Ende 2099-12-31 23:59 UTC würde in MEZ als 01.01.2100 erscheinen
  '2099-12-31 12:00:00'::timestamp(3),
  true,
  3,
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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'de',
  $motd_de$# Willkommen bei arsnova.eu

Schön, dass du da bist! arsnova.eu ist zurück – im neuen Design, mit starken Features und der Zuverlässigkeit, die du von einem erstklassigen Audience-Response-System erwartest.

Wir vereinen das Beste aus frag.jetzt und arsnova.click: Eine moderne, datenschutzkonforme Alternative zu Kahoot oder Mentimeter für interaktive Sessions, Quizze und mehr – barrierearm, mehrsprachig und Made in Germany.

Viel Spaß beim Entdecken – bereit für deine nächste Session?$motd_de$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'en',
  $motd_en$# Welcome to arsnova.eu

Great to have you here! arsnova.eu is back – with a fresh look, powerful features, and the reliability you expect from a top-tier audience response system.

We've merged frag.jetzt and arsnova.click into a seamless, privacy-first alternative to Kahoot or Mentimeter. It's your modern platform for interactive sessions and quizzes – fully accessible, multilingual, and secure by design.

Enjoy exploring – and here's to your next session!$motd_en$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'fr',
  $motd_fr$# Bienvenue sur arsnova.eu

Ravi de vous accueillir ! arsnova.eu fait peau neuve : un design moderne, des fonctionnalités inédites et la fiabilité d'un système d'interaction d'excellence.

Le meilleur de frag.jetzt et arsnova.click réuni : une alternative sérieuse à Kahoot ou Mentimeter pour vos sessions interactives et quiz – accessible, multilingue et strictement respectueuse de la protection des données (RGPD).

Bonne découverte – prêt pour votre prochaine session ?$motd_fr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'es',
  $motd_es$# Bienvenido a arsnova.eu

¡Qué bueno tenerte por aquí! arsnova.eu ha vuelto con un diseño renovado, funciones avanzadas y la fiabilidad de un sistema de participación de audiencia de primer nivel.

Lo mejor de frag.jetzt y arsnova.click en una sola plataforma: la alternativa a Kahoot o Mentimeter que prioriza la privacidad. Crea sesiones interactivas y cuestionarios de forma accesible, multilingüe y segura.

¡Diviértete descubriendo las novedades y disfruta de tu próxima sesión!$motd_es$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'it',
  $motd_it$# Benvenuti su arsnova.eu

È un piacere averti qui! arsnova.eu è tornato: con una veste grafica rinnovata, nuove potenti funzioni e l'affidabilità di un sistema di Audience Response professionale.

Abbiamo unito il meglio di frag.jetzt e arsnova.click in un'unica piattaforma moderna. L'alternativa a Kahoot o Mentimeter focalizzata sulla privacy: per sessioni interattive e quiz – inclusiva, multilingue e sicura.

Buon divertimento nell'esplorare le novità – pronti per la tua prossima sessione?$motd_it$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
