-- Nach Quiz-FINISHED bleibt ein noch offener Q&A-Kanal beitritts- und
-- beitragsfähig bis qaClosesAt / expiresAt. Dafür dürfen operative Zähler
-- nach endedAt weiterlaufen; Konfiguration und Sessionkern bleiben gesperrt.

CREATE OR REPLACE FUNCTION arsnova_session_qa_channel_joinable(session_row "Session")
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
BEGIN
  IF database_now >= session_row."expiresAt" THEN
    RETURN FALSE;
  END IF;
  IF NOT (session_row."type" = 'Q_AND_A' OR session_row."qaEnabled" = TRUE) THEN
    RETURN FALSE;
  END IF;
  IF session_row."qaOpen" <> TRUE THEN
    RETURN FALSE;
  END IF;
  IF session_row."qaClosesAt" IS NULL OR database_now >= session_row."qaClosesAt" THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

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
    'qaRankingRevision'
  ];
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

  IF OLD."endedAt" IS NOT NULL THEN
    IF (new_without_operator - operational_after_end)
         IS DISTINCT FROM (old_without_operator - operational_after_end)
    THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
        USING ERRCODE = 'P0001';
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

CREATE OR REPLACE FUNCTION arsnova_lock_qa_contribution_open(session_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  session_row "Session"%ROWTYPE;
BEGIN
  SELECT *
  INTO session_row
  FROM "Session"
  WHERE "id" = session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT arsnova_session_qa_channel_joinable(session_row) THEN
    IF timezone('UTC', clock_timestamp()) >= session_row."expiresAt" THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
        USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'ARSNOVA_QA_CLOSED'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION arsnova_guard_participant_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_row "Session"%ROWTYPE;
BEGIN
  SELECT *
  INTO session_row
  FROM "Session"
  WHERE "id" = NEW."sessionId";

  IF FOUND AND arsnova_session_qa_channel_joinable(session_row) THEN
    RETURN NEW;
  END IF;

  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId", FALSE);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION arsnova_guard_qa_question_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_row "Session"%ROWTYPE;
BEGIN
  SELECT *
  INTO session_row
  FROM "Session"
  WHERE "id" = NEW."sessionId";

  IF FOUND AND arsnova_session_qa_channel_joinable(session_row) THEN
    RETURN NEW;
  END IF;

  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId");
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION arsnova_guard_qa_upvote_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_id TEXT;
  session_row "Session"%ROWTYPE;
BEGIN
  SELECT question."sessionId"
  INTO session_id
  FROM "QaQuestion" AS question
  WHERE question."id" = NEW."qaQuestionId";

  IF session_id IS NOT NULL THEN
    SELECT *
    INTO session_row
    FROM "Session"
    WHERE "id" = session_id;

    IF FOUND AND arsnova_session_qa_channel_joinable(session_row) THEN
      RETURN NEW;
    END IF;

    PERFORM arsnova_assert_session_active_for_write(session_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION arsnova_create_qa_question(
  p_session_id TEXT,
  p_participant_id TEXT,
  p_text TEXT,
  p_idempotency_hash CHAR(64),
  p_nlp_status "QaNlpStatus"
)
RETURNS TABLE (
  "id" TEXT,
  "text" TEXT,
  "upvoteCount" INTEGER,
  "status" "QaQuestionStatus",
  "createdAt" TIMESTAMP(3),
  "replayed" BOOLEAN,
  "participantQuestionCount" INTEGER,
  "sessionQuestionCount" INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  session_row "Session"%ROWTYPE;
  existing_question "QaQuestion"%ROWTYPE;
  inserted_question "QaQuestion"%ROWTYPE;
  participant_count INTEGER;
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
BEGIN
  SELECT *
  INTO session_row
  FROM "Session"
  WHERE "Session"."id" = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO existing_question
  FROM "QaQuestion" AS question
  WHERE question."sessionId" = p_session_id
    AND question."participantId" = p_participant_id
    AND question."submitIdempotencyKeyHash" = p_idempotency_hash;

  IF FOUND THEN
    SELECT COUNT(*)::INTEGER
    INTO participant_count
    FROM "QaQuestion" AS question
    WHERE question."sessionId" = p_session_id
      AND question."participantId" = p_participant_id;

    RETURN QUERY SELECT
      existing_question."id",
      existing_question."text",
      existing_question."upvoteCount",
      existing_question."status",
      existing_question."createdAt",
      TRUE,
      participant_count,
      session_row."qaQuestionCount";
    RETURN;
  END IF;

  -- Replay bleibt auch nach Frist-/Sessionende zulässig. Neue Fragen brauchen
  -- einen noch offenen Q&A-Kanal; Quiz-FINISHED allein sperrt sie nicht.
  IF NOT arsnova_session_qa_channel_joinable(session_row) THEN
    IF database_now >= session_row."expiresAt" THEN
      RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'ARSNOVA_QA_CLOSED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM "Participant" AS participant
  WHERE participant."id" = p_participant_id
    AND participant."sessionId" = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARSNOVA_PARTICIPANT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO participant_count
  FROM "QaQuestion" AS question
  WHERE question."sessionId" = p_session_id
    AND question."participantId" = p_participant_id;

  IF participant_count >= 10 THEN
    RAISE EXCEPTION 'ARSNOVA_QA_PARTICIPANT_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF session_row."qaQuestionCount" >= 25000 THEN
    RAISE EXCEPTION 'ARSNOVA_QA_SESSION_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO "QaQuestion" (
    "id",
    "text",
    "status",
    "sessionId",
    "participantId",
    "submitIdempotencyKeyHash",
    "nlpStatus",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    gen_random_uuid()::TEXT,
    p_text,
    CASE
      WHEN session_row."qaModerationMode" OR session_row."moderationMode" THEN 'PENDING'
      ELSE 'ACTIVE'
    END::"QaQuestionStatus",
    p_session_id,
    p_participant_id,
    p_idempotency_hash,
    p_nlp_status,
    database_now,
    database_now
  )
  RETURNING * INTO inserted_question;

  RETURN QUERY SELECT
    inserted_question."id",
    inserted_question."text",
    inserted_question."upvoteCount",
    inserted_question."status",
    inserted_question."createdAt",
    FALSE,
    participant_count + 1,
    session_row."qaQuestionCount" + 1;
END;
$$;
