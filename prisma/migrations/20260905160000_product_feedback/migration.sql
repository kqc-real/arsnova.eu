-- Epic 12 / Story 12.1: ProductFeedback (anonym, getrennt von SessionFeedback)

CREATE TYPE "ProductFeedbackSource" AS ENUM ('POST_SESSION', 'IN_APP');
CREATE TYPE "ProductFeedbackRole" AS ENUM ('HOST', 'PARTICIPANT');

CREATE TABLE "ProductFeedback" (
    "id" TEXT NOT NULL,
    "source" "ProductFeedbackSource" NOT NULL DEFAULT 'POST_SESSION',
    "role" "ProductFeedbackRole" NOT NULL,
    "surveyKey" TEXT NOT NULL,
    "surveyVersion" INTEGER NOT NULL DEFAULT 1,
    "primaryAnswer" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "message" VARCHAR(300),
    "messageClearedAt" TIMESTAMP(3),
    "locale" TEXT NOT NULL,
    "appVersion" TEXT,
    "sessionKind" TEXT,
    "featureAreas" JSONB,
    "sessionSizeClass" TEXT,
    "deviceClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductFeedback_createdAt_idx" ON "ProductFeedback"("createdAt");
CREATE INDEX "ProductFeedback_surveyKey_surveyVersion_createdAt_idx" ON "ProductFeedback"("surveyKey", "surveyVersion", "createdAt");
CREATE INDEX "ProductFeedback_source_role_createdAt_idx" ON "ProductFeedback"("source", "role", "createdAt");
CREATE INDEX "ProductFeedback_primaryAnswer_createdAt_idx" ON "ProductFeedback"("primaryAnswer", "createdAt");
CREATE INDEX "ProductFeedback_area_createdAt_idx" ON "ProductFeedback"("area", "createdAt");
