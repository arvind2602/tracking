-- Add Area of Expertise (badge list, mirrors skills) and Years of Experience to employee
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "areaOfExpertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER;
