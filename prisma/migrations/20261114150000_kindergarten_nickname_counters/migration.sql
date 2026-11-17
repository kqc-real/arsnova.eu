CREATE TABLE "KindergartenNicknameCounter" (
    "sessionId" TEXT NOT NULL,
    "animalId" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,

    CONSTRAINT "KindergartenNicknameCounter_pkey" PRIMARY KEY ("sessionId", "animalId")
);

ALTER TABLE "KindergartenNicknameCounter"
ADD CONSTRAINT "KindergartenNicknameCounter_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
