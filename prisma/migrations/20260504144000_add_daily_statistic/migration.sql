-- CreateTable
CREATE TABLE "DailyStatistic" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "maxParticipantsSingleSession" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyStatistic_date_key" ON "DailyStatistic"("date");