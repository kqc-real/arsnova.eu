-- Stories 1.2g / 1.2j: author-controlled participant shuffling.
-- Stable element IDs live inside the existing JSONB documents and need no columns.

ALTER TABLE "Question"
ADD COLUMN IF NOT EXISTS "matchingShuffleRight" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "categorizationShuffleItems" BOOLEAN NOT NULL DEFAULT true;

-- Preview environments may already contain questions created by the preceding PR revision.
-- Give those JSON elements opaque IDs so editor, participant DTO and vote validation continue
-- to refer to the same logical elements without leaking the canonical solution through ID patterns.
UPDATE "Question" AS question
SET "matchingPairs" = (
  SELECT jsonb_agg(
    pair || jsonb_build_object(
      'leftId', COALESCE(NULLIF(pair ->> 'leftId', ''), gen_random_uuid()::text),
      'rightId', COALESCE(NULLIF(pair ->> 'rightId', ''), gen_random_uuid()::text)
    )
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(question."matchingPairs") WITH ORDINALITY AS entries(pair, ordinality)
)
WHERE jsonb_typeof(question."matchingPairs") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(question."matchingPairs") AS existing(pair)
    WHERE NULLIF(pair ->> 'leftId', '') IS NULL OR NULLIF(pair ->> 'rightId', '') IS NULL
  );

UPDATE "Question" AS question
SET "categorizationItems" = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'id', COALESCE(NULLIF(item ->> 'id', ''), gen_random_uuid()::text)
    )
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(question."categorizationItems") WITH ORDINALITY AS entries(item, ordinality)
)
WHERE jsonb_typeof(question."categorizationItems") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(question."categorizationItems") AS existing(item)
    WHERE NULLIF(item ->> 'id', '') IS NULL
  );
