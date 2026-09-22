-- Ein Browser-Client (anonymousClientId) darf pro Session höchstens eine Teilnahme haben.
ALTER TABLE "Participant" ADD COLUMN "anonymousClientIdHash" CHAR(64);

CREATE UNIQUE INDEX "Participant_sessionId_anonymousClientIdHash_key"
  ON "Participant"("sessionId", "anonymousClientIdHash");
