-- ADR-0022: Tempo-Livekanal (Story 8.8)
ALTER TABLE "Session" ADD COLUMN "tempoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN "tempoOpen" BOOLEAN NOT NULL DEFAULT false;
