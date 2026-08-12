-- Multiple project heads
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "headIds" uuid[] DEFAULT ARRAY[]::uuid[];

-- Backfill existing single heads
UPDATE projects SET "headIds" = ARRAY["headId"]
WHERE "headId" IS NOT NULL
  AND ("headIds" IS NULL OR array_length("headIds", 1) IS NULL OR "headIds" = ARRAY[]::uuid[]);
