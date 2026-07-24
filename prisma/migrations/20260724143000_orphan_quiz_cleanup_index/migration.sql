-- Bounded scheduler scan for old, currently unbound quiz uploads.
CREATE INDEX "Quiz_createdAt_id_idx" ON "Quiz"("createdAt", "id");
