-- Epic 12 / Story 12.4: textfreier Audit für ProductFeedback-Massenlöschung

CREATE TABLE "ProductFeedbackPurgeLog" (
    "id" TEXT NOT NULL,
    "adminIdentifier" TEXT,
    "scope" TEXT NOT NULL,
    "untilCreatedAt" TIMESTAMP(3),
    "deletedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedbackPurgeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductFeedbackPurgeLog_createdAt_idx" ON "ProductFeedbackPurgeLog"("createdAt");
