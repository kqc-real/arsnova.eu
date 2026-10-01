-- Issue #483 Review: Größenklassen in DailyUsageStatistic statt ORDER BY random()-Stichprobe

ALTER TABLE "DailyUsageStatistic"
  ADD COLUMN IF NOT EXISTS "sizeClassXs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sizeClassS" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sizeClassM" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sizeClassL" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sizeClassXl" INTEGER NOT NULL DEFAULT 0;

-- Bestehende Projektionen in Tagesaggregate nachziehen (Kohorte = firstUsedUtcDate).
WITH classified AS (
  SELECT
    "firstUsedUtcDate" AS "date",
    CASE
      WHEN "participationCount" BETWEEN 1 AND 10 THEN 'XS'
      WHEN "participationCount" BETWEEN 11 AND 30 THEN 'S'
      WHEN "participationCount" BETWEEN 31 AND 100 THEN 'M'
      WHEN "participationCount" BETWEEN 101 AND 300 THEN 'L'
      ELSE 'XL'
    END AS "cls"
  FROM "SessionUsageProjection"
  WHERE "participationCount" > 0
    AND "firstUsedUtcDate" IS NOT NULL
),
agg AS (
  SELECT
    "date",
    COUNT(*) FILTER (WHERE "cls" = 'XS')::integer AS "sizeClassXs",
    COUNT(*) FILTER (WHERE "cls" = 'S')::integer AS "sizeClassS",
    COUNT(*) FILTER (WHERE "cls" = 'M')::integer AS "sizeClassM",
    COUNT(*) FILTER (WHERE "cls" = 'L')::integer AS "sizeClassL",
    COUNT(*) FILTER (WHERE "cls" = 'XL')::integer AS "sizeClassXl"
  FROM classified
  GROUP BY "date"
)
INSERT INTO "DailyUsageStatistic" (
  "id",
  "date",
  "sizeClassXs",
  "sizeClassS",
  "sizeClassM",
  "sizeClassL",
  "sizeClassXl",
  "updatedAt"
)
SELECT
  md5('usage-size-backfill:' || "date"::text),
  "date",
  "sizeClassXs",
  "sizeClassS",
  "sizeClassM",
  "sizeClassL",
  "sizeClassXl",
  NOW()
FROM agg
ON CONFLICT ("date") DO UPDATE
SET
  "sizeClassXs" = EXCLUDED."sizeClassXs",
  "sizeClassS" = EXCLUDED."sizeClassS",
  "sizeClassM" = EXCLUDED."sizeClassM",
  "sizeClassL" = EXCLUDED."sizeClassL",
  "sizeClassXl" = EXCLUDED."sizeClassXl",
  "updatedAt" = NOW();
