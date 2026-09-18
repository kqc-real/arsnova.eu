-- AP4: Richtungszähler aus OLD/NEW-Differenzen pflegen und mit upvoteCount
-- in einem Update zusammenführen. Rolling Deploy bleibt kompatibel:
-- alte Images ohne arsnova.skip_qa_vote_reconcile nutzen weiter den Trigger.

CREATE OR REPLACE FUNCTION arsnova_reconcile_qa_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  question_id TEXT;
  positive_delta INTEGER := 0;
  negative_delta INTEGER := 0;
BEGIN
  IF current_setting('arsnova.skip_qa_vote_reconcile', true) = '1' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    question_id := NEW."qaQuestionId";
    IF NEW."direction" = 'UP' THEN
      positive_delta := 1;
    ELSE
      negative_delta := 1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    question_id := OLD."qaQuestionId";
    IF OLD."direction" = 'UP' THEN
      positive_delta := -1;
    ELSE
      negative_delta := -1;
    END IF;
  ELSE
    question_id := NEW."qaQuestionId";
    IF OLD."direction" IS DISTINCT FROM NEW."direction" THEN
      IF OLD."direction" = 'UP' THEN
        positive_delta := -1;
        negative_delta := 1;
      ELSE
        positive_delta := 1;
        negative_delta := -1;
      END IF;
    END IF;
  END IF;

  IF positive_delta <> 0 OR negative_delta <> 0 THEN
    UPDATE "QaQuestion"
    SET
      "positiveVoteCount" = GREATEST(0, "positiveVoteCount" + positive_delta),
      "negativeVoteCount" = GREATEST(0, "negativeVoteCount" + negative_delta),
      "updatedAt" = timezone('UTC', clock_timestamp())
    WHERE "id" = question_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

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
  positive_delta INTEGER;
  negative_delta INTEGER;
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

  PERFORM set_config('arsnova.skip_qa_vote_reconcile', '1', true);

  IF FOUND AND vote_row."direction" = p_direction THEN
    vote_delta := CASE WHEN p_direction = 'UP' THEN -1 ELSE 1 END;
    positive_delta := CASE WHEN p_direction = 'UP' THEN -1 ELSE 0 END;
    negative_delta := CASE WHEN p_direction = 'DOWN' THEN -1 ELSE 0 END;
    DELETE FROM "QaUpvote" WHERE "id" = vote_row."id";
    "myVote" := NULL;
  ELSIF FOUND THEN
    vote_delta := CASE WHEN p_direction = 'UP' THEN 2 ELSE -2 END;
    positive_delta := CASE WHEN p_direction = 'UP' THEN 1 ELSE -1 END;
    negative_delta := CASE WHEN p_direction = 'UP' THEN -1 ELSE 1 END;
    UPDATE "QaUpvote"
    SET "direction" = p_direction, "updatedAt" = database_now
    WHERE "id" = vote_row."id";
    "myVote" := p_direction;
  ELSE
    vote_delta := CASE WHEN p_direction = 'UP' THEN 1 ELSE -1 END;
    positive_delta := CASE WHEN p_direction = 'UP' THEN 1 ELSE 0 END;
    negative_delta := CASE WHEN p_direction = 'DOWN' THEN 1 ELSE 0 END;
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
    "positiveVoteCount" = GREATEST(0, question."positiveVoteCount" + positive_delta),
    "negativeVoteCount" = GREATEST(0, question."negativeVoteCount" + negative_delta),
    "updatedAt" = database_now
  WHERE question."id" = p_question_id
  RETURNING question."upvoteCount" INTO "upvoteCount";

  PERFORM set_config('arsnova.skip_qa_vote_reconcile', '0', true);

  "questionId" := p_question_id;
  "changed" := TRUE;
  RETURN NEXT;
END;
$$;
