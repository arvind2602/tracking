-- Create Enum
DO $$ BEGIN
    CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status "ProjectStatus" DEFAULT 'ACTIVE';

-- Create Hold History Table
CREATE TABLE IF NOT EXISTS project_hold_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "startDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "endDate" TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Index
CREATE INDEX IF NOT EXISTS idx_project_hold_project ON project_hold_history("projectId");
