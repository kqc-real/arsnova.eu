-- Bounded per-scope keep-set lookup for orphan quiz cleanup:
-- (historyScopeId, createdAt, id) covers equality on historyScopeId and
-- ordered scans of newer sessionless siblings without counting a whole scope.
DROP INDEX IF EXISTS "Quiz_historyScopeId_idx";
CREATE INDEX "Quiz_historyScopeId_createdAt_id_idx" ON "Quiz"("historyScopeId", "createdAt", "id");
