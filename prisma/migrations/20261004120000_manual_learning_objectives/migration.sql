-- Issue #456 Slice 4: local-first quiz learning objectives and session-authoritative copies.
-- Existing quizzes/sessions remain explicitly unconfigured; no objective text is inferred/backfilled.

CREATE TYPE "LearningObjectiveScope" AS ENUM ('SESSION', 'QUIZ', 'TASKS');
CREATE TYPE "LearningObjectiveOrigin" AS ENUM ('MANUAL', 'MODEL_DERIVED');
CREATE TYPE "LearningObjectiveConfirmationState" AS ENUM ('DRAFT', 'CONFIRMED', 'NEEDS_REVIEW');
CREATE TYPE "LearningObjectivePreviousConfirmationState" AS ENUM ('DRAFT', 'CONFIRMED');
CREATE TYPE "LearningObjectiveNeedsReviewReason" AS ENUM (
  'SOURCE_CONTENT_CHANGED',
  'SOURCE_REFERENCE_REMOVED',
  'DERIVATION_REPLACED'
);
CREATE TYPE "LearningObjectiveProjection" AS ENUM (
  'QUIZ_PROJECTED',
  'SESSION_MANUAL',
  'SESSION_OVERRIDE'
);
CREATE TYPE "LearningObjectiveReferenceKind" AS ENUM ('TASK', 'DERIVATION');
CREATE TYPE "LearningObjectiveReferenceSource" AS ENUM ('QUIZ_QUESTION', 'QA_QUESTION');
CREATE TYPE "LearningObjectiveUnresolvedReason" AS ENUM ('SOURCE_REMOVED', 'SOURCE_NOT_IN_UPLOAD');

ALTER TABLE "Question"
  ADD COLUMN "sourceQuestionId" UUID;

ALTER TABLE "Quiz"
  ADD COLUMN "sourceQuizId" UUID;

CREATE UNIQUE INDEX "Question_quizId_sourceQuestionId_key"
  ON "Question"("quizId", "sourceQuestionId");
CREATE INDEX "Quiz_sourceQuizId_createdAt_id_idx"
  ON "Quiz"("sourceQuizId", "createdAt", "id");

ALTER TABLE "Session"
  ADD COLUMN "learningContextRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "learningContextConfigured" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT "Session_learningContextRevision_check"
    CHECK ("learningContextRevision" BETWEEN 0 AND 2147483647);

CREATE TABLE "QuizLearningObjectiveBundle" (
  "quizId" TEXT NOT NULL,
  "sourceQuizId" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizLearningObjectiveBundle_pkey" PRIMARY KEY ("quizId"),
  CONSTRAINT "QuizLearningObjectiveBundle_schemaVersion_check" CHECK ("schemaVersion" = 1),
  CONSTRAINT "QuizLearningObjectiveBundle_revision_check"
    CHECK ("revision" BETWEEN 0 AND 2147483647)
);

