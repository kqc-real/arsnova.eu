ALTER TABLE "SessionLearningObjective"
ADD COLUMN "inferenceInputQuestionIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
