CREATE TABLE "HiddenWordCloudEntry" (
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "HiddenWordCloudEntry_pkey" PRIMARY KEY ("sessionId", "questionId", "labelKey")
);

CREATE INDEX "HiddenWordCloudEntry_questionId_idx" ON "HiddenWordCloudEntry"("questionId");

ALTER TABLE "HiddenWordCloudEntry" ADD CONSTRAINT "HiddenWordCloudEntry_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiddenWordCloudEntry" ADD CONSTRAINT "HiddenWordCloudEntry_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
