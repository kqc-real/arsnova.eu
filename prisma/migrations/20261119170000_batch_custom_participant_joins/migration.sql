-- Serialisiert kleine Gruppen auf derselben Sessionzeile wie der Einzelpfad.
-- Die vorhandenen Participant-Trigger vergeben Nummern und aktualisieren Revision und ersten Join.
CREATE FUNCTION arsnova_create_custom_participant_joins(
    target_session_id TEXT,
    candidates JSONB,
    replay_ttl_ms INTEGER
)
RETURNS TABLE ("participantId" TEXT, "participantNumber" INTEGER, "timerAccommodation" TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    candidate RECORD;
    joined_at TIMESTAMP(3);
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

    FOR candidate IN SELECT * FROM jsonb_to_recordset(candidates) AS input(
        id TEXT, nickname TEXT, "clientHash" TEXT, "rejoinHash" TEXT, "feedbackHash" TEXT,
        "replayHash" TEXT, envelope TEXT
    )
    LOOP
        -- Der Einzelpfad behandelt Replay, gebundene Browser und belegte Namen
        -- mit denselben Berechtigungs- und Fehlermeldungsregeln wie bisher.
        IF EXISTS (
            SELECT 1 FROM "ParticipantJoinReplay" r
            WHERE r."sessionId" = target_session_id AND r."idempotencyKeyHash" = candidate."replayHash"
        ) OR EXISTS (
            SELECT 1 FROM "Participant" p
            WHERE p."sessionId" = target_session_id
              AND (p.nickname = candidate.nickname OR p."anonymousClientIdHash" = candidate."clientHash")
        ) THEN
            CONTINUE;
        END IF;

        joined_at := timezone('UTC', clock_timestamp());
        INSERT INTO "Participant" AS inserted (
            id, "sessionId", nickname, "anonymousClientIdHash", "rejoinCapabilityHash",
            "productFeedbackClaimTokenHash", "joinedAt"
        ) VALUES (
            candidate.id, target_session_id, candidate.nickname, candidate."clientHash",
            candidate."rejoinHash", candidate."feedbackHash", joined_at
        ) RETURNING inserted.id, inserted."participantNumber", inserted."timerAccommodation"
          INTO "participantId", "participantNumber", "timerAccommodation";

        INSERT INTO "ParticipantJoinReplay" (
            id, "sessionId", "participantId", "idempotencyKeyHash", "encryptedEnvelope", "createdAt", "expiresAt"
        ) VALUES (
            gen_random_uuid()::TEXT, target_session_id, candidate.id, candidate."replayHash",
            candidate.envelope, joined_at, joined_at + replay_ttl_ms * INTERVAL '1 millisecond'
        );

        INSERT INTO "UsageStatisticOutbox" (id, kind, "sessionId", "idempotencyKey", "createdAt")
        VALUES (gen_random_uuid()::TEXT, 'PARTICIPATION', target_session_id, 'participation:' || candidate.id, joined_at);
        RETURN NEXT;
    END LOOP;
END;
$$;