CREATE TABLE "QuizLearningObjective" (
  "id" TEXT NOT NULL,
  "bundleQuizId" TEXT NOT NULL,
  "objectiveId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "text" VARCHAR(500) NOT NULL,
  "scope" "LearningObjectiveScope" NOT NULL,
  "origin" "LearningObjectiveOrigin" NOT NULL,
  "modelId" VARCHAR(120),
  "modelVersion" VARCHAR(120),
  "derivationVersion" VARCHAR(120),
  "sourceDigest" CHAR(64),
  "confirmationState" "LearningObjectiveConfirmationState" NOT NULL,
  "confirmationRevision" INTEGER,
  "confirmationAt" TIMESTAMP(3),
  "previousConfirmationState" "LearningObjectivePreviousConfirmationState",
  "needsReviewReason" "LearningObjectiveNeedsReviewReason",
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuizLearningObjective_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuizLearningObjective_revision_check"
    CHECK ("revision" BETWEEN 0 AND 2147483647),
  CONSTRAINT "QuizLearningObjective_timestamp_check" CHECK ("updatedAt" >= "createdAt"),
  CONSTRAINT "QuizLearningObjective_scope_check" CHECK ("scope" IN ('QUIZ', 'TASKS')),
  CONSTRAINT "QuizLearningObjective_origin_check" CHECK (
    ("origin" = 'MANUAL'
      AND "modelId" IS NULL
      AND "modelVersion" IS NULL
      AND "derivationVersion" IS NULL
      AND "sourceDigest" IS NULL)
    OR
    ("origin" = 'MODEL_DERIVED'
      AND "modelId" IS NOT NULL
      AND "modelVersion" IS NOT NULL
      AND "derivationVersion" IS NOT NULL
      AND "sourceDigest" ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "QuizLearningObjective_confirmation_check" CHECK (
    ("confirmationState" = 'DRAFT'
      AND "confirmationRevision" IS NULL
      AND "confirmationAt" IS NULL
      AND "previousConfirmationState" IS NULL
      AND "needsReviewReason" IS NULL)
    OR
    ("confirmationState" = 'CONFIRMED'
      AND "confirmationRevision" = "revision"
      AND "confirmationAt" IS NOT NULL
      AND "previousConfirmationState" IS NULL
      AND "needsReviewReason" IS NULL)
    OR
    ("confirmationState" = 'NEEDS_REVIEW'
      AND "confirmationRevision" BETWEEN 0 AND 2147483647
      AND "confirmationRevision" < "revision"
      AND "previousConfirmationState" IS NOT NULL
      AND "needsReviewReason" IS NOT NULL
      AND (("previousConfirmationState" = 'DRAFT' AND "confirmationAt" IS NULL)
        OR ("previousConfirmationState" = 'CONFIRMED' AND "confirmationAt" IS NOT NULL)))
  )
);

CREATE TABLE "QuizLearningObjectiveReference" (
  "id" TEXT NOT NULL,
  "objectiveRowId" TEXT NOT NULL,
  "kind" "LearningObjectiveReferenceKind" NOT NULL,
  "questionId" TEXT NOT NULL,
  CONSTRAINT "QuizLearningObjectiveReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionLearningObjective" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "objectiveId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "text" VARCHAR(500) NOT NULL,
  "scope" "LearningObjectiveScope" NOT NULL,
  "origin" "LearningObjectiveOrigin" NOT NULL,
  "modelId" VARCHAR(120),
  "modelVersion" VARCHAR(120),
  "derivationVersion" VARCHAR(120),
  "confirmationState" "LearningObjectiveConfirmationState" NOT NULL,
  "confirmationRevision" INTEGER,
  "confirmationAt" TIMESTAMP(3),
  "previousConfirmationState" "LearningObjectivePreviousConfirmationState",
  "needsReviewReason" "LearningObjectiveNeedsReviewReason",
  "projection" "LearningObjectiveProjection" NOT NULL,
  "sourceQuizId" UUID,
  "suppressedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionLearningObjective_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionLearningObjective_revision_check"
    CHECK ("revision" BETWEEN 0 AND 2147483647),
  CONSTRAINT "SessionLearningObjective_timestamp_check" CHECK ("updatedAt" >= "createdAt"),
  CONSTRAINT "SessionLearningObjective_origin_check" CHECK (
    ("origin" = 'MANUAL'
      AND "modelId" IS NULL
      AND "modelVersion" IS NULL
      AND "derivationVersion" IS NULL)
    OR
    ("origin" = 'MODEL_DERIVED'
      AND "modelId" IS NOT NULL
      AND "modelVersion" IS NOT NULL
      AND "derivationVersion" IS NOT NULL)
  ),
  CONSTRAINT "SessionLearningObjective_projection_check" CHECK (
    ("projection" = 'SESSION_MANUAL' AND "origin" = 'MANUAL')
    OR
    ("projection" = 'QUIZ_PROJECTED' AND "scope" IN ('QUIZ', 'TASKS'))
    OR
    "projection" = 'SESSION_OVERRIDE'
  ),
  CONSTRAINT "SessionLearningObjective_suppression_check" CHECK (
    "suppressedAt" IS NULL
    OR ("projection" = 'SESSION_OVERRIDE' AND "sourceQuizId" IS NOT NULL)
  ),
  CONSTRAINT "SessionLearningObjective_confirmation_check" CHECK (
    ("confirmationState" = 'DRAFT'
      AND "confirmationRevision" IS NULL
      AND "confirmationAt" IS NULL
      AND "previousConfirmationState" IS NULL
      AND "needsReviewReason" IS NULL)
    OR
    ("confirmationState" = 'CONFIRMED'
      AND "confirmationRevision" = "revision"
      AND "confirmationAt" IS NOT NULL
      AND "previousConfirmationState" IS NULL
      AND "needsReviewReason" IS NULL)
    OR
    ("confirmationState" = 'NEEDS_REVIEW'
      AND "confirmationRevision" BETWEEN 0 AND 2147483647
      AND "confirmationRevision" < "revision"
      AND "previousConfirmationState" IS NOT NULL
      AND "needsReviewReason" IS NOT NULL
      AND (("previousConfirmationState" = 'DRAFT' AND "confirmationAt" IS NULL)
        OR ("previousConfirmationState" = 'CONFIRMED' AND "confirmationAt" IS NOT NULL)))
  )
);

CREATE TABLE "SessionLearningObjectiveReference" (
  "id" TEXT NOT NULL,
  "sourceReferenceId" UUID NOT NULL,
  "objectiveRowId" TEXT NOT NULL,
  "kind" "LearningObjectiveReferenceKind" NOT NULL,
  "sourceKind" "LearningObjectiveReferenceSource" NOT NULL,
  "quizQuestionId" TEXT,
  "qaQuestionId" TEXT,
  "unresolvedReason" "LearningObjectiveUnresolvedReason",
  CONSTRAINT "SessionLearningObjectiveReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionLearningObjectiveReference_target_check" CHECK (
    ("sourceKind" = 'QUIZ_QUESTION'
      AND (("quizQuestionId" IS NOT NULL AND "qaQuestionId" IS NULL AND "unresolvedReason" IS NULL)
        OR ("quizQuestionId" IS NULL AND "qaQuestionId" IS NULL AND "unresolvedReason" IS NOT NULL)))
    OR
    ("sourceKind" = 'QA_QUESTION'
      AND (("qaQuestionId" IS NOT NULL AND "quizQuestionId" IS NULL AND "unresolvedReason" IS NULL)
        OR ("qaQuestionId" IS NULL AND "quizQuestionId" IS NULL
          AND "unresolvedReason" = 'SOURCE_REMOVED')))
  ),
  CONSTRAINT "SessionLearningObjectiveReference_derivation_check" CHECK (
    "kind" = 'TASK'
    OR "sourceKind" = 'QUIZ_QUESTION'
  )
);

CREATE TABLE "SessionQuizAttachReplay" (
  "sessionId" TEXT NOT NULL,
  "operationId" UUID NOT NULL,
  "quizId" TEXT NOT NULL,
  "adoptQuizTeams" BOOLEAN NOT NULL,
  "expectedLearningContextRevision" INTEGER NOT NULL,
  "resultLearningContextRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionQuizAttachReplay_pkey" PRIMARY KEY ("sessionId"),
  CONSTRAINT "SessionQuizAttachReplay_revision_check" CHECK (
    "expectedLearningContextRevision" BETWEEN 0 AND 2147483647
    AND "resultLearningContextRevision" BETWEEN 0 AND 2147483647
  )
);

CREATE UNIQUE INDEX "QuizLearningObjective_bundleQuizId_objectiveId_key"
  ON "QuizLearningObjective"("bundleQuizId", "objectiveId");
CREATE INDEX "QuizLearningObjective_bundleQuizId_idx"
  ON "QuizLearningObjective"("bundleQuizId");
CREATE UNIQUE INDEX "QuizLearningObjectiveReference_objectiveRowId_kind_question_key"
  ON "QuizLearningObjectiveReference"("objectiveRowId", "kind", "questionId");
CREATE INDEX "QuizLearningObjectiveReference_questionId_idx"
  ON "QuizLearningObjectiveReference"("questionId");
CREATE UNIQUE INDEX "SessionLearningObjective_sessionId_objectiveId_key"
  ON "SessionLearningObjective"("sessionId", "objectiveId");
CREATE INDEX "SessionLearningObjective_sessionId_projection_idx"
  ON "SessionLearningObjective"("sessionId", "projection");
CREATE UNIQUE INDEX "SessionLearningObjectiveReference_objectiveRowId_kind_quizQ_key"
  ON "SessionLearningObjectiveReference"("objectiveRowId", "kind", "quizQuestionId");
CREATE UNIQUE INDEX "SessionLearningObjectiveReference_objectiveRowId_kind_qaQue_key"
  ON "SessionLearningObjectiveReference"("objectiveRowId", "kind", "qaQuestionId");
CREATE UNIQUE INDEX "SessionLearningObjectiveReference_objectiveRowId_kind_sourc_key"
  ON "SessionLearningObjectiveReference"("objectiveRowId", "kind", "sourceReferenceId");
CREATE INDEX "SessionLearningObjectiveReference_quizQuestionId_idx"
  ON "SessionLearningObjectiveReference"("quizQuestionId");
CREATE INDEX "SessionLearningObjectiveReference_qaQuestionId_idx"
  ON "SessionLearningObjectiveReference"("qaQuestionId");
CREATE UNIQUE INDEX "SessionQuizAttachReplay_operationId_key"
  ON "SessionQuizAttachReplay"("operationId");

ALTER TABLE "QuizLearningObjectiveBundle"
  ADD CONSTRAINT "QuizLearningObjectiveBundle_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizLearningObjective"
  ADD CONSTRAINT "QuizLearningObjective_bundleQuizId_fkey"
    FOREIGN KEY ("bundleQuizId") REFERENCES "QuizLearningObjectiveBundle"("quizId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizLearningObjectiveReference"
  ADD CONSTRAINT "QuizLearningObjectiveReference_objectiveRowId_fkey"
    FOREIGN KEY ("objectiveRowId") REFERENCES "QuizLearningObjective"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "QuizLearningObjectiveReference_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionLearningObjective"
  ADD CONSTRAINT "SessionLearningObjective_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionLearningObjectiveReference"
  ADD CONSTRAINT "SessionLearningObjectiveReference_objectiveRowId_fkey"
    FOREIGN KEY ("objectiveRowId") REFERENCES "SessionLearningObjective"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionLearningObjectiveReference_quizQuestionId_fkey"
    FOREIGN KEY ("quizQuestionId") REFERENCES "Question"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionLearningObjectiveReference_qaQuestionId_fkey"
    FOREIGN KEY ("qaQuestionId") REFERENCES "QaQuestion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SessionQuizAttachReplay"
  ADD CONSTRAINT "SessionQuizAttachReplay_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Source removal can legitimately advance the learning-context CAS while a
-- finished session is still host-readable or its Q&A follow-up remains open.
-- Preserve every existing lifecycle rule and admit only that evidence-backed,
-- two-field Session update.
CREATE OR REPLACE FUNCTION arsnova_enforce_session_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
  old_without_operator JSONB;
  new_without_operator JSONB;
  qa_or_channel_changed BOOLEAN;
  operational_after_end TEXT[] := ARRAY[
    'nextParticipantNumber',
    'firstParticipantJoinedAt',
    'participantRevision',
    'qaQuestionCount',
    'qaQuestionPeakCount',
    'qaQuestionPeakReachedAt',
    'qaQuestionsAcceptedTotal',
    'qaRankingRevision',
    'qaModerationMode',
    'qaTitle'
  ];
  closable_after_end TEXT[] := ARRAY[
    'qaOpen',
    'quickFeedbackOpen',
    'hostEnded',
    'sessionLifecycleRevision'
  ];
  channel_close_only BOOLEAN;
  host_end_only BOOLEAN;
BEGIN
  IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_CREATED_AT_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD."firstParticipantJoinedAt" IS NOT NULL
    AND NEW."firstParticipantJoinedAt" IS DISTINCT FROM OLD."firstParticipantJoinedAt"
  THEN
    RAISE EXCEPTION 'ARSNOVA_FIRST_PARTICIPANT_JOIN_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW."learningContextRevision" = OLD."learningContextRevision" + 1
    AND NEW."learningContextConfigured" = TRUE
    AND COALESCE(OLD."endedAt", OLD."expiresAt") + INTERVAL '14 days' > database_now
    AND (
      to_jsonb(NEW) - ARRAY['learningContextRevision', 'learningContextConfigured']::TEXT[]
    ) IS NOT DISTINCT FROM (
      to_jsonb(OLD) - ARRAY['learningContextRevision', 'learningContextConfigured']::TEXT[]
    )
    AND EXISTS (
      SELECT 1
      FROM "SessionLearningObjective" AS objective
      INNER JOIN "SessionLearningObjectiveReference" AS reference
        ON reference."objectiveRowId" = objective.id
      WHERE objective."sessionId" = NEW.id
        AND objective."confirmationState" = 'NEEDS_REVIEW'
        AND objective."needsReviewReason" = 'SOURCE_REFERENCE_REMOVED'
        AND reference."unresolvedReason" = 'SOURCE_REMOVED'
    )
  THEN
    RETURN NEW;
  END IF;

  old_without_operator :=
    to_jsonb(OLD) - ARRAY[
      'legalHoldUntil',
      'legalHoldReason',
      'legalHoldSetAt',
      'hostCredentialVersion',
      'hostSupportId'
    ]::TEXT[];
  new_without_operator :=
    to_jsonb(NEW) - ARRAY[
      'legalHoldUntil',
      'legalHoldReason',
      'legalHoldSetAt',
      'hostCredentialVersion',
      'hostSupportId'
    ]::TEXT[];
  qa_or_channel_changed :=
    NEW."preferredChannel" IS DISTINCT FROM OLD."preferredChannel"
    OR NEW."qaEnabled" IS DISTINCT FROM OLD."qaEnabled"
    OR NEW."qaOpen" IS DISTINCT FROM OLD."qaOpen"
    OR NEW."qaClosesAt" IS DISTINCT FROM OLD."qaClosesAt"
    OR NEW."qaTitle" IS DISTINCT FROM OLD."qaTitle"
    OR NEW."qaModerationMode" IS DISTINCT FROM OLD."qaModerationMode";
  channel_close_only :=
    (NEW."qaOpen" IS NOT DISTINCT FROM OLD."qaOpen"
      OR (OLD."qaOpen" IS TRUE AND NEW."qaOpen" IS FALSE))
    AND (NEW."quickFeedbackOpen" IS NOT DISTINCT FROM OLD."quickFeedbackOpen"
      OR (OLD."quickFeedbackOpen" IS TRUE AND NEW."quickFeedbackOpen" IS FALSE));
  host_end_only :=
    NEW."hostEnded" IS NOT DISTINCT FROM OLD."hostEnded"
    OR (OLD."hostEnded" IS NOT TRUE AND NEW."hostEnded" IS TRUE);

  IF OLD."endedAt" IS NOT NULL THEN
    IF NEW."endedAt" IS NULL THEN
      IF database_now >= OLD."expiresAt"
        OR NEW."status" = 'FINISHED'
        OR NOT (
          arsnova_session_qa_channel_joinable(OLD)
          OR OLD."qaClosesAt" IS NULL
        )
      THEN
        RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
          USING ERRCODE = 'P0001';
      END IF;
      NEW."hostEnded" := FALSE;
      NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
      RETURN NEW;
    END IF;
    IF (new_without_operator - operational_after_end - closable_after_end)
         IS DISTINCT FROM (old_without_operator - operational_after_end - closable_after_end)
      OR NOT channel_close_only
      OR NOT host_end_only
    THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW."qaOpen" IS DISTINCT FROM OLD."qaOpen"
      OR NEW."quickFeedbackOpen" IS DISTINCT FROM OLD."quickFeedbackOpen"
      OR NEW."hostEnded" IS DISTINCT FROM OLD."hostEnded"
    THEN
      NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
    END IF;
    RETURN NEW;
  END IF;

  IF database_now >= OLD."expiresAt" THEN
    IF NEW."status" = 'FINISHED' OR NEW."endedAt" IS NOT NULL THEN
      NEW."status" := 'FINISHED';
      NEW."endedAt" := OLD."expiresAt";
      NEW."statusChangedAt" := OLD."expiresAt";
      NEW."currentQuestion" := NULL;
      NEW."currentRound" := 1;
      NEW."activeQuestionStartedAt" := NULL;
      NEW."pausedFromStatus" := NULL;
      NEW."lastSkippedQuestionId" := NULL;
      NEW."lastQuestionSkippedAt" := NULL;
      NEW."expiresAt" := OLD."expiresAt";
      NEW."startedAt" := OLD."startedAt";
      NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
      RETURN NEW;
    END IF;

    IF new_without_operator IS DISTINCT FROM old_without_operator THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_EXPIRED'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" = 'FINISHED' OR NEW."endedAt" IS NOT NULL THEN
    NEW."status" := 'FINISHED';
    NEW."endedAt" := database_now;
    NEW."statusChangedAt" := database_now;
    NEW."currentQuestion" := NULL;
    NEW."currentRound" := 1;
    NEW."activeQuestionStartedAt" := NULL;
    NEW."pausedFromStatus" := NULL;
    NEW."lastSkippedQuestionId" := NULL;
    NEW."lastQuestionSkippedAt" := NULL;
    NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
    RETURN NEW;
  END IF;

  IF NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" THEN
    IF NEW."expiresAt" <= database_now THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_EXPIRATION_NOT_IN_FUTURE'
        USING ERRCODE = 'P0001';
    END IF;
    NEW."startedAt" := GREATEST(
      NEW."createdAt",
      NEW."expiresAt" - INTERVAL '24 hours'
    );
    NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
  ELSIF qa_or_channel_changed THEN
    IF NEW."sessionLifecycleRevision" = OLD."sessionLifecycleRevision" THEN
      NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
    ELSIF NEW."sessionLifecycleRevision" <> OLD."sessionLifecycleRevision" + 1 THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_CHANNEL_REVISION_REQUIRED'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR NEW."sessionLifecycleRevision" IS DISTINCT FROM OLD."sessionLifecycleRevision"
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_LIFECYCLE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Child inserts/updates are guarded independently from the Session row. The application
-- additionally locks and increments Session.learningContextRevision for every mutation.
CREATE FUNCTION arsnova_guard_session_learning_objective_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_row "Session"%ROWTYPE;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Source removal may still happen while a finished session is host-readable.
  -- In that post-processing window it may only advance the objective's CAS and
  -- stale-confirmation fields; ordinary host learning-context writes stay blocked.
  IF TG_OP = 'UPDATE'
    AND NEW."revision" = OLD."revision" + 1
    AND NEW."confirmationState" = 'NEEDS_REVIEW'
    AND NEW."needsReviewReason" = 'SOURCE_REFERENCE_REMOVED'
    AND (
      to_jsonb(NEW) - ARRAY[
        'revision', 'confirmationState', 'confirmationRevision', 'confirmationAt',
        'previousConfirmationState', 'needsReviewReason', 'updatedAt'
      ]::TEXT[]
    ) = (
      to_jsonb(OLD) - ARRAY[
        'revision', 'confirmationState', 'confirmationRevision', 'confirmationAt',
        'previousConfirmationState', 'needsReviewReason', 'updatedAt'
      ]::TEXT[]
    )
    AND EXISTS (
      SELECT 1
      FROM "SessionLearningObjectiveReference" AS reference
      WHERE reference."objectiveRowId" = NEW.id
        AND reference."unresolvedReason" = 'SOURCE_REMOVED'
    )
  THEN
    SELECT * INTO session_row FROM "Session" WHERE id = NEW."sessionId";
    IF FOUND
      AND COALESCE(session_row."endedAt", session_row."expiresAt") + INTERVAL '14 days'
        > timezone('UTC', clock_timestamp())
    THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SessionLearningObjective_guard_active_session"
BEFORE INSERT OR UPDATE ON "SessionLearningObjective"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_session_learning_objective_write();

CREATE FUNCTION arsnova_guard_session_learning_objective_reference_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_session_id TEXT;
  session_row "Session"%ROWTYPE;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  SELECT objective."sessionId"
  INTO target_session_id
  FROM "SessionLearningObjective" AS objective
  WHERE objective."id" = NEW."objectiveRowId";

  IF target_session_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE'
      AND OLD."sourceKind" = 'QA_QUESTION'
      AND OLD."qaQuestionId" IS NOT NULL
      AND NEW."qaQuestionId" IS NULL
      AND NEW."unresolvedReason" = 'SOURCE_REMOVED'
      AND (
        to_jsonb(NEW) - ARRAY['qaQuestionId', 'unresolvedReason']::TEXT[]
      ) = (
        to_jsonb(OLD) - ARRAY['qaQuestionId', 'unresolvedReason']::TEXT[]
      )
    THEN
      SELECT * INTO session_row FROM "Session" WHERE id = target_session_id;
      IF FOUND
        AND COALESCE(session_row."endedAt", session_row."expiresAt") + INTERVAL '14 days'
          > timezone('UTC', clock_timestamp())
      THEN
        RETURN NEW;
      END IF;
    END IF;
    PERFORM arsnova_assert_session_active_for_write(target_session_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SessionLearningObjectiveReference_guard_active_session"
BEFORE INSERT OR UPDATE ON "SessionLearningObjectiveReference"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_session_learning_objective_reference_write();

-- SET NULL alone would transiently violate the reference target CHECK and would also
-- lose the reason why a stable reference row became unresolved. Mark the row first.
-- The nested updates deliberately bypass the public-write guards via trigger depth;
-- active sessions still receive one monotone context revision below.
CREATE FUNCTION arsnova_mark_learning_objective_source_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected_session_ids TEXT[];
  affected_objective_ids TEXT[];
BEGIN
  IF TG_TABLE_NAME = 'Question' THEN
    SELECT
      ARRAY_AGG(DISTINCT objective."sessionId"),
      ARRAY_AGG(DISTINCT reference."objectiveRowId")
    INTO affected_session_ids, affected_objective_ids
    FROM "SessionLearningObjectiveReference" AS reference
    INNER JOIN "SessionLearningObjective" AS objective
      ON objective."id" = reference."objectiveRowId"
    WHERE reference."quizQuestionId" = OLD."id";

  ELSE
    SELECT
      ARRAY_AGG(DISTINCT objective."sessionId"),
      ARRAY_AGG(DISTINCT reference."objectiveRowId")
    INTO affected_session_ids, affected_objective_ids
    FROM "SessionLearningObjectiveReference" AS reference
    INNER JOIN "SessionLearningObjective" AS objective
      ON objective."id" = reference."objectiveRowId"
    WHERE reference."qaQuestionId" = OLD."id";

  END IF;

  IF affected_objective_ids IS NOT NULL THEN
    -- A direct source deletion in a still-live session must never make the
    -- reference state advance without its row/global CAS revisions. Cascaded
    -- parent purges run at a deeper trigger level and delete the whole owning
    -- aggregate, so they must remain possible even at the integer ceiling.
    IF pg_trigger_depth() = 1 AND EXISTS (
      SELECT 1
      FROM "SessionLearningObjective" AS objective
      INNER JOIN "Session" AS session ON session."id" = objective."sessionId"
      WHERE objective."id" = ANY(affected_objective_ids)
        AND COALESCE(session."endedAt", session."expiresAt") + INTERVAL '14 days'
          > timezone('UTC', clock_timestamp())
        AND (
          objective."revision" >= 2147483647
          OR session."learningContextRevision" >= 2147483647
        )
    ) THEN
      RAISE EXCEPTION 'ARSNOVA_LEARNING_CONTEXT_REVISION_EXHAUSTED';
    END IF;

    IF TG_TABLE_NAME = 'Question' THEN
      UPDATE "SessionLearningObjectiveReference"
      SET
        "quizQuestionId" = NULL,
        "unresolvedReason" = 'SOURCE_REMOVED'
      WHERE "quizQuestionId" = OLD."id";
    ELSE
      UPDATE "SessionLearningObjectiveReference"
      SET
        "qaQuestionId" = NULL,
        "unresolvedReason" = 'SOURCE_REMOVED'
      WHERE "qaQuestionId" = OLD."id";
    END IF;

    UPDATE "SessionLearningObjective" AS objective
    SET
      "confirmationRevision" = CASE
        WHEN objective."confirmationState" = 'NEEDS_REVIEW'
          THEN objective."confirmationRevision"
        ELSE objective."revision"
      END,
      "confirmationAt" = CASE
        WHEN objective."confirmationState" = 'CONFIRMED' THEN objective."confirmationAt"
        WHEN objective."confirmationState" = 'NEEDS_REVIEW' THEN objective."confirmationAt"
        ELSE NULL
      END,
      "previousConfirmationState" = CASE
        WHEN objective."confirmationState" = 'NEEDS_REVIEW'
          THEN objective."previousConfirmationState"
        WHEN objective."confirmationState" = 'CONFIRMED'
          THEN 'CONFIRMED'::"LearningObjectivePreviousConfirmationState"
        ELSE 'DRAFT'::"LearningObjectivePreviousConfirmationState"
      END,
      "needsReviewReason" = 'SOURCE_REFERENCE_REMOVED',
      "confirmationState" = 'NEEDS_REVIEW',
      "revision" = objective."revision" + 1,
      "updatedAt" = timezone('UTC', clock_timestamp())
    WHERE objective."id" = ANY(affected_objective_ids)
      AND objective."revision" < 2147483647
      AND EXISTS (
        SELECT 1
        FROM "SessionLearningObjectiveReference" AS reference
        WHERE reference."objectiveRowId" = objective."id"
          AND reference."unresolvedReason" = 'SOURCE_REMOVED'
      );

    UPDATE "Session" AS session
    SET
      "learningContextRevision" = session."learningContextRevision" + 1,
      "learningContextConfigured" = TRUE
    WHERE session."id" = ANY(affected_session_ids)
      AND COALESCE(session."endedAt", session."expiresAt") + INTERVAL '14 days'
        > timezone('UTC', clock_timestamp())
      AND session."learningContextRevision" < 2147483647;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER "Question_mark_learning_objective_source_removed"
BEFORE DELETE ON "Question"
FOR EACH ROW
EXECUTE FUNCTION arsnova_mark_learning_objective_source_removed();

CREATE TRIGGER "QaQuestion_mark_learning_objective_source_removed"
BEFORE DELETE ON "QaQuestion"
FOR EACH ROW
EXECUTE FUNCTION arsnova_mark_learning_objective_source_removed();
