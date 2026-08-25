-- Preserve the exact quiz phase while a host pauses an active question.
ALTER TABLE "Session" ADD COLUMN "pausedFromStatus" "SessionStatus";
