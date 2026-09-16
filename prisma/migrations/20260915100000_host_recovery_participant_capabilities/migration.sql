-- CreateEnum (idempotent: Produktion kann nach P3018 bereits Teil-DDL haben)
DO $$ BEGIN
    CREATE TYPE "HostCredentialStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "HostCredentialExchangeSource" AS ENUM ('RECOVERY', 'ADMIN_HANDOFF', 'LEGACY_HOST_TOKEN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'HOST_ACCESS_RESET';

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "participantNumber" INTEGER;
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "rejoinCapabilityHash" CHAR(64);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "hostCredentialVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "hostSupportId" VARCHAR(13);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "nextParticipantNumber" INTEGER NOT NULL DEFAULT 0;

-- Credential-/Support-Metadaten dürfen während der read-only Nachbereitung
-- rotieren, ohne den unveränderlichen fachlichen Sessionkern zu öffnen.
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

-- Bestehende Kennungen deterministisch nach Beitrittszeit und UUID nummerieren.
-- Neue Joins schreiben Nummer und Sessionzähler atomar in derselben Transaktion.
-- Der Active-Session-Guard blockiert sonst beendete/abgelaufene Sessions
-- (Produktion: P3018 / ARSNOVA_SESSION_ENDED). Ein DO-Block ist eine Anweisung:
-- bricht der Backfill ab, rollt DISABLE mit zurück.
DO $$
BEGIN
    ALTER TABLE "Participant" DISABLE TRIGGER "Participant_guard_active_session";
    WITH ranked AS (
        SELECT
            "id",
            ROW_NUMBER() OVER (
                PARTITION BY "sessionId"
                ORDER BY "joinedAt" ASC, "id" ASC
            )::INTEGER AS participant_number
        FROM "Participant"
    )
    UPDATE "Participant" AS participant
    SET "participantNumber" = ranked.participant_number
    FROM ranked
    WHERE participant."id" = ranked."id";
    ALTER TABLE "Participant" ENABLE TRIGGER "Participant_guard_active_session";
END $$;

DO $$
BEGIN
    ALTER TABLE "Session" DISABLE TRIGGER "Session_enforce_lifecycle";
    UPDATE "Session" AS session
    SET "nextParticipantNumber" = COALESCE((
        SELECT MAX(participant."participantNumber")
        FROM "Participant" AS participant
        WHERE participant."sessionId" = session."id"
    ), 0);
    ALTER TABLE "Session" ENABLE TRIGGER "Session_enforce_lifecycle";
END $$;

-- Rolling-/Rollback-Bridge: ältere App-Images überlassen die Nummernvergabe
-- diesem Trigger. Neue Images schreiben bereits eine Nummer und werden nicht
-- doppelt inkrementiert.
CREATE OR REPLACE FUNCTION arsnova_allocate_participant_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."participantNumber" IS NULL THEN
        UPDATE "Session"
        SET "nextParticipantNumber" = "nextParticipantNumber" + 1
        WHERE "id" = NEW."sessionId"
        RETURNING "nextParticipantNumber" INTO NEW."participantNumber";
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Participant_allocate_number"
BEFORE INSERT ON "Participant"
FOR EACH ROW
EXECUTE FUNCTION arsnova_allocate_participant_number();

ALTER TABLE "Session"
    ADD CONSTRAINT "Session_nextParticipantNumber_nonnegative"
        CHECK ("nextParticipantNumber" >= 0),
    ADD CONSTRAINT "Session_hostCredentialVersion_nonnegative"
        CHECK ("hostCredentialVersion" >= 0);

