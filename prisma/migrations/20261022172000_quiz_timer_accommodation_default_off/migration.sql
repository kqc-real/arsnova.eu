-- Neue Quizzes speichern persönliche Zeit standardmäßig aus.
-- Bestehende Zeilen bleiben unverändert.
ALTER TABLE "Quiz" ALTER COLUMN "enableTimerAccommodation" SET DEFAULT false;
