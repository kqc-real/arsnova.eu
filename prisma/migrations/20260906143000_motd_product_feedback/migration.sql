-- Feature-MOTD: Anonymes Produktfeedback nach Epic 12.
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
  'c0666666-c666-4c66-8c66-c06666666666',
  'PUBLISHED',
  90,
  '2026-09-06 00:00:00'::timestamp(3),
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
  'c0666666-c666-4c66-8c66-c06666666666',
  'de',
  $mdde$### 💬 Was läuft gut – und was noch nicht?

**Wir prüfen und bearbeiten jede anonyme Rückmeldung innerhalb weniger Tage.** Schwerwiegende Probleme haben Vorrang. Bei Verbesserungswünschen berücksichtigen wir, wie viele Menschen dasselbe Anliegen haben.

Nach einer Session fragen wir dich gelegentlich, wie einfach oder hilfreich arsnova.eu für dich war. Danach gibst du an, was besonders gut lief oder wo es Schwierigkeiten gab. Dafür brauchst du nur zwei Klicks.

Über **„arsnova.eu verbessern“** kannst du uns außerdem jederzeit anonym und ohne Konto oder E-Mail schreiben. Ein eigener Text ist freiwillig.$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0666666-c666-4c66-8c66-c06666666666',
  'en',
  $mden$### 💬 What works well – and what doesn’t?

**We review every anonymous submission within a few days.** Serious problems come first. For improvements, we also consider how many people are asking for the same thing.

After a session, we may ask how easy or helpful arsnova.eu was for you. You then tell us what worked particularly well or where you had difficulties. It only takes two clicks.

You can also use **“Improve arsnova.eu”** at any time, anonymously and without an account or email address. Adding a comment is optional.$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0666666-c666-4c66-8c66-c06666666666',
  'fr',
  $mdfr$### 💬 Ce qui fonctionne bien – ou moins bien

**Nous examinons chaque retour anonyme sous quelques jours.** Les problèmes graves sont prioritaires. Pour les améliorations, nous tenons également compte du nombre de personnes qui expriment le même besoin.

Après une session, nous te demandons parfois si arsnova.eu a été simple ou utile pour toi. Tu indiques ensuite ce qui a particulièrement bien fonctionné ou ce qui t’a posé problème. Deux clics suffisent.

Avec **« Améliorer arsnova.eu »**, tu peux aussi nous écrire à tout moment, de manière anonyme et sans compte ni e-mail. Ajouter un commentaire est facultatif.$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0666666-c666-4c66-8c66-c06666666666',
  'es',
  $mdes$### 💬 ¿Qué funciona bien y qué podemos mejorar?

**Revisamos cada comentario anónimo en un plazo de pocos días.** Los problemas graves tienen prioridad. Para las mejoras, también tenemos en cuenta cuántas personas piden lo mismo.

Después de una sesión, puede que te preguntemos si arsnova.eu te ha resultado fácil o útil. A continuación, nos indicas qué ha funcionado especialmente bien o dónde has tenido dificultades. Solo hacen falta dos clics.

Con **«Mejorar arsnova.eu»** también puedes escribirnos en cualquier momento, de forma anónima y sin cuenta ni correo electrónico. Añadir un comentario es opcional.$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0666666-c666-4c66-8c66-c06666666666',
  'it',
  $mdit$### 💬 Cosa funziona bene e cosa possiamo migliorare?

**Esaminiamo ogni feedback anonimo entro pochi giorni.** I problemi gravi hanno la precedenza. Per i miglioramenti teniamo conto anche di quante persone chiedono la stessa cosa.

Dopo una sessione potremmo chiederti quanto sia stato semplice o utile usare arsnova.eu. Subito dopo ci indichi cosa ha funzionato particolarmente bene o dove hai incontrato difficoltà. Bastano due clic.

Con **«Migliora arsnova.eu»** puoi inoltre scriverci in qualsiasi momento, in forma anonima e senza account né e-mail. Aggiungere un commento è facoltativo.$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
