-- Vollständiges Schema aus prisma/schema.prisma.
-- Idempotent: leere DB und bestehende DBs (alte Migrationen / db push).
--
-- Nach fehlgeschlagenem ersten Lauf (P3018): auf dem Server einmal
--   npx prisma migrate resolve --rolled-back 20250220100000_baseline_schema
-- (im App-Container wie deploy.sh Schritt 4), dann Commit deployen und erneut `migrate deploy`.

CREATE SCHEMA IF NOT EXISTS "public";

-- Enums (PostgreSQL: kein CREATE TYPE IF NOT EXISTS für ENUM)
DO $$ BEGIN CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'FREETEXT', 'SURVEY', 'RATING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SessionStatus" AS ENUM ('LOBBY', 'QUESTION_OPEN', 'ACTIVE', 'PAUSED', 'RESULTS', 'DISCUSSION', 'FINISHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NicknameTheme" AS ENUM ('NOBEL_LAUREATES', 'KINDERGARTEN', 'PRIMARY_SCHOOL', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TeamAssignment" AS ENUM ('AUTO', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SessionType" AS ENUM ('QUIZ', 'Q_AND_A'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QaVoteDirection" AS ENUM ('UP', 'DOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QaQuestionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PINNED', 'ARCHIVED', 'DELETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AdminAuditAction" AS ENUM ('SESSION_DELETE', 'EXPORT_FOR_AUTHORITIES'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "motifImageUrl" TEXT,
    "showLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "allowCustomNicknames" BOOLEAN NOT NULL DEFAULT true,
    "defaultTimer" INTEGER,
    "enableSoundEffects" BOOLEAN NOT NULL DEFAULT true,
    "enableRewardEffects" BOOLEAN NOT NULL DEFAULT true,
    "enableMotivationMessages" BOOLEAN NOT NULL DEFAULT true,
    "enableEmojiReactions" BOOLEAN NOT NULL DEFAULT true,
    "anonymousMode" BOOLEAN NOT NULL DEFAULT false,
    "teamMode" BOOLEAN NOT NULL DEFAULT false,
    "teamCount" INTEGER,
    "teamAssignment" "TeamAssignment" NOT NULL DEFAULT 'AUTO',
    "teamNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "backgroundMusic" TEXT,
    "nicknameTheme" "NicknameTheme" NOT NULL DEFAULT 'NOBEL_LAUREATES',
    "bonusTokenCount" INTEGER,
    "readingPhaseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preset" TEXT NOT NULL DEFAULT 'PLAYFUL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "timer" INTEGER,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "ratingMin" INTEGER,
    "ratingMax" INTEGER,
    "ratingLabelMin" TEXT,
    "ratingLabelMax" TEXT,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnswerOption" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "questionId" TEXT NOT NULL,
    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'QUIZ',
    "status" "SessionStatus" NOT NULL DEFAULT 'LOBBY',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "moderationMode" BOOLEAN NOT NULL DEFAULT false,
    "qaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "qaTitle" TEXT,
    "qaModerationMode" BOOLEAN NOT NULL DEFAULT true,
    "quickFeedbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currentQuestion" INTEGER,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "quizId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "legalHoldUntil" TIMESTAMP(3),
    "legalHoldReason" TEXT,
    "legalHoldSetAt" TIMESTAMP(3),
    "answerDisplayOrder" JSONB,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Participant" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Vote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "freeText" TEXT,
    "ratingValue" INTEGER,
    "responseTimeMs" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "streakBonus" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "round" INTEGER NOT NULL DEFAULT 1,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VoteAnswer" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "answerOptionId" TEXT NOT NULL,
    CONSTRAINT "VoteAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BonusToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "quizName" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SessionFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "questionQualityRating" INTEGER,
    "wouldRepeat" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QaQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "status" "QaQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QaQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QaUpvote" (
    "id" TEXT NOT NULL,
    "qaQuestionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "direction" "QaVoteDirection" NOT NULL DEFAULT 'UP',
    CONSTRAINT "QaUpvote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "adminIdentifier" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- Bestehende Tabellen aus älteren Deploys: fehlende Spalten nachziehen
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "motifImageUrl" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "teamNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "preset" TEXT NOT NULL DEFAULT 'PLAYFUL';
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "readingPhaseEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "currentRound" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "legalHoldUntil" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "legalHoldReason" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "legalHoldSetAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "answerDisplayOrder" JSONB;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaModerationMode" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "quickFeedbackEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "streakCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "streakBonus" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS "Question_quizId_order_idx" ON "Question"("quizId", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_code_key" ON "Session"("code");
CREATE INDEX IF NOT EXISTS "Session_status_startedAt_id_idx" ON "Session"("status", "startedAt", "id");
CREATE INDEX IF NOT EXISTS "Session_status_endedAt_idx" ON "Session"("status", "endedAt");
CREATE INDEX IF NOT EXISTS "Session_legalHoldUntil_idx" ON "Session"("legalHoldUntil");
CREATE UNIQUE INDEX IF NOT EXISTS "Participant_sessionId_nickname_key" ON "Participant"("sessionId", "nickname");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_sessionId_name_key" ON "Team"("sessionId", "name");
CREATE INDEX IF NOT EXISTS "Vote_sessionId_questionId_round_idx" ON "Vote"("sessionId", "questionId", "round");
CREATE INDEX IF NOT EXISTS "Vote_participantId_votedAt_idx" ON "Vote"("participantId", "votedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_sessionId_participantId_questionId_round_key" ON "Vote"("sessionId", "participantId", "questionId", "round");
CREATE UNIQUE INDEX IF NOT EXISTS "VoteAnswer_voteId_answerOptionId_key" ON "VoteAnswer"("voteId", "answerOptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "BonusToken_token_key" ON "BonusToken"("token");
CREATE INDEX IF NOT EXISTS "BonusToken_generatedAt_idx" ON "BonusToken"("generatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SessionFeedback_sessionId_participantId_key" ON "SessionFeedback"("sessionId", "participantId");
CREATE INDEX IF NOT EXISTS "QaQuestion_sessionId_status_createdAt_idx" ON "QaQuestion"("sessionId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "QaQuestion_sessionId_participantId_idx" ON "QaQuestion"("sessionId", "participantId");
CREATE UNIQUE INDEX IF NOT EXISTS "QaUpvote_qaQuestionId_participantId_key" ON "QaUpvote"("qaQuestionId", "participantId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_sessionCode_createdAt_idx" ON "AdminAuditLog"("sessionCode", "createdAt");

DO $$ BEGIN ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Session" ADD CONSTRAINT "Session_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Participant" ADD CONSTRAINT "Participant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Team" ADD CONSTRAINT "Team_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Vote" ADD CONSTRAINT "Vote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VoteAnswer" ADD CONSTRAINT "VoteAnswer_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VoteAnswer" ADD CONSTRAINT "VoteAnswer_answerOptionId_fkey" FOREIGN KEY ("answerOptionId") REFERENCES "AnswerOption"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BonusToken" ADD CONSTRAINT "BonusToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BonusToken" ADD CONSTRAINT "BonusToken_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QaQuestion" ADD CONSTRAINT "QaQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QaQuestion" ADD CONSTRAINT "QaQuestion_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QaUpvote" ADD CONSTRAINT "QaUpvote_qaQuestionId_fkey" FOREIGN KEY ("qaQuestionId") REFERENCES "QaQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QaUpvote" ADD CONSTRAINT "QaUpvote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
