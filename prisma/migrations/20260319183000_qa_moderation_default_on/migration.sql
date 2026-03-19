-- Q&A-Kanal: Vorab-Moderation standardmäßig aktiv (neue Sessions)
ALTER TABLE "Session" ALTER COLUMN "qaModerationMode" SET DEFAULT true;
