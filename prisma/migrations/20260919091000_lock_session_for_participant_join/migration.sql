-- Join serialisiert über die Sessionzeile. Nach Quiz-FINISHED bleibt das
-- zulässig, solange Q&A noch beitrittsfähig ist.
CREATE OR REPLACE FUNCTION arsnova_lock_session_for_participant_join(session_id TEXT)
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

  database_now := timezone('UTC', clock_timestamp());
  IF arsnova_session_qa_channel_joinable(session_row) THEN
    RETURN;
  END IF;

  IF session_row."endedAt" IS NOT NULL
    OR session_row."status" = 'FINISHED'
    OR database_now >= session_row."expiresAt"
  THEN
    RAISE EXCEPTION 'ARSNOVA_SESSION_ENDED'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;
