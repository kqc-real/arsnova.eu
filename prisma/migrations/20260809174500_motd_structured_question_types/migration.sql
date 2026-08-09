-- Feature-MOTD: Matching, Ordering und Categorization.
-- Feste ID; idempotent für lokale Seeds und produktive Migrationen.

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
  'c0444444-c444-4c44-8c44-c04444444444',
  'PUBLISHED',
  70,
  '2026-08-09 00:00:00'::timestamp(3),
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
  'c0444444-c444-4c44-8c44-c04444444444',
  'de',
  $mdde$### 🧩 Neu: Zuordnen. Sortieren. Kategorisieren.

Drei neue Fragetypen sind da! Lass deine Teilnehmenden Begriffe verbinden, Abläufe in die richtige Reihenfolge bringen und Inhalte sinnvoll einordnen. So wird aus einer Wissensabfrage aktives Denken – direkt im Live-Quiz.

**Erstelle eine Frage und probiere es jetzt aus!**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0444444-c444-4c44-8c44-c04444444444',
  'en',
  $mden$### 🧩 New: Match. Order. Categorize.

Three new question types are here! Invite participants to match concepts, put steps in the right order, and sort content into categories. Turn a simple knowledge check into active thinking – right inside your live quiz.

**Create a question and try it now!**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0444444-c444-4c44-8c44-c04444444444',
  'fr',
  $mdfr$### 🧩 Nouveau : associer, ordonner, classer.

Trois nouveaux types de questions sont disponibles ! Propose à ton public d’associer des notions, de remettre des étapes dans le bon ordre et de classer des éléments par catégorie. Transforme une simple vérification des connaissances en véritable activité de réflexion – directement dans ton quiz en direct.

**Crée une question et essaie-les dès maintenant !**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0444444-c444-4c44-8c44-c04444444444',
  'it',
  $mdit$### 🧩 Novità: abbina, ordina, classifica.

Sono arrivati tre nuovi tipi di domanda! Invita chi partecipa ad abbinare concetti, mettere in ordine le diverse fasi e classificare i contenuti. Trasforma una semplice verifica delle conoscenze in un’attività che fa ragionare – direttamente nel tuo quiz live.

**Crea una domanda e provali subito!**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0444444-c444-4c44-8c44-c04444444444',
  'es',
  $mdes$### 🧩 Novedad: relaciona, ordena y clasifica.

¡Ya están aquí tres nuevos tipos de pregunta! Haz que tus participantes relacionen conceptos, pongan los pasos en el orden correcto y clasifiquen contenidos por categorías. Convierte una simple comprobación de conocimientos en una actividad que invite a pensar – directamente en tu quiz en directo.

**¡Crea una pregunta y pruébalos ahora!**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
