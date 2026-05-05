ALTER TABLE "Quiz"
ADD COLUMN "historyScopeId" UUID;

CREATE INDEX "Quiz_historyScopeId_idx" ON "Quiz"("historyScopeId");
