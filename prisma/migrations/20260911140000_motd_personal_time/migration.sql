-- Feature-MOTD: Persönliche Zeit / Timer-Nachteilsausgleich.
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
  'c0777777-c777-4c77-8c77-c07777777777',
  'PUBLISHED',
  100,
  '2026-09-11 00:00:00'::timestamp(3),
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
  'c0777777-c777-4c77-8c77-c07777777777',
  'de',
  $mdde$### Tempo darf keine Barriere sein.

Mit »Persönliche Zeit« erhalten Teilnehmende die zusätzliche Antwortzeit, die sie brauchen – etwa bei Legasthenie, Dyskalkulie, Sehbeeinträchtigungen oder der Nutzung eines Screenreaders. Nach dem Countdown gelten Mindestpunkte, damit der Wettbewerb fair bleibt. Du kannst die Option im Quiz-Editor deaktivieren – lass sie möglichst aktiviert, damit alle fair teilnehmen können.$mdde$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0777777-c777-4c77-8c77-c07777777777',
  'en',
  $mden$### Time should never be a barrier.

With “Personal time”, participants get the additional response time they need – for example, if they have dyslexia, dyscalculia or a visual impairment, or use a screen reader. Minimum points apply after the countdown, keeping the competition fair. You can turn the option off in the quiz editor – keep it enabled wherever possible so everyone can take part fairly.$mden$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0777777-c777-4c77-8c77-c07777777777',
  'fr',
  $mdfr$### Le temps ne doit pas être un obstacle.

Avec « Temps personnalisé », les participants bénéficient du temps de réponse supplémentaire dont ils ont besoin – par exemple en cas de dyslexie, de dyscalculie ou de déficience visuelle, ou lors de l’utilisation d’un lecteur d’écran. Une fois le compte à rebours terminé, seul le minimum de points est accordé afin que la compétition reste équitable. Vous pouvez désactiver l’option dans l’éditeur du quiz – dans la mesure du possible, laissez-la activée afin que tout le monde puisse participer dans des conditions équitables.$mdfr$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0777777-c777-4c77-8c77-c07777777777',
  'it',
  $mdit$### Il tempo non deve essere una barriera.

Con «Tempo personalizzato», i partecipanti hanno a disposizione il tempo di risposta aggiuntivo di cui hanno bisogno – ad esempio in caso di dislessia, discalculia o disabilità visiva, oppure quando utilizzano uno screen reader. Dopo il conto alla rovescia viene assegnato solo il punteggio minimo, così la competizione rimane equa. Puoi disattivare l’opzione nell’editor del quiz – quando possibile, lasciala attiva affinché tutte le persone possano partecipare in condizioni eque.$mdit$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";

INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown")
VALUES (
  gen_random_uuid()::text,
  'c0777777-c777-4c77-8c77-c07777777777',
  'es',
  $mdes$### El tiempo no debe ser una barrera.

Con «Tiempo personalizado», los participantes disponen del tiempo adicional que necesitan para responder – por ejemplo, en casos de dislexia, discalculia o discapacidad visual, o cuando utilizan un lector de pantalla. Después de la cuenta atrás solo se otorga la puntuación mínima, para que la competición siga siendo justa. Puedes desactivar la opción en el editor del cuestionario – siempre que sea posible, mantenla activada para que todas las personas puedan participar en condiciones equitativas.$mdes$
)
ON CONFLICT ("motdId", "locale") DO UPDATE SET "markdown" = EXCLUDED."markdown";
