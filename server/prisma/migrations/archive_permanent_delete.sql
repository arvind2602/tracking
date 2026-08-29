-- Archive permanent delete: allow anonymisation (SET NULL) and keep assignment history

-- Make note.authorId nullable and SET NULL on employee delete
ALTER TABLE "note" ALTER COLUMN "authorId" DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE "note" DROP CONSTRAINT IF EXISTS "note_authorId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "note" ADD CONSTRAINT "note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "employee"(id) ON DELETE SET NULL;

-- Make comment.authorId nullable and SET NULL
ALTER TABLE "comment" ALTER COLUMN "authorId" DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE "comment" DROP CONSTRAINT IF EXISTS "comment_authorId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "employee"(id) ON DELETE SET NULL;

-- Make task_assignee.employeeId nullable and SET NULL (keep history)
ALTER TABLE "task_assignee" ALTER COLUMN "employeeId" DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE "task_assignee" DROP CONSTRAINT IF EXISTS "task_assignee_employeeId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"(id) ON DELETE SET NULL;

-- Ensure qr_visit is deletable (no FK change needed, but ensure it can be purged)
-- If qr_visit has FK, ensure it does not block hard delete (delete rows explicitly before employee)
DO $$ BEGIN
  ALTER TABLE "qr_visit" DROP CONSTRAINT IF EXISTS "qr_visit_employeeId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "qr_visit" ADD CONSTRAINT "qr_visit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"(id) ON DELETE CASCADE;

-- Add index for archived queries if not exists (already exists but ensure)
CREATE INDEX IF NOT EXISTS "employee_organiationId_is_archived_idx" ON "employee"("organiationId", "is_archived");
