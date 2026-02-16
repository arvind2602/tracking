# API Reference

**Base URL:** Configured via `NEXT_PUBLIC_API_URL` (default: `https://tasksb.vercel.app/api`)

All protected routes require `Authorization: Bearer <token>` header.

---

## Authentication

### POST `/api/auth/login`
Authenticate a user and receive a JWT token.

**Request Body:**
| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string (email) | Yes | User email address |
| `password` | string (min 4) | Yes | User password |
| `datetime` | string (ISO 8601) | Yes | Client timestamp for activity tracking |

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "role": "ADMIN | USER",
    "organiationId": "uuid"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:** `400` validation, `422` invalid credentials

---

### POST `/api/auth/register`
Register a new employee. **Requires authentication.**

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `firstName` | string | Yes |
| `lastName` | string | Yes |
| `email` | string (email) | Yes |
| `password` | string (min 6) | Yes |
| `position` | string | Yes |
| `role` | `ADMIN` \| `USER` | Yes |
| `phoneNumber` | string | No |
| `emergencyContact` | string | No |
| `address` | string | No |
| `dob` | string (ISO 8601) | No |
| `bloodGroup` | string | No |
| `skills` | string[] | No |
| `responsibilities` | string[] | No |

**Response (201):** Created employee object

---

### POST `/api/auth/forget-password`
Request a password reset.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `email` | string (email) | Yes |

**Response (200):** `{ "message": "Reset link sent" }`

---

### GET `/api/auth/profile`
Get the authenticated user's profile.

**Response (200):** Employee object with organization name

---

### GET `/api/auth/:id`
Get an employee by ID.

**Response (200):** Employee object  
**Errors:** `404` not found

---

### PUT `/api/auth/:id`
Update an employee. Supports multipart form data for image upload.

**Content-Type:** `multipart/form-data`

**Fields:**
| Field | Type | Required |
|---|---|---|
| `firstName` | string | No |
| `lastName` | string | No |
| `email` | string | No |
| `position` | string | No |
| `role` | string | No |
| `image` | File | No |
| `phoneNumber` | string | No |
| `emergencyContact` | string | No |
| `address` | string | No |
| `dob` | string | No |
| `bloodGroup` | string | No |
| `skills` | string (JSON array) | No |
| `responsibilities` | string (JSON array) | No |
| `joiningDate` | string | No |
| `isHR` | boolean | No |

---

### PUT `/api/auth/:id/change-password`
Change an employee's password.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `currentPassword` | string | Yes |
| `newPassword` | string (min 6) | Yes |

---

### DELETE `/api/auth/:id`
Delete an employee. Cascading delete removes related data.

---

### GET `/api/auth/organization`
List all employees in the authenticated user's organization.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `sortBy` | string | Column to sort by (`name`, `email`, `position`, `role`, `joiningDate`, `weeklyPoints`, `yesterdayPoints`) |
| `sortOrder` | `ASC` \| `DESC` | Sort direction |

---

### GET `/api/auth/export`
Export employees as CSV.

---

### GET `/api/auth/skills`
List all unique skills across the organization.

---

## Projects

### GET `/api/projects`
List all projects for the organization.

**Response (200):** Array of project objects with stats

---

### POST `/api/projects`
Create a new project.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `name` | string | Yes |
| `description` | string | No |
| `startDate` | string (ISO 8601) | Yes |
| `headId` | string (UUID) | No |

---

### GET `/api/projects/:id`
Get project details with analytics.

---

### PUT `/api/projects/:id`
Update a project.

---

### DELETE `/api/projects/:id`
Delete a project and all related tasks.

---

### PUT `/api/projects/:id/hold`
Put a project on hold.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `reason` | string | Yes |

---

### PUT `/api/projects/:id/resume`
Resume a held project.

---

### PUT `/api/projects/priority/update`
Update priority ordering for multiple projects.

**Request Body:**
```json
{
  "projects": [
    { "id": "uuid", "priority_order": 1 },
    { "id": "uuid", "priority_order": 2 }
  ]
}
```

---

### GET `/api/projects/export`
Export all projects as CSV.

---

### GET `/api/projects/:id/export`
Export a single project's tasks as CSV.

---

## Tasks

### POST `/api/tasks`
Create a new task.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `description` | string | Yes |
| `projectId` | string (UUID) | Yes |
| `assignedTo` | string (UUID) | No |
| `points` | number | No |
| `status` | string | No (default: `pending`) |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` | No |
| `dueDate` | string (ISO 8601) | No |
| `parentId` | string (UUID) | No (for subtasks) |
| `type` | `SINGLE` \| `SHARED` \| `SEQUENTIAL` | No (default: `SINGLE`) |
| `assignees` | string[] (UUIDs) | No (for SHARED/SEQUENTIAL) |

---

### GET `/api/tasks/:id`
Get task details with subtasks and assignees.

---

### PUT `/api/tasks/:id`
Update a task. Supports sequential task hand-off.

---

### DELETE `/api/tasks/:id`
Delete a task and all related data (comments, subtasks, assignees).

---

### PUT/PATCH `/api/tasks/:id/status`
Change task status. Handles sequential task progression.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `status` | string | Yes |

---

### GET `/api/tasks/projects/:projectId/tasks`
List tasks for a project with pagination.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |
| `status` | string | Filter by status |
| `priority` | string | Filter by priority |
| `assignedTo` | string | Filter by assignee |
| `parentId` | string | Filter subtasks |
| `sortBy` | string | Column to sort by |
| `sortOrder` | `ASC` \| `DESC` | Sort direction |

---

### GET `/api/tasks/employees/tasks`
Get tasks assigned to the current user.

---

### GET `/api/tasks/user/:id`
Get tasks for a specific employee (org-scoped).

---

### POST `/api/tasks/comments/:taskId`
Add a comment to a task.

**Request Body:**
| Field | Type | Required |
|---|---|---|
| `content` | string | Yes |

---

### GET `/api/tasks/comments/:taskId`
Get all comments for a task.

---

### PUT `/api/tasks/assign/:id`
Assign a task to an employee.

---

### PUT/PATCH `/api/tasks/reorder`
Reorder tasks.

**Request Body:**
```json
{
  "tasks": [
    { "id": "uuid", "order": 1 },
    { "id": "uuid", "order": 2 }
  ]
}
```

---

### GET `/api/tasks/export`
Export tasks as CSV.

---

## Organization

### GET `/api/organization/settings`
Get organization settings (name, logo, etc.).

### PUT `/api/organization/settings`
Update organization settings.

---

## Analytics

### GET `/api/analytics/dashboard`
Get dashboard analytics (task counts, completion rates, project stats).

---

## Performance

### GET `/api/performance/employee/:id`
Get performance metrics for an employee.

---

## Reports

### GET `/api/reports`
Generate reports.

---

## Error Response Format

All error responses follow this format:
```json
{
  "error": {
    "message": "Human-readable error message",
    "status": 400
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Bad Request — validation error |
| 401 | Unauthorized — missing/invalid token |
| 404 | Not Found — resource doesn't exist |
| 422 | Unprocessable Entity — business logic error |
| 500 | Internal Server Error |
