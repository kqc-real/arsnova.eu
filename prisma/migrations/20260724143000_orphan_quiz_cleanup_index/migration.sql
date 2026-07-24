-- Bounded scheduler scan for old, currently unbound quiz uploads.
CREATE INDEX "Quiz_createdAt_id_idx" ON "Quiz"("createdAt", "id");

-- Anti-joins used to protect every active or historical session relation.
CREATE INDEX "Session_quizId_idx" ON "Session"("quizId");
