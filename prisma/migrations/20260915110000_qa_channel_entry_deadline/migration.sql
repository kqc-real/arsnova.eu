-- Epic #405 / #417: persistierter Einstiegskanal und linearer Q&A-Fristvertrag.
ALTER TABLE "Session"
ADD COLUMN "preferredChannel" VARCHAR(20);

-- Backfill auch auf bereits beendeten Sessions: der Lifecycle-Trigger
-- würde sonst ARSNOVA_SESSION_ENDED werfen.
ALTER TABLE "Session" DISABLE TRIGGER "Session_enforce_lifecycle";
UPDATE "Session"
SET "preferredChannel" = CASE
  WHEN "type" = 'Q_AND_A' THEN 'qa'
  WHEN "quizId" IS NOT NULL THEN 'quiz'
  WHEN "quickFeedbackEnabled" = TRUE THEN 'quickFeedback'
  WHEN "qaEnabled" = TRUE THEN 'qa'
  ELSE 'quiz'
END;
ALTER TABLE "Session" ENABLE TRIGGER "Session_enforce_lifecycle";

ALTER TABLE "Session"
ALTER COLUMN "preferredChannel" SET DEFAULT 'quiz',
ALTER COLUMN "preferredChannel" SET NOT NULL;

ALTER TABLE "Session"
ADD CONSTRAINT "Session_preferredChannel_valid"
CHECK ("preferredChannel" IN ('quiz', 'qa', 'quickFeedback'));

-- Rolling-/Rollback-Bridge: alte Images schreiben die neue Spalte nicht.
-- Der Trigger korrigiert auch einen deaktivierten Legacy-Zielkanal atomar.
CREATE OR REPLACE FUNCTION arsnova_normalize_preferred_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  preferred_is_enabled BOOLEAN;
BEGIN
  preferred_is_enabled := CASE NEW."preferredChannel"
    WHEN 'quiz' THEN NEW."quizId" IS NOT NULL
    WHEN 'qa' THEN NEW."type" = 'Q_AND_A' OR NEW."qaEnabled" = TRUE
    WHEN 'quickFeedback' THEN NEW."quickFeedbackEnabled" = TRUE
    ELSE FALSE
  END;

  IF NOT preferred_is_enabled THEN
    NEW."preferredChannel" := CASE
      WHEN NEW."quizId" IS NOT NULL THEN 'quiz'
      WHEN NEW."type" = 'Q_AND_A' OR NEW."qaEnabled" = TRUE THEN 'qa'
      WHEN NEW."quickFeedbackEnabled" = TRUE THEN 'quickFeedback'
      ELSE 'quiz'
    END;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Session_00_normalize_preferred_channel"
BEFORE INSERT OR UPDATE OF
  "preferredChannel",
  "type",
  "quizId",
  "qaEnabled",
  "quickFeedbackEnabled"
ON "Session"
FOR EACH ROW
EXECUTE FUNCTION arsnova_normalize_preferred_channel();

-- Der Lifecycle-Trigger verlangt für Q&A-/Einstiegskanal-Änderungen genau die
-- nächste Revision. Nach dem effektiven globalen Ende bleibt der Sessionkern
-- unverändert; dort sind weiterhin nur Legal-Hold- und Credential-Metadaten
-- als getrennte Operatorvorgänge zulässig.
CREATE OR REPLACE FUNCTION arsnova_enforce_session_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
  old_without_operator JSONB;
  new_without_operator JSONB;
  qa_or_channel_changed BOOLEAN;
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
    OR NEW."qaClosesAt" IS DISTINCT FROM OLD."qaClosesAt";

  IF OLD."endedAt" IS NOT NULL THEN
    IF new_without_operator IS DISTINCT FROM old_without_operator THEN
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

-- Teilnehmerbeiträge werden mit DB-Uhr und Sessionzeilensperre linearisiert.
-- Soft-Delete eigener Fragen nutzt weiterhin nur arsnova_lock_active_session,
-- weil es nach Q&A-Fristschluss ausdrücklich zulässig bleibt.
CREATE OR REPLACE FUNCTION arsnova_lock_qa_contribution_open(session_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  session_row "Session"%ROWTYPE;
  database_now TIMESTAMP(3);
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

  database_now := timezone('UTC', clock_timestamp());
  IF session_row."endedAt" IS NOT NULL
    OR session_row."status" = 'FINISHED'
    OR database_now >= session_row."expiresAt"
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (session_row."type" = 'Q_AND_A' OR session_row."qaEnabled" = TRUE)
    OR session_row."qaOpen" <> TRUE
    OR session_row."qaClosesAt" IS NULL
    OR database_now >= session_row."qaClosesAt"
  THEN
    RAISE EXCEPTION 'ARSNOVA_QA_CLOSED'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

