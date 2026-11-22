BEGIN;

-- Ein bereits gesetzter Zeitstempel darf keinen weiteren Session-Write auslösen.
CREATE OR REPLACE FUNCTION arsnova_mark_first_participant_join()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE "Session"
    SET "firstParticipantJoinedAt" = NEW."joinedAt"
    WHERE id = NEW."sessionId" AND "firstParticipantJoinedAt" IS NULL;
    RETURN NEW;
END;
$$;

-- Die Revision zählt weiterhin alle Inserts. Pro INSERT und Raum reicht ein
-- Update der Sessionzeile. Löschungen nutzen weiter den bisherigen Trigger.
DROP TRIGGER "Participant_track_revision" ON "Participant";
CREATE TRIGGER "Participant_track_revision"
AFTER DELETE ON "Participant"
FOR EACH ROW
EXECUTE FUNCTION arsnova_track_participant_revision();

CREATE FUNCTION arsnova_track_inserted_participant_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected RECORD;
BEGIN
    FOR affected IN
        SELECT p."sessionId", count(*)::INTEGER AS added
        FROM inserted_participants AS p
        GROUP BY p."sessionId"
        ORDER BY p."sessionId"
    LOOP
        UPDATE "Session"
        SET "participantRevision" = "participantRevision" + affected.added
        WHERE id = affected."sessionId";
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "Participant_track_inserted_revision"
AFTER INSERT ON "Participant"
REFERENCING NEW TABLE AS inserted_participants
FOR EACH STATEMENT
EXECUTE FUNCTION arsnova_track_inserted_participant_revision();

CREATE OR REPLACE FUNCTION arsnova_create_custom_participant_joins(
    target_session_id TEXT,
    candidates JSONB,
    replay_ttl_ms INTEGER
)
RETURNS TABLE ("participantId" TEXT, "participantNumber" INTEGER, "timerAccommodation" TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    candidate RECORD;
    admitted JSONB[] := ARRAY[]::JSONB[];
    nicknames TEXT[] := ARRAY[]::TEXT[];
    browsers TEXT[] := ARRAY[]::TEXT[];
    replays TEXT[] := ARRAY[]::TEXT[];
    last_number INTEGER;
    batch_size INTEGER;
BEGIN
    PERFORM arsnova_lock_session_for_participant_join(target_session_id);

    IF NOT EXISTS (
        SELECT 1 FROM "Session" s
        WHERE s.id = target_session_id
          AND s."onboardingProfileConfigured" IS TRUE
          AND s."onboardingAllowCustomNicknames" IS TRUE
          AND s."onboardingAnonymousMode" IS FALSE
          AND s."onboardingTeamMode" IS FALSE
    ) THEN
        RETURN;
    END IF;

    FOR candidate IN
        SELECT entry.value, key.nickname, key."clientHash", key."replayHash"
        FROM jsonb_array_elements(candidates) WITH ORDINALITY AS entry(value, position)
        CROSS JOIN LATERAL jsonb_to_record(entry.value) AS key(
            nickname TEXT, "clientHash" TEXT, "replayHash" TEXT
        )
        WHERE NOT EXISTS (
            SELECT 1 FROM "ParticipantJoinReplay" r
            WHERE r."sessionId" = target_session_id AND r."idempotencyKeyHash" = key."replayHash"
        ) AND NOT EXISTS (
            SELECT 1 FROM "Participant" p
            WHERE p."sessionId" = target_session_id AND p.nickname = key.nickname
        ) AND NOT EXISTS (
            SELECT 1 FROM "Participant" p
            WHERE p."sessionId" = target_session_id AND p."anonymousClientIdHash" = key."clientHash"
        )
        ORDER BY entry.position
    LOOP
        -- Bei Konflikten innerhalb des Batches zählt der erste gültige
        -- Versuch. Abgewiesene Einträge blockieren keine späteren Kandidaten.
        IF candidate.nickname = ANY(nicknames)
            OR candidate."clientHash" = ANY(browsers)
            OR candidate."replayHash" = ANY(replays)
        THEN
            CONTINUE;
        END IF;
        admitted := array_append(admitted, candidate.value);
        nicknames := array_append(nicknames, candidate.nickname);
        IF candidate."clientHash" IS NOT NULL THEN
            browsers := array_append(browsers, candidate."clientHash");
        END IF;
        replays := array_append(replays, candidate."replayHash");
    END LOOP;

    batch_size := cardinality(admitted);
    IF batch_size = 0 THEN
        RETURN;
    END IF;

    UPDATE "Session"
    SET "nextParticipantNumber" = "nextParticipantNumber" + batch_size
    WHERE id = target_session_id
    RETURNING "nextParticipantNumber" INTO last_number;

    RETURN QUERY
    WITH selected AS MATERIALIZED (
        SELECT input.*, entry.position,
            timezone('UTC', clock_timestamp())::TIMESTAMP(3) AS joined_at
        FROM unnest(admitted) WITH ORDINALITY AS entry(value, position)
        CROSS JOIN LATERAL jsonb_to_record(entry.value) AS input(
            id TEXT, nickname TEXT, "clientHash" TEXT, "rejoinHash" TEXT,
            "feedbackHash" TEXT, "replayHash" TEXT, envelope TEXT
        )
    ), participants AS (
        INSERT INTO "Participant" AS p (
            id, "sessionId", nickname, "anonymousClientIdHash", "rejoinCapabilityHash",
            "productFeedbackClaimTokenHash", "participantNumber", "joinedAt"
        )
        SELECT s.id, target_session_id, s.nickname, s."clientHash", s."rejoinHash",
            s."feedbackHash", last_number - batch_size + s.position::INTEGER, s.joined_at
        FROM selected s
        ORDER BY s.position
        RETURNING p.id, p."participantNumber", p."timerAccommodation"
    ), replay_rows AS (
        INSERT INTO "ParticipantJoinReplay" (
            id, "sessionId", "participantId", "idempotencyKeyHash",
            "encryptedEnvelope", "createdAt", "expiresAt"
        )
        SELECT gen_random_uuid()::TEXT, target_session_id, p.id, s."replayHash",
            s.envelope, s.joined_at, s.joined_at + replay_ttl_ms * INTERVAL '1 millisecond'
        FROM selected s
        JOIN participants p ON p.id = s.id
    ), outbox_rows AS (
        INSERT INTO "UsageStatisticOutbox" (id, kind, "sessionId", "idempotencyKey", "createdAt")
        SELECT gen_random_uuid()::TEXT, 'PARTICIPATION', target_session_id, 'participation:' || p.id, s.joined_at
        FROM selected s
        JOIN participants p ON p.id = s.id
    )
    SELECT p.id, p."participantNumber", p."timerAccommodation" FROM participants p;
END;
$$;

COMMIT;
