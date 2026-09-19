-- Nach Quiz-FINISHED darf der Host Quiz/Blitzlicht mit denselben Teilnahmen
-- neu starten, solange Q&A noch beitrittsfähig ist. Das hebt endedAt auf.
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
    IF NEW."endedAt" IS NULL THEN
      IF database_now >= OLD."expiresAt"
        OR NOT arsnova_session_qa_channel_joinable(OLD)
        OR NEW."status" = 'FINISHED'
      THEN
        RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
          USING ERRCODE = 'P0001';
      END IF;
      NEW."sessionLifecycleRevision" := OLD."sessionLifecycleRevision" + 1;
      RETURN NEW;
    END IF;
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
