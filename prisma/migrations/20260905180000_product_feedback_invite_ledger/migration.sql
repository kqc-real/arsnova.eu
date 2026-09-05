-- ProductFeedback Invite-Ledger + Job-Queue (Story 12.1 Admin-Quote / Finish-Robustheit)

CREATE TABLE "ProductFeedbackInviteLedger" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "role" "ProductFeedbackRole" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductFeedbackInviteLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductFeedbackInviteLedger_day_role_key" ON "ProductFeedbackInviteLedger"("day", "role");
CREATE INDEX "ProductFeedbackInviteLedger_day_idx" ON "ProductFeedbackInviteLedger"("day");

CREATE TABLE "ProductFeedbackInviteJob" (
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    CONSTRAINT "ProductFeedbackInviteJob_pkey" PRIMARY KEY ("sessionId")
);

CREATE INDEX "ProductFeedbackInviteJob_completedAt_createdAt_idx" ON "ProductFeedbackInviteJob"("completedAt", "createdAt");