-- CreateTable
CREATE TABLE "HostCredential" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" "HostCredentialStatus" NOT NULL,
    "browserCapabilityHash" CHAR(64) NOT NULL,
    "recoveryCodeHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "HostCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostCredentialExchange" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceType" "HostCredentialExchangeSource" NOT NULL,
    "sourceCredentialId" TEXT,
    "adminHandoffId" TEXT,
    "sourceSecretHash" CHAR(64) NOT NULL,
    "exchangeIdHash" CHAR(64) NOT NULL,
    "targetCredentialId" TEXT NOT NULL,
    "encryptedEnvelope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostCredentialExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostAdminHandoff" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "capabilityHash" CHAR(64) NOT NULL,
    "targetGeneration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "HostAdminHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantJoinReplay" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT,
    "idempotencyKeyHash" CHAR(64) NOT NULL,
    "encryptedEnvelope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantJoinReplay_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HostCredential"
    ADD CONSTRAINT "HostCredential_generation_positive"
        CHECK ("generation" > 0);

ALTER TABLE "HostCredentialExchange"
    ADD CONSTRAINT "HostCredentialExchange_bounded_expiry"
        CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '15 minutes');

ALTER TABLE "HostAdminHandoff"
    ADD CONSTRAINT "HostAdminHandoff_bounded_expiry"
        CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '15 minutes');

ALTER TABLE "ParticipantJoinReplay"
    ADD CONSTRAINT "ParticipantJoinReplay_bounded_expiry"
        CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '10 minutes');

-- CreateIndex
CREATE UNIQUE INDEX "HostCredential_browserCapabilityHash_key" ON "HostCredential"("browserCapabilityHash");

-- CreateIndex
CREATE UNIQUE INDEX "HostCredential_recoveryCodeHash_key" ON "HostCredential"("recoveryCodeHash");

-- CreateIndex
CREATE INDEX "HostCredential_sessionId_status_idx" ON "HostCredential"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HostCredential_sessionId_generation_key" ON "HostCredential"("sessionId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "HostCredentialExchange_sessionId_key" ON "HostCredentialExchange"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "HostCredentialExchange_adminHandoffId_key" ON "HostCredentialExchange"("adminHandoffId");

-- CreateIndex
CREATE UNIQUE INDEX "HostCredentialExchange_targetCredentialId_key" ON "HostCredentialExchange"("targetCredentialId");

-- CreateIndex
CREATE INDEX "HostCredentialExchange_expiresAt_idx" ON "HostCredentialExchange"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HostCredentialExchange_sessionId_sourceSecretHash_exchangeI_key" ON "HostCredentialExchange"("sessionId", "sourceSecretHash", "exchangeIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "HostAdminHandoff_capabilityHash_key" ON "HostAdminHandoff"("capabilityHash");

-- CreateIndex
CREATE INDEX "HostAdminHandoff_sessionId_expiresAt_idx" ON "HostAdminHandoff"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "ParticipantJoinReplay_expiresAt_idx" ON "ParticipantJoinReplay"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantJoinReplay_sessionId_idempotencyKeyHash_key" ON "ParticipantJoinReplay"("sessionId", "idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_rejoinCapabilityHash_key" ON "Participant"("rejoinCapabilityHash");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_sessionId_participantNumber_key" ON "Participant"("sessionId", "participantNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Session_hostSupportId_key" ON "Session"("hostSupportId");

-- AddForeignKey
ALTER TABLE "HostCredential" ADD CONSTRAINT "HostCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostCredentialExchange" ADD CONSTRAINT "HostCredentialExchange_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostCredentialExchange" ADD CONSTRAINT "HostCredentialExchange_sourceCredentialId_fkey" FOREIGN KEY ("sourceCredentialId") REFERENCES "HostCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostCredentialExchange" ADD CONSTRAINT "HostCredentialExchange_adminHandoffId_fkey" FOREIGN KEY ("adminHandoffId") REFERENCES "HostAdminHandoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostCredentialExchange" ADD CONSTRAINT "HostCredentialExchange_targetCredentialId_fkey" FOREIGN KEY ("targetCredentialId") REFERENCES "HostCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostAdminHandoff" ADD CONSTRAINT "HostAdminHandoff_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantJoinReplay" ADD CONSTRAINT "ParticipantJoinReplay_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantJoinReplay" ADD CONSTRAINT "ParticipantJoinReplay_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

