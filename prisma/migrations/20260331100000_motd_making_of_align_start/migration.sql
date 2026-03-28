-- Making-of-MOTD: startsAt wie Willkommen (2026-03-24), damit sie nicht erst vier Tage später aktiv wird.
UPDATE "Motd"
SET "startsAt" = '2026-03-24 00:00:00'::timestamp(3), "updatedAt" = NOW()
WHERE "id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
