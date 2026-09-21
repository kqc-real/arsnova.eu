-- Kennzeichnet das globale Host-Ende (session.end) getrennt vom letzten Quiz-FINISHED.
ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "hostEnded" BOOLEAN NOT NULL DEFAULT FALSE;

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
