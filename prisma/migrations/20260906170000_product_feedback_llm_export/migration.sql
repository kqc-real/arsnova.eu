-- Epic 12 / Story 12.3: textfreier Audit für ProductFeedback-LLM-Exporte

CREATE TABLE "ProductFeedbackExportLog" (
    "id" TEXT NOT NULL,
    "adminIdentifier" TEXT,
    "includeMessages" BOOLEAN NOT NULL,
    "excludeDiscarded" BOOLEAN NOT NULL,
    "caseCount" INTEGER NOT NULL,
    "clusterCount" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL,
    "filterJson" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedbackExportLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductFeedbackExportLog_createdAt_idx" ON "ProductFeedbackExportLog"("createdAt");
