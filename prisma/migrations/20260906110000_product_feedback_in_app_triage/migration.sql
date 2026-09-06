-- Epic 12 / Story 12.2: IN_APP-Kontext, Triage und datensparsames Audit

ALTER TYPE "ProductFeedbackRole" ADD VALUE IF NOT EXISTS 'GENERAL';

CREATE TYPE "ProductFeedbackTriageStatus" AS ENUM (
    'NEW',
    'REVIEWED',
    'PLANNED',
    'RESOLVED',
    'DISCARDED'
);

CREATE TYPE "ProductFeedbackQuarantineStatus" AS ENUM (
    'NONE',
    'FLAGGED',
    'CLEARED'
);

CREATE TYPE "ProductFeedbackAuditAction" AS ENUM (
    'STATUS_CHANGED',
    'DUPLICATE_LINKED',
    'ISSUE_LINKED',
    'ISSUE_DRAFTED',
    'RESOLUTION_LINKED',
    'QUARANTINE_CLEARED',
    'DELETED'
);

ALTER TABLE "ProductFeedback"
    ALTER COLUMN "surveyKey" DROP NOT NULL,
    ALTER COLUMN "primaryAnswer" DROP NOT NULL,
    ALTER COLUMN "message" TYPE VARCHAR(500),
    ADD COLUMN "feedbackKind" TEXT,
    ADD COLUMN "impact" TEXT,
    ADD COLUMN "routeGroup" TEXT,
    ADD COLUMN "sessionPhase" TEXT,
    ADD COLUMN "activeChannel" TEXT,
    ADD COLUMN "browserFamily" TEXT,
    ADD COLUMN "browserMajorVersion" INTEGER,
    ADD COLUMN "osFamily" TEXT,
    ADD COLUMN "onlineState" TEXT,
    ADD COLUMN "errorRequestId" TEXT,
    ADD COLUMN "triageStatus" "ProductFeedbackTriageStatus" NOT NULL DEFAULT 'NEW',
    ADD COLUMN "quarantineStatus" "ProductFeedbackQuarantineStatus" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "duplicateOfId" TEXT,
    ADD COLUMN "githubIssueNumber" INTEGER,
    ADD COLUMN "githubIssueUrl" TEXT,
    ADD COLUMN "resolvedInVersion" TEXT,
    ADD COLUMN "publicResolutionUrl" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ProductFeedbackAuditLog" (
    "id" TEXT NOT NULL,
    "productFeedbackId" TEXT NOT NULL,
    "action" "ProductFeedbackAuditAction" NOT NULL,
    "adminIdentifier" TEXT,
    "fromStatus" "ProductFeedbackTriageStatus",
    "toStatus" "ProductFeedbackTriageStatus",
    "relatedFeedbackId" TEXT,
    "issueNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedbackAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductFeedback_feedbackKind_createdAt_idx"
    ON "ProductFeedback"("feedbackKind", "createdAt");
CREATE INDEX "ProductFeedback_impact_createdAt_idx"
    ON "ProductFeedback"("impact", "createdAt");
CREATE INDEX "ProductFeedback_triageStatus_createdAt_idx"
    ON "ProductFeedback"("triageStatus", "createdAt");
CREATE INDEX "ProductFeedback_appVersion_createdAt_idx"
    ON "ProductFeedback"("appVersion", "createdAt");
CREATE INDEX "ProductFeedback_locale_createdAt_idx"
    ON "ProductFeedback"("locale", "createdAt");
CREATE INDEX "ProductFeedback_duplicateOfId_idx"
    ON "ProductFeedback"("duplicateOfId");
CREATE INDEX "ProductFeedbackAuditLog_productFeedbackId_createdAt_idx"
    ON "ProductFeedbackAuditLog"("productFeedbackId", "createdAt");
CREATE INDEX "ProductFeedbackAuditLog_createdAt_idx"
    ON "ProductFeedbackAuditLog"("createdAt");

ALTER TABLE "ProductFeedback"
    ADD CONSTRAINT "ProductFeedback_duplicateOfId_fkey"
    FOREIGN KEY ("duplicateOfId")
    REFERENCES "ProductFeedback"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
