-- Story 12.1: teilnehmerspezifischer Claim-Nachweis und DB-seitige Submit-Idempotenz.

ALTER TABLE "Participant"
ADD COLUMN "productFeedbackClaimTokenHash" CHAR(64);

CREATE UNIQUE INDEX "Participant_productFeedbackClaimTokenHash_key"
ON "Participant"("productFeedbackClaimTokenHash");

ALTER TABLE "ProductFeedback"
ADD COLUMN "inviteFingerprint" CHAR(64),
ADD COLUMN "submitIdempotencyHash" CHAR(64),
ADD COLUMN "followUpIdempotencyHash" CHAR(64);

CREATE UNIQUE INDEX "ProductFeedback_inviteFingerprint_key"
ON "ProductFeedback"("inviteFingerprint");

CREATE UNIQUE INDEX "ProductFeedback_submitIdempotencyHash_key"
ON "ProductFeedback"("submitIdempotencyHash");

CREATE UNIQUE INDEX "ProductFeedback_followUpIdempotencyHash_key"
ON "ProductFeedback"("followUpIdempotencyHash");
