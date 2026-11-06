-- Convert scores generated before the /10 scoring change.
UPDATE "Test"
SET "totalScore" = "totalScore" / 10
WHERE "totalScore" > 10;

UPDATE "Test"
SET "criteriaScores" = (
    SELECT jsonb_agg(
        CASE
            WHEN jsonb_typeof(item -> 'score') = 'number'
                 AND (item ->> 'score')::numeric > 10
                THEN jsonb_set(
                    item,
                    '{score}',
                    to_jsonb(round((item ->> 'score')::numeric / 10))
                )
            ELSE item
        END
    )
    FROM jsonb_array_elements("criteriaScores") AS item
)
WHERE jsonb_typeof("criteriaScores") = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements("criteriaScores") AS item
      WHERE jsonb_typeof(item -> 'score') = 'number'
        AND (item ->> 'score')::numeric > 10
  );

UPDATE "Application" AS application
SET "screeningPassed" = COALESCE(
    application."screeningPassed",
    screening."totalScore" >= 7
)
FROM "Test" AS screening
WHERE screening."applicationId" = application.id
  AND screening.type = 'SCREENING'
  AND screening.status = 'EVALUATED'
  AND screening."totalScore" IS NOT NULL
  AND application."screeningPassed" IS NULL;

UPDATE "Application" AS application
SET status = CAST(
    CASE
        WHEN application."screeningPassed" = false AND main."totalScore" <= 5
            THEN 'REJECTED'
        ELSE 'RESULTS_READY'
    END AS "ApplicationStatus"
)
FROM "Test" AS main
WHERE main."applicationId" = application.id
  AND main.type = 'MAIN'
  AND main.status = 'EVALUATED'
  AND main."totalScore" IS NOT NULL
  AND application.status IN ('SCREENING_FAILED', 'RESULTS_READY');
