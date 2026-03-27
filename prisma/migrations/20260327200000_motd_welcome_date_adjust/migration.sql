-- Willkommens-MOTD: Start 24.03.2026; endsAt mittags UTC (vermeidet Anzeige 01.01.2100 in MEZ)
UPDATE "Motd"
SET
  "startsAt" = '2026-03-24 00:00:00'::timestamp(3),
  "endsAt" = '2099-12-31 12:00:00'::timestamp(3),
  "updatedAt" = NOW()
WHERE "id" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
