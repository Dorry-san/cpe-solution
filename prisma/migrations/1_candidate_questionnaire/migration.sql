-- Make employer identity optional; companies are the meaningful employer record.
ALTER TABLE "User" ALTER COLUMN "firstName" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" DROP NOT NULL;

-- Optional exact tools, languages or libraries requested by the employer.
ALTER TABLE "Offer" ADD COLUMN "criticalSkills" TEXT;
