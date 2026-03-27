-- CreateEnum
CREATE TYPE "MotdStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MotdAuditAction" AS ENUM (
  'MOTD_CREATE',
  'MOTD_UPDATE',
  'MOTD_DELETE',
  'MOTD_PUBLISH',
  'MOTD_ARCHIVE_VISIBILITY',
  'MOTD_TEMPLATE_CREATE',
  'MOTD_TEMPLATE_UPDATE',
  'MOTD_TEMPLATE_DELETE'
);

-- CreateTable
CREATE TABLE "MotdTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "markdownDe" TEXT NOT NULL DEFAULT '',
    "markdownEn" TEXT NOT NULL DEFAULT '',
    "markdownFr" TEXT NOT NULL DEFAULT '',
    "markdownEs" TEXT NOT NULL DEFAULT '',
    "markdownIt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotdTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motd" (
    "id" TEXT NOT NULL,
    "status" "MotdStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "visibleInArchive" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotdLocale" (
    "id" TEXT NOT NULL,
    "motdId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,

    CONSTRAINT "MotdLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotdInteractionCounter" (
    "motdId" TEXT NOT NULL,
    "ackCount" INTEGER NOT NULL DEFAULT 0,
    "thumbUp" INTEGER NOT NULL DEFAULT 0,
    "thumbDown" INTEGER NOT NULL DEFAULT 0,
    "dismissClose" INTEGER NOT NULL DEFAULT 0,
    "dismissSwipe" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MotdInteractionCounter_pkey" PRIMARY KEY ("motdId")
);

-- CreateTable
CREATE TABLE "MotdAuditLog" (
    "id" TEXT NOT NULL,
    "action" "MotdAuditAction" NOT NULL,
    "motdId" TEXT NOT NULL,
    "adminIdentifier" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotdAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Motd_status_startsAt_endsAt_idx" ON "Motd"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Motd_visibleInArchive_endsAt_idx" ON "Motd"("visibleInArchive", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MotdLocale_motdId_locale_key" ON "MotdLocale"("motdId", "locale");

-- CreateIndex
CREATE INDEX "MotdLocale_motdId_idx" ON "MotdLocale"("motdId");

-- CreateIndex
CREATE INDEX "MotdAuditLog_motdId_createdAt_idx" ON "MotdAuditLog"("motdId", "createdAt");

-- CreateIndex
CREATE INDEX "MotdAuditLog_createdAt_idx" ON "MotdAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Motd" ADD CONSTRAINT "Motd_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MotdTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotdLocale" ADD CONSTRAINT "MotdLocale_motdId_fkey" FOREIGN KEY ("motdId") REFERENCES "Motd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotdInteractionCounter" ADD CONSTRAINT "MotdInteractionCounter_motdId_fkey" FOREIGN KEY ("motdId") REFERENCES "Motd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
