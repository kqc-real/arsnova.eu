-- Epic #405 / #414 / #415: atomare Q&A-Kontingente, Rankingrevision und
-- purge-sichere Plattformprojektion.

-- Idempotent: Produktion kann nach P3018 bereits Spalten/Tabelle/Indizes haben.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaRankingRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaQuestionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaQuestionPeakCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaQuestionPeakReachedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaQuestionsAcceptedTotal" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "participantRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "QaQuestion" ADD COLUMN IF NOT EXISTS "positiveVoteCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QaQuestion" ADD COLUMN IF NOT EXISTS "negativeVoteCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QaQuestion" ADD COLUMN IF NOT EXISTS "submitIdempotencyKeyHash" CHAR(64);

ALTER TABLE "QaUpvote" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "QaUpvote" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PlatformStatistic" ADD COLUMN IF NOT EXISTS "qaQuestionsTotal" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "PlatformStatistic" ADD COLUMN IF NOT EXISTS "maxQaQuestionsSingleSession" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformStatistic" ADD COLUMN IF NOT EXISTS "maxQaQuestionsStatisticUpdatedAt" TIMESTAMP(3);
ALTER TABLE "PlatformStatistic" ADD COLUMN IF NOT EXISTS "qaStatisticsTrackingStartedAt" TIMESTAMP(3);
ALTER TABLE "PlatformStatistic" ADD COLUMN IF NOT EXISTS "qaStatisticsProjectedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "QaSessionStatisticProjection" (
  "sessionId" TEXT NOT NULL,
  "questionsAcceptedTotal" BIGINT NOT NULL,
  "questionPeakCount" INTEGER NOT NULL,
  "questionPeakReachedAt" TIMESTAMP(3),
  "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QaSessionStatisticProjection_pkey" PRIMARY KEY ("sessionId")
);

CREATE INDEX IF NOT EXISTS "QaSessionStatisticProjection_peak_idx"
  ON "QaSessionStatisticProjection" ("questionPeakCount", "questionPeakReachedAt");
