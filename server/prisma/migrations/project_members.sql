-- Project team members (many-to-many between projects and employees).
-- Heads (projects.headIds) are implicit members and are NOT stored here.
-- Applied via scripts/migrate.js (npm run db:schema);
-- safety net in utils/schemaGuard.js (ensureProjectMemberTable).

CREATE TABLE IF NOT EXISTS project_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "employeeId" UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT project_member_project_employee_key UNIQUE ("projectId", "employeeId")
);

CREATE INDEX IF NOT EXISTS project_member_employeeId_idx ON project_member("employeeId");
