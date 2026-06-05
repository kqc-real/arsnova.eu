-- Aktuelle Feature-MOTD: Tempo-Feedback.
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
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'PUBLISHED',
  20,
  '2026-06-04 00:00:00'::timestamp(3),
  '2026-09-30 23:59:59.999'::timestamp(3),
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
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'de',
  $mdde$# Tempo-Feedback ist da

**🚀 schneller · 🙂 passt · 🐢 langsamer · 😕 verloren**

Mit vier Icons zeigt deine Gruppe live, ob sie folgen kann. Starte es im Blitzlicht und passe dein Vortragstempo sofort an.

**Ausprobieren**$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'en',
  $mden$# Pace feedback is here

**🚀 faster · 🙂 just right · 🐢 slower · 😕 lost**

Four icons let your group show live whether they can keep up. Start it in quick feedback and adjust your pace instantly.

**Try it**$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'fr',
  $mdfr$# Le retour sur le rythme est là

**🚀 plus vite · 🙂 ça va · 🐢 plus lentement · 😕 perdu**

Avec quatre icônes, ton groupe montre en direct s'il suit encore. Lance-le dans le feedback éclair et ajuste ton rythme tout de suite.

**Essayer**$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'es',
  $mdes$# Ya está aquí el feedback de ritmo

**🚀 más rápido · 🙂 va bien · 🐢 más despacio · 😕 perdido**

Con cuatro iconos, tu grupo muestra en directo si puede seguirte. Actívalo en el feedback rápido y ajusta el ritmo al momento.

**Probar**$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'it',
  $mdit$# Arriva il feedback sul ritmo

**🚀 più veloce · 🙂 va bene · 🐢 più piano · 😕 perso**

Con quattro icone, il tuo gruppo mostra in diretta se riesce a seguirti. Avvialo nel feedback rapido e regola subito il ritmo.

**Provalo**$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
