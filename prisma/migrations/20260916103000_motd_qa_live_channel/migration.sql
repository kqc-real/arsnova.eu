-- Feature-MOTD: Q&A zum Vorabeinholen von Fragen (Epic #405).
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
  'c0888888-c888-4c88-8c88-c08888888888',
  'PUBLISHED',
  110,
  '2026-09-16 00:00:00'::timestamp(3),
  '2027-03-31 23:59:59.999'::timestamp(3),
  true,
  2,
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
  'c0888888-c888-4c88-8c88-c08888888888',
  'de',
  $mdde$### 🧩 Fragen vorher einholen – vorbereitet starten.

Mit »Q&A erstellen« legst du schon vor der Veranstaltung eine Fragenwand an und teilst den Code. Teilnehmende schreiben in Ruhe; du siehst, was unklar ist, sortierst und wertest aus – und gehst vorbereitet in die Sitzung.

**Hol dir jetzt die Fragen für deine nächste Stunde oder deinen nächsten Termin.**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0888888-c888-4c88-8c88-c08888888888',
  'en',
  $mden$### 🧩 Gather questions beforehand – then walk in prepared.

Use “Create Q&A” to open a question wall and share the code before the event. People can send questions in their own time; you see what’s unclear, sort and review – and you arrive ready.

**Collect the questions for your next class or event now.**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0888888-c888-4c88-8c88-c08888888888',
  'fr',
  $mdfr$### 🧩 Recueille les questions avant – arrive préparé.

Avec « Créer un Q&A », tu ouvres un mur de questions et tu partages le code avant l’événement. Chacun écrit à son rythme ; tu vois ce qui bloque, tu tries et tu fais le point – et tu prépares ta séance sur cette base.

**Récupère dès maintenant les questions de ton prochain cours ou rendez-vous.**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0888888-c888-4c88-8c88-c08888888888',
  'it',
  $mdit$### 🧩 Raccogli le domande prima – e arriva preparato.

Con «Crea un Q&A» apri un muro delle domande e condividi il codice già prima dell’incontro. Chi partecipa scrive con calma; tu vedi i dubbi, li ordini e li usi per prepararti.

**Raccogli adesso le domande per la tua prossima lezione o il tuo prossimo appuntamento.**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0888888-c888-4c88-8c88-c08888888888',
  'es',
  $mdes$### 🧩 Recoge las preguntas antes – y llega con la sesión pensada.

Con «Crear un Q&A» abres un muro de preguntas y compartes el código antes del encuentro. Quien participa escribe con calma; tú ves qué no está claro, ordenas y evalúas – y llegas preparado.

**Recoge ya las preguntas de tu próxima clase o de tu próximo evento.**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
