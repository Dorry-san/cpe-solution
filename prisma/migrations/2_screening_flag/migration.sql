-- Preserve whether the hidden interest-filter was passed, without exposing it to candidates.
ALTER TABLE "Application" ADD COLUMN "screeningPassed" BOOLEAN;
