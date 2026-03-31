-- CreateTable
CREATE TABLE "PlatformStatistic" (
    "id" TEXT NOT NULL,
    "maxParticipantsSingleSession" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformStatistic_pkey" PRIMARY KEY ("id")
);

-- Eine Zeile; Startwert = historisches Maximum je Session (Participant-Zeilen pro sessionId)
INSERT INTO "PlatformStatistic" ("id", "maxParticipantsSingleSession", "updatedAt")
VALUES (
  'default',
  COALESCE(
    (SELECT MAX("c") FROM (SELECT COUNT(*)::int AS "c" FROM "Participant" GROUP BY "sessionId") AS "t"),
    0
  ),
  CURRENT_TIMESTAMP
);
