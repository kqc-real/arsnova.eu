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

-- Votes from the preceding preview revision still refer to visible texts. Translate them only
-- after the question elements have stable IDs so historical result matrices keep their joins.
UPDATE "Vote" AS vote
SET "matchingSelections" = (
  SELECT jsonb_agg(
    CASE
      WHEN mapped.pair IS NULL THEN selection
      ELSE (selection - 'left' - 'right') || jsonb_build_object(
        'leftId', mapped.pair ->> 'leftId',
        'rightId', mapped.pair ->> 'rightId'
      )
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(vote."matchingSelections")
    WITH ORDINALITY AS entries(selection, ordinality)
  LEFT JOIN LATERAL (
    SELECT pair
    FROM "Question" AS question
    CROSS JOIN LATERAL jsonb_array_elements(question."matchingPairs") AS pairs(pair)
    WHERE question.id = vote."questionId"
      AND pair ->> 'left' = selection ->> 'left'
      AND pair ->> 'right' = selection ->> 'right'
    LIMIT 1
  ) AS mapped ON true
)
WHERE jsonb_typeof(vote."matchingSelections") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(vote."matchingSelections") AS existing(selection)
    WHERE NULLIF(selection ->> 'leftId', '') IS NULL
      AND NULLIF(selection ->> 'left', '') IS NOT NULL
      AND NULLIF(selection ->> 'right', '') IS NOT NULL
  );

UPDATE "Vote" AS vote
SET "categorizationSelections" = (
  SELECT jsonb_agg(
    CASE
      WHEN mapped.item IS NULL THEN selection
      ELSE (selection - 'text') || jsonb_build_object('itemId', mapped.item ->> 'id')
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(vote."categorizationSelections")
    WITH ORDINALITY AS entries(selection, ordinality)
  LEFT JOIN LATERAL (
    SELECT item
    FROM "Question" AS question
    CROSS JOIN LATERAL jsonb_array_elements(question."categorizationItems") AS items(item)
    WHERE question.id = vote."questionId"
      AND item ->> 'text' = selection ->> 'text'
    LIMIT 1
  ) AS mapped ON true
)
WHERE jsonb_typeof(vote."categorizationSelections") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(vote."categorizationSelections") AS existing(selection)
    WHERE NULLIF(selection ->> 'itemId', '') IS NULL
      AND NULLIF(selection ->> 'text', '') IS NOT NULL
  );
