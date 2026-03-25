-- AlterTable (IF NOT EXISTS: vermeidet Konflikt, wenn die Spalte schon durch prisma db push / ensure-schema existiert)
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "motifImageUrl" TEXT;
