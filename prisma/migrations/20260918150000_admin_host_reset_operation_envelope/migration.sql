ALTER TABLE "HostAdminHandoff" ADD COLUMN IF NOT EXISTS "operationId" TEXT;
ALTER TABLE "HostAdminHandoff" ADD COLUMN IF NOT EXISTS "encryptedEnvelope" TEXT;

UPDATE "HostAdminHandoff"
SET "operationId" = gen_random_uuid()::text
WHERE "operationId" IS NULL;

ALTER TABLE "HostAdminHandoff" ALTER COLUMN "operationId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "HostAdminHandoff_operationId_key"
  ON "HostAdminHandoff"("operationId");