CREATE INDEX IF NOT EXISTS "Participant_sessionId_joinedAt_id_idx"
  ON "Participant" ("sessionId", "joinedAt", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "QaQuestion_sessionId_participantId_submitIdempotencyKeyHash_key"
  ON "QaQuestion" ("sessionId", "participantId", "submitIdempotencyKeyHash");
CREATE INDEX IF NOT EXISTS "QaQuestion_sessionId_status_upvoteCount_createdAt_id_idx"
  ON "QaQuestion" ("sessionId", "status", "upvoteCount", "createdAt", "id");

-- Vorhandene Vote-Zähler und Fragenbestände bilden den gemeinsamen,
-- wahrheitsgemäßen Erfassungsstichtag. Fragen- und Session-Guards werden nur
-- für diesen atomaren Backfill ausgesetzt (auch beendete Sessions). Ein
-- DO-Block rollt DISABLE bei Abbruch mit zurück.
DO $$
BEGIN
    ALTER TABLE "QaQuestion" DISABLE TRIGGER "QaQuestion_guard_active_session";
    UPDATE "QaQuestion"
    SET
      "positiveVoteCount" = 0,
      "negativeVoteCount" = 0,
      "upvoteCount" = 0;

    WITH vote_counts AS (
      SELECT
        "qaQuestionId",
        COUNT(*) FILTER (WHERE "direction" = 'UP')::INTEGER AS positive_count,
        COUNT(*) FILTER (WHERE "direction" = 'DOWN')::INTEGER AS negative_count
      FROM "QaUpvote"
      GROUP BY "qaQuestionId"
    )
    UPDATE "QaQuestion" AS question
    SET
      "positiveVoteCount" = COALESCE(vote_counts.positive_count, 0),
      "negativeVoteCount" = COALESCE(vote_counts.negative_count, 0),
      "upvoteCount" = COALESCE(vote_counts.positive_count, 0)
        - COALESCE(vote_counts.negative_count, 0)
    FROM vote_counts
    WHERE vote_counts."qaQuestionId" = question."id";
    ALTER TABLE "QaQuestion" ENABLE TRIGGER "QaQuestion_guard_active_session";
END $$;

DO $$
BEGIN
    ALTER TABLE "Session" DISABLE TRIGGER "Session_enforce_lifecycle";
    UPDATE "Session" AS session
    SET
      "qaQuestionCount" = (
        SELECT COUNT(*)::INTEGER
        FROM "QaQuestion"
        WHERE "sessionId" = session."id"
      ),
      "qaQuestionPeakCount" = (
        SELECT COUNT(*)::INTEGER
        FROM "QaQuestion"
        WHERE "sessionId" = session."id"
      ),
      "qaQuestionsAcceptedTotal" = (
        SELECT COUNT(*)::INTEGER
        FROM "QaQuestion"
        WHERE "sessionId" = session."id"
      ),
      "qaQuestionPeakReachedAt" = CURRENT_TIMESTAMP;
    ALTER TABLE "Session" ENABLE TRIGGER "Session_enforce_lifecycle";
END $$;

INSERT INTO "QaSessionStatisticProjection" (
  "sessionId",
  "questionsAcceptedTotal",
  "questionPeakCount",
  "questionPeakReachedAt",
  "projectedAt"
)
SELECT
  "id",
  "qaQuestionsAcceptedTotal",
  "qaQuestionPeakCount",
  "qaQuestionPeakReachedAt",
  CURRENT_TIMESTAMP
FROM "Session"
ON CONFLICT ("sessionId") DO UPDATE
SET
  "questionsAcceptedTotal" = EXCLUDED."questionsAcceptedTotal",
  "questionPeakCount" = EXCLUDED."questionPeakCount",
  "questionPeakReachedAt" = EXCLUDED."questionPeakReachedAt",
  "projectedAt" = EXCLUDED."projectedAt";

INSERT INTO "PlatformStatistic" (
  "id",
  "qaQuestionsTotal",
  "maxQaQuestionsSingleSession",
  "maxQaQuestionsStatisticUpdatedAt",
  "qaStatisticsTrackingStartedAt",
  "qaStatisticsProjectedAt",
  "updatedAt"
)
SELECT
  'default',
  COALESCE(SUM("questionsAcceptedTotal"), 0),
  COALESCE(MAX("questionPeakCount"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "QaSessionStatisticProjection"
ON CONFLICT ("id") DO UPDATE
SET
  "qaQuestionsTotal" = EXCLUDED."qaQuestionsTotal",
  "maxQaQuestionsSingleSession" = EXCLUDED."maxQaQuestionsSingleSession",
  "maxQaQuestionsStatisticUpdatedAt" = EXCLUDED."maxQaQuestionsStatisticUpdatedAt",
  "qaStatisticsTrackingStartedAt" = EXCLUDED."qaStatisticsTrackingStartedAt",
  "qaStatisticsProjectedAt" = EXCLUDED."qaStatisticsProjectedAt",
  "updatedAt" = "PlatformStatistic"."updatedAt";

-- Die 25.000er Obergrenze gilt nur für neue Inserts (Trigger unten).
-- Ein validiertes CHECK <= 25000 würde migrate deploy auf Legacy-Beständen
-- über dem Limit abbrechen; solche Bestände werden nicht verworfen.
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_qaQuestionCount_range"
    CHECK ("qaQuestionCount" >= 0),
  ADD CONSTRAINT "Session_qaQuestionPeakCount_valid"
    CHECK ("qaQuestionPeakCount" >= "qaQuestionCount"),
  ADD CONSTRAINT "Session_qaQuestionsAcceptedTotal_nonnegative"
    CHECK ("qaQuestionsAcceptedTotal" >= 0),
  ADD CONSTRAINT "Session_qaRankingRevision_nonnegative"
    CHECK ("qaRankingRevision" >= 0),
  ADD CONSTRAINT "Session_participantRevision_nonnegative"
    CHECK ("participantRevision" >= 0);

ALTER TABLE "QaQuestion"
  ADD CONSTRAINT "QaQuestion_positiveVoteCount_nonnegative"
    CHECK ("positiveVoteCount" >= 0),
  ADD CONSTRAINT "QaQuestion_negativeVoteCount_nonnegative"
    CHECK ("negativeVoteCount" >= 0);

-- Markiert Parent-Cascades transaktionslokal, damit der Fragen-DELETE-Trigger
-- beim Session-Purge keinen bereits zu löschenden Sessionzähler anfasst.
CREATE OR REPLACE FUNCTION arsnova_mark_session_deleting()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleting_ids TEXT := current_setting('arsnova.deleting_session_ids', TRUE);
BEGIN
  PERFORM set_config(
    'arsnova.deleting_session_ids',
    COALESCE(deleting_ids || ',', '') || OLD."id",
    TRUE
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER "Session_00_mark_deleting"
BEFORE DELETE ON "Session"
FOR EACH ROW
EXECUTE FUNCTION arsnova_mark_session_deleting();

CREATE OR REPLACE FUNCTION arsnova_project_qa_session_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "QaSessionStatisticProjection" (
    "sessionId",
    "questionsAcceptedTotal",
    "questionPeakCount",
    "questionPeakReachedAt",
    "projectedAt"
  )
  VALUES (
    OLD."id",
    OLD."qaQuestionsAcceptedTotal",
    OLD."qaQuestionPeakCount",
    OLD."qaQuestionPeakReachedAt",
    timezone('UTC', clock_timestamp())
  )
  ON CONFLICT ("sessionId") DO UPDATE
  SET
    "questionsAcceptedTotal" = GREATEST(
      "QaSessionStatisticProjection"."questionsAcceptedTotal",
      EXCLUDED."questionsAcceptedTotal"
    ),
    "questionPeakReachedAt" = CASE
      WHEN EXCLUDED."questionPeakCount" > "QaSessionStatisticProjection"."questionPeakCount"
        THEN EXCLUDED."questionPeakReachedAt"
      ELSE "QaSessionStatisticProjection"."questionPeakReachedAt"
    END,
    "questionPeakCount" = GREATEST(
      "QaSessionStatisticProjection"."questionPeakCount",
      EXCLUDED."questionPeakCount"
    ),
    "projectedAt" = EXCLUDED."projectedAt";
  RETURN OLD;
END;
$$;

CREATE TRIGGER "Session_01_project_qa_statistics"
BEFORE DELETE ON "Session"
FOR EACH ROW
EXECUTE FUNCTION arsnova_project_qa_session_before_delete();

CREATE OR REPLACE FUNCTION arsnova_track_participant_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_session_id TEXT;
  deleting_ids TEXT := current_setting('arsnova.deleting_session_ids', TRUE);
BEGIN
  target_session_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."sessionId"
    ELSE NEW."sessionId"
  END;
  IF TG_OP = 'DELETE'
    AND target_session_id = ANY(string_to_array(COALESCE(deleting_ids, ''), ','))
  THEN
    RETURN OLD;
  END IF;

  UPDATE "Session"
  SET "participantRevision" = "participantRevision" + 1
  WHERE "id" = target_session_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Participant_track_revision"
AFTER INSERT OR DELETE ON "Participant"
FOR EACH ROW
EXECUTE FUNCTION arsnova_track_participant_revision();

-- Rolling-/Rollback-Bridge: auch alte Images müssen beide harten Kontingente
-- und den Q&A-Beitragszeitraum einhalten. Die Sessionzeile serialisiert
-- parallele Inserts; bestehende Legacy-Bestände werden nicht rückwirkend
-- verworfen.
CREATE OR REPLACE FUNCTION arsnova_enforce_qa_question_insert_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_question_count INTEGER;
  participant_question_count INTEGER;
BEGIN
  PERFORM arsnova_lock_qa_contribution_open(NEW."sessionId");

  PERFORM 1
  FROM "Participant" AS participant
  WHERE participant."id" = NEW."participantId"
    AND participant."sessionId" = NEW."sessionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARSNOVA_PARTICIPANT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT "qaQuestionCount"
  INTO session_question_count
  FROM "Session"
  WHERE "id" = NEW."sessionId";
  IF session_question_count >= 25000 THEN
    RAISE EXCEPTION 'ARSNOVA_QA_SESSION_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO participant_question_count
  FROM "QaQuestion" AS question
  WHERE question."sessionId" = NEW."sessionId"
    AND question."participantId" = NEW."participantId";
  IF participant_question_count >= 10 THEN
    RAISE EXCEPTION 'ARSNOVA_QA_PARTICIPANT_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "QaQuestion_enforce_insert_limits"
BEFORE INSERT ON "QaQuestion"
FOR EACH ROW
EXECUTE FUNCTION arsnova_enforce_qa_question_insert_limits();

-- Auch physische INSERTs/DELETEs alter Images schreiben die neuen Zähler fort.
CREATE OR REPLACE FUNCTION arsnova_track_qa_question_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
BEGIN
  UPDATE "Session"
  SET
    "qaQuestionCount" = "qaQuestionCount" + 1,
    "qaQuestionsAcceptedTotal" = "qaQuestionsAcceptedTotal" + 1,
    "qaQuestionPeakReachedAt" = CASE
      WHEN "qaQuestionCount" + 1 > "qaQuestionPeakCount" THEN database_now
      ELSE "qaQuestionPeakReachedAt"
    END,
    "qaQuestionPeakCount" = GREATEST("qaQuestionPeakCount", "qaQuestionCount" + 1),
    "qaRankingRevision" = "qaRankingRevision" + 1
  WHERE "id" = NEW."sessionId";

  RETURN NEW;
END;
$$;

CREATE TRIGGER "QaQuestion_track_insert"
AFTER INSERT ON "QaQuestion"
FOR EACH ROW
EXECUTE FUNCTION arsnova_track_qa_question_insert();

CREATE OR REPLACE FUNCTION arsnova_track_qa_question_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleting_ids TEXT := current_setting('arsnova.deleting_session_ids', TRUE);
BEGIN
  IF OLD."sessionId" = ANY(string_to_array(COALESCE(deleting_ids, ''), ',')) THEN
    RETURN OLD;
  END IF;

  UPDATE "Session"
  SET
    "qaQuestionCount" = GREATEST(0, "qaQuestionCount" - 1),
    "qaRankingRevision" = "qaRankingRevision" + 1
  WHERE "id" = OLD."sessionId";

  RETURN OLD;
END;
$$;

CREATE TRIGGER "QaQuestion_track_delete"
AFTER DELETE ON "QaQuestion"
FOR EACH ROW
EXECUTE FUNCTION arsnova_track_qa_question_delete();

CREATE OR REPLACE FUNCTION arsnova_track_qa_question_ranking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Session"
  SET "qaRankingRevision" = "qaRankingRevision" + 1
  WHERE "id" = NEW."sessionId";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QaQuestion_track_ranking_update"
AFTER UPDATE OF "text", "status", "upvoteCount", "positiveVoteCount", "negativeVoteCount"
ON "QaQuestion"
FOR EACH ROW
WHEN (
  OLD."text" IS DISTINCT FROM NEW."text"
  OR OLD."status" IS DISTINCT FROM NEW."status"
  OR OLD."upvoteCount" IS DISTINCT FROM NEW."upvoteCount"
  OR OLD."positiveVoteCount" IS DISTINCT FROM NEW."positiveVoteCount"
  OR OLD."negativeVoteCount" IS DISTINCT FROM NEW."negativeVoteCount"
)
EXECUTE FUNCTION arsnova_track_qa_question_ranking_update();

-- Rechnet die getrennten Richtungszähler aus genau der betroffenen Vote-Menge
-- nach. Damit bleiben auch alte Images während Rolling Deployment kompatibel.
CREATE OR REPLACE FUNCTION arsnova_reconcile_qa_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  question_id TEXT;
BEGIN
  question_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."qaQuestionId"
    ELSE NEW."qaQuestionId"
  END;
  UPDATE "QaQuestion"
  SET
    "positiveVoteCount" = (
      SELECT COUNT(*)::INTEGER
      FROM "QaUpvote"
      WHERE "qaQuestionId" = question_id
        AND "direction" = 'UP'
    ),
    "negativeVoteCount" = (
      SELECT COUNT(*)::INTEGER
      FROM "QaUpvote"
      WHERE "qaQuestionId" = question_id
        AND "direction" = 'DOWN'
    ),
    "updatedAt" = timezone('UTC', clock_timestamp())
  WHERE "id" = question_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QaUpvote_reconcile_counts"
AFTER INSERT OR UPDATE OF "direction" OR DELETE ON "QaUpvote"
FOR EACH ROW
EXECUTE FUNCTION arsnova_reconcile_qa_vote_counts();

CREATE OR REPLACE FUNCTION arsnova_change_qa_vote(
  p_question_id TEXT,
  p_participant_id TEXT,
  p_direction "QaVoteDirection"
)
RETURNS TABLE (
  "questionId" TEXT,
  "myVote" "QaVoteDirection",
  "upvoteCount" INTEGER,
  "changed" BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  question_session_id TEXT;
  question_row "QaQuestion"%ROWTYPE;
  vote_row "QaUpvote"%ROWTYPE;
  vote_delta INTEGER;
  database_now TIMESTAMP(3) := timezone('UTC', clock_timestamp());
BEGIN
  SELECT question."sessionId"
  INTO question_session_id
  FROM "QaQuestion" AS question
  WHERE question."id" = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARSNOVA_QA_QUESTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  PERFORM arsnova_lock_qa_contribution_open(question_session_id);

  SELECT *
  INTO question_row
  FROM "QaQuestion" AS question
  WHERE question."id" = p_question_id
  FOR UPDATE;
  IF NOT FOUND OR question_row."status" NOT IN ('ACTIVE', 'PINNED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'ARSNOVA_QA_QUESTION_NOT_VOTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF question_row."participantId" = p_participant_id THEN
    RAISE EXCEPTION 'ARSNOVA_QA_OWN_QUESTION' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM "Participant" AS participant
  WHERE participant."id" = p_participant_id
    AND participant."sessionId" = question_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARSNOVA_PARTICIPANT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO vote_row
  FROM "QaUpvote" AS vote
  WHERE vote."qaQuestionId" = p_question_id
    AND vote."participantId" = p_participant_id
  FOR UPDATE;

  IF FOUND AND vote_row."direction" = p_direction THEN
    vote_delta := CASE WHEN p_direction = 'UP' THEN -1 ELSE 1 END;
    DELETE FROM "QaUpvote" WHERE "id" = vote_row."id";
    "myVote" := NULL;
  ELSIF FOUND THEN
    vote_delta := CASE WHEN p_direction = 'UP' THEN 2 ELSE -2 END;
    UPDATE "QaUpvote"
    SET "direction" = p_direction, "updatedAt" = database_now
    WHERE "id" = vote_row."id";
    "myVote" := p_direction;
  ELSE
    vote_delta := CASE WHEN p_direction = 'UP' THEN 1 ELSE -1 END;
    INSERT INTO "QaUpvote" (
      "id",
      "qaQuestionId",
      "participantId",
      "direction",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::TEXT,
      p_question_id,
      p_participant_id,
      p_direction,
      database_now,
      database_now
    );
    "myVote" := p_direction;
  END IF;

  UPDATE "QaQuestion" AS question
  SET
    "upvoteCount" = question."upvoteCount" + vote_delta,
    "updatedAt" = database_now
  WHERE question."id" = p_question_id
  RETURNING question."upvoteCount" INTO "upvoteCount";

  "questionId" := p_question_id;
  "changed" := TRUE;
  RETURN NEXT;
END;
$$;

-- Ein Sessionzeilen-Lock linearisiert Teilnehmer- und 25.000er-Gesamtlimit,
-- ohne Submits verschiedener Sessions global zu serialisieren.
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

  -- Eine bereits committete Anfrage bleibt auch nach Frist-/Sessionende
  -- replaybar. So erzeugt ein verlorener Response beim Retry weder einen
  -- zweiten Platzverbrauch noch einen falschen fachlichen Fehler.
  IF session_row."endedAt" IS NOT NULL
    OR session_row."status" = 'FINISHED'
    OR database_now >= session_row."expiresAt"
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (session_row."type" = 'Q_AND_A' OR session_row."qaEnabled" = TRUE)
    OR session_row."qaOpen" <> TRUE
    OR session_row."qaClosesAt" IS NULL
    OR database_now >= session_row."qaClosesAt"
  THEN
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
