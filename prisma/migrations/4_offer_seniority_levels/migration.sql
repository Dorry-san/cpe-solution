-- Replace free-form profile requirements by selectable experience levels.
ALTER TABLE "Offer" ADD COLUMN "seniorityLevels" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "Offer"
SET "seniorityLevels" = CASE
    WHEN "profileRequirements" ILIKE '%sénior%' OR "profileRequirements" ILIKE '%senior%'
        THEN ARRAY['Sénior']::TEXT[]
    WHEN "profileRequirements" ILIKE '%junior%'
        THEN ARRAY['Junior']::TEXT[]
    ELSE ARRAY['Confirmé']::TEXT[]
END;

ALTER TABLE "Offer" DROP COLUMN "profileRequirements";
