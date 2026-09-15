-- Epic #405 / #407: absolute, database-enforced session lifecycle.
ALTER TABLE "Session"
  ADD COLUMN "createdAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "qaClosesAt" TIMESTAMP(3),
  ADD COLUMN "timeZone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  ADD COLUMN "firstParticipantJoinedAt" TIMESTAMP(3),
  ADD COLUMN "sessionLifecycleRevision" INTEGER NOT NULL DEFAULT 0;

UPDATE "Session" AS session
SET
  "createdAt" = session."startedAt",
  "expiresAt" = session."startedAt" + INTERVAL '24 hours',
  "qaClosesAt" = CASE
    WHEN session."qaEnabled" THEN session."startedAt" + INTERVAL '24 hours'
    ELSE NULL
  END,
  "firstParticipantJoinedAt" = (
    SELECT MIN(participant."joinedAt")
    FROM "Participant" AS participant
    WHERE participant."sessionId" = session."id"
  );

ALTER TABLE "Session"
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "expiresAt" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_expires_after_created"
    CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "Session_expires_within_hard_cap"
    CHECK ("expiresAt" <= "createdAt" + INTERVAL '30 days'),
  ADD CONSTRAINT "Session_qa_closes_before_session"
    CHECK ("qaClosesAt" IS NULL OR "qaClosesAt" <= "expiresAt"),
  ADD CONSTRAINT "Session_lifecycle_revision_nonnegative"
    CHECK ("sessionLifecycleRevision" >= 0);

CREATE INDEX "Session_expiresAt_id_idx" ON "Session"("expiresAt", "id");

-- Anwendungspfad für Hostmutationen mit bestehender Row-Lock-Konvention.
CREATE OR REPLACE FUNCTION arsnova_lock_active_session(session_id TEXT)
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
    RETURN;
  END IF;

  -- Erst nach einem möglichen Lock-Wait lesen: Request-Startzeit darf eine
  -- nach Fristablauf linearisierte Mutation nicht wieder zulassen.
  database_now := timezone('UTC', clock_timestamp());

  IF session_row."endedAt" IS NOT NULL
    OR session_row."status" = 'FINISHED'
    OR database_now >= session_row."expiresAt"
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Kanonisiert Lifecycle-Übergänge auch für alte App-Images im Rolling Deployment.
CREATE OR REPLACE FUNCTION arsnova_enforce_session_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
  old_without_operator JSONB;
  new_without_operator JSONB;
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
      'legalHoldSetAt'
    ]::TEXT[];
  new_without_operator :=
    to_jsonb(NEW) - ARRAY[
      'legalHoldUntil',
      'legalHoldReason',
      'legalHoldSetAt'
    ]::TEXT[];

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
  ELSIF NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR NEW."sessionLifecycleRevision" IS DISTINCT FROM OLD."sessionLifecycleRevision"
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_LIFECYCLE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Session_enforce_lifecycle"
BEFORE UPDATE ON "Session"
FOR EACH ROW
EXECUTE FUNCTION arsnova_enforce_session_lifecycle();

CREATE OR REPLACE FUNCTION arsnova_assert_session_active_for_write(
  session_id TEXT,
  lock_parent BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  session_ended_at TIMESTAMP(3);
  session_expires_at TIMESTAMP(3);
  session_status "SessionStatus";
  database_now TIMESTAMP(3);
BEGIN
  IF lock_parent THEN
    SELECT "endedAt", "expiresAt", "status"
    INTO session_ended_at, session_expires_at, session_status
    FROM "Session"
    WHERE "id" = session_id
    FOR SHARE;
  ELSE
    SELECT "endedAt", "expiresAt", "status"
    INTO session_ended_at, session_expires_at, session_status
    FROM "Session"
    WHERE "id" = session_id;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Bei konkurrierendem Sessionabschluss zählt der Zeitpunkt nach dem
  -- Parent-Lock, nicht der Beginn des wartenden Child-Statements.
  database_now := timezone('UTC', clock_timestamp());

  IF session_ended_at IS NOT NULL
    OR session_status = 'FINISHED'
    OR database_now >= session_expires_at
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION arsnova_guard_participant_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId", FALSE);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION arsnova_mark_first_participant_join()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Session"
  SET "firstParticipantJoinedAt" = COALESCE("firstParticipantJoinedAt", NEW."joinedAt")
  WHERE "id" = NEW."sessionId";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Participant_guard_active_session"
BEFORE INSERT OR UPDATE ON "Participant"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_participant_write();

CREATE TRIGGER "Participant_mark_first_join"
AFTER INSERT ON "Participant"
FOR EACH ROW
EXECUTE FUNCTION arsnova_mark_first_participant_join();

CREATE OR REPLACE FUNCTION arsnova_guard_vote_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Vote_guard_active_session"
BEFORE INSERT OR UPDATE ON "Vote"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_vote_write();

CREATE OR REPLACE FUNCTION arsnova_guard_qa_question_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QaQuestion_guard_active_session"
BEFORE INSERT OR UPDATE ON "QaQuestion"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_qa_question_write();

CREATE OR REPLACE FUNCTION arsnova_guard_qa_upvote_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_id TEXT;
BEGIN
  SELECT question."sessionId"
  INTO session_id
  FROM "QaQuestion" AS question
  WHERE question."id" = NEW."qaQuestionId";

  IF session_id IS NOT NULL THEN
    PERFORM arsnova_assert_session_active_for_write(session_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QaUpvote_guard_active_session"
BEFORE INSERT OR UPDATE ON "QaUpvote"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_qa_upvote_write();

CREATE OR REPLACE FUNCTION arsnova_guard_team_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM arsnova_assert_session_active_for_write(NEW."sessionId");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Team_guard_active_session"
BEFORE INSERT OR UPDATE ON "Team"
FOR EACH ROW
EXECUTE FUNCTION arsnova_guard_team_write();
