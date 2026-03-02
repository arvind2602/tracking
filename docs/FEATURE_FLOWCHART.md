# 🗂️ Employee Project Management System — Feature Flowchart

> **Stack:** Next.js 14 (App Router) · Node.js/Express · PostgreSQL · Prisma ORM  
> **Last Updated:** February 2026

---

## 🔁 System Entry Flow

```mermaid
flowchart TD
    A([🌐 User Visits App]) --> B{Authenticated?}
    B -- No --> C[/Login Page/]
    C --> D{Credentials Valid?}
    D -- No --> E[❌ Error Message]
    E --> C
    D -- Yes --> F[🎟️ JWT Token Issued]
    F --> G([🏠 Dashboard])
    B -- Yes --> G

    G --> H[📊 Performance Overview]
    G --> I[📁 Projects]
    G --> J[✅ Tasks]
    G --> K[👥 Users / Employees]
    G --> L[📈 Reports]
    G --> M[🔬 Analysis]
    G --> N[👤 Profile]
    G --> O[⚙️ Settings]
    G --> P[🏢 HR Module]
```

---

## 🔐 1. Authentication & User Management

```mermaid
flowchart LR
    AUTH([🔐 Auth Module])

    AUTH --> A1[POST /auth/login\nIssue JWT Token]
    AUTH --> A2[POST /auth/forget-password\nReset Password]
    AUTH --> A3[POST /auth/register\nCreate Employee]
    AUTH --> A4[GET /auth/profile\nView Own Profile]
    AUTH --> A5[GET /auth/:id\nView Employee by ID]
    AUTH --> A6[PUT /auth/:id\nUpdate Profile + Avatar Upload]
    AUTH --> A7[PUT /auth/:id/change-password\nChange Password]
    AUTH --> A8[DELETE /auth/:id\nDelete Employee]
    AUTH --> A9[GET /auth/organization/employees\nList Org Employees]
    AUTH --> A10[GET /auth/export\nExport Users CSV]
    AUTH --> A11[GET /auth/skills\nFetch All Skills]
```

**Key Employee Fields:** `firstName`, `lastName`, `email`, `position`, `role (ADMIN|USER)`, `skills[]`, `responsibilities[]`, `dob`, `bloodGroup`, `image`, `phoneNumber`, `emergencyContact`, `address`, `joiningDate`, `isHR`

---

## 📁 2. Project Management

```mermaid
flowchart LR
    PROJ([📁 Projects Module])

    PROJ --> P1[POST /projects\nCreate Project]
    PROJ --> P2[GET /projects\nList All Projects]
    PROJ --> P3[GET /projects/:id\nGet Project Detail]
    PROJ --> P4[PUT /projects/:id\nUpdate Project]
    PROJ --> P5[DELETE /projects/:id\nDelete Project]
    PROJ --> P6[PUT /projects/:id/hold\nPut Project On Hold]
    PROJ --> P7[PUT /projects/:id/resume\nResume Project]
    PROJ --> P8[PUT /projects/priority/update\nReorder Project Priority]
    PROJ --> P9[GET /projects/export\nExport Projects CSV]
    PROJ --> P10[GET /projects/:id/export\nExport Project Tasks]
```

**Project Lifecycle:**

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ACTIVE : Create
    ACTIVE --> ON_HOLD : Hold (with reason)
    ON_HOLD --> ACTIVE : Resume
    ACTIVE --> COMPLETED : Complete
    ON_HOLD --> COMPLETED : Complete
    COMPLETED --> [*]
```

**Project Fields:** `name`, `description`, `startDate`, `endDate`, `priority_order`, `status`, `head (Employee)`, `holdHistory[]`

---

## ✅ 3. Task Management

```mermaid
flowchart LR
    TASK([✅ Tasks Module])

    TASK --> T1[POST /tasks\nCreate Task]
    TASK --> T2[GET /tasks/:id\nGet Task Detail]
    TASK --> T3[PUT /tasks/:id\nUpdate Task]
    TASK --> T4[DELETE /tasks/:id\nDelete Task]
    TASK --> T5[PUT /tasks/assign/:id\nAssign Task to Employee]
    TASK --> T6[PUT /tasks/:id/status\nChange Task Status]
    TASK --> T7[PUT /tasks/reorder\nDrag & Drop Reorder]
    TASK --> T8[GET /tasks/projects/:pId/tasks\nTasks by Project]
    TASK --> T9[GET /tasks/employees/tasks\nTasks by Employee]
    TASK --> T10[GET /tasks/user/:id\nTasks per Employee]
    TASK --> T11[GET /tasks/export\nExport Tasks CSV]
    TASK --> T12[GET /tasks/comments/:taskId\nGet Comments]
    TASK --> T13[POST /tasks/comments/:taskId\nAdd Comment]
```

### Task Types

```mermaid
flowchart TD
    TT([Task Type])
    TT --> S[SINGLE\nOne assignee,\none completion]
    TT --> SH[SHARED\nMultiple assignees,\nall work in parallel]
    TT --> SEQ[SEQUENTIAL\nMultiple assignees,\nordered completion chain]
```

### Task Status Flow

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ToDo : Created
    ToDo --> InProgress : Start
    InProgress --> InReview : Submit for Review
    InReview --> Completed : Approved
    InReview --> InProgress : Rejected / Rework
    Completed --> [*]
```

**Task Fields:** `description`, `status`, `priority (LOW|MEDIUM|HIGH)`, `points`, `dueDate`, `order`, `type`, `parentId (SubTask)`, `assignees[]`, `comments[]`

---

## 💬 4. Comments System

```mermaid
flowchart LR
    C([💬 Comments])
    C --> C1[POST — Add comment on a task]
    C --> C2[GET — Fetch all comments for a task]
    C1 --> C3[(Linked to Task + Author)]
```

---

## 📊 5. Performance & Dashboard

```mermaid
flowchart LR
    PERF([📊 Performance Module])

    PERF --> D1[GET /performance/dashboard-all\n🚀 Consolidated Dashboard API]
    PERF --> D2[GET /performance/dashboard-summary\nSummary Counters]
    PERF --> D3[GET /performance/average-task-completion-time\nAvg Completion Time]
    PERF --> D4[GET /performance/points-leaderboard\nEmployee Points Ranking]
    PERF --> D5[GET /performance/productivity-trend\nWeekly Productivity]
    PERF --> D6[GET /performance/monthly-productivity-trend\nMonthly Trend Chart]
    PERF --> D7[GET /performance/task-completion-rate\nCompletion Rate %]
    PERF --> D8[GET /performance/recent-activity\nActivity Feed]
```

---

## 📈 6. Reports Module

```mermaid
flowchart LR
    REP([📈 Reports Module])

    REP --> R1[GET /reports/role-distribution\nADMIN vs USER breakdown]
    REP --> R2[GET /reports/task-points\nPoints earned per employee]
    REP --> R3[GET /reports/tasks-by-status\nStatus distribution counts]
    REP --> R4[GET /reports/tasks-per-employee\nWorkload per employee]
    REP --> R5[GET /reports/employee-count-per-org\nHeadcount by org]
    REP --> R6[GET /reports/projects-per-org\nProject count by org]
    REP --> R7[GET /reports/active-vs-archived-employees\nAttrition report]
```

---

## 🔬 7. Analysis Module (AI-style Insights)

```mermaid
flowchart LR
    ANA([🔬 Analysis Module])

    ANA --> AN1[GET /analytics/projects-risk\n⚠️ Projects at Risk Detection]
    ANA --> AN2[GET /analytics/task-insights\n🧠 Task Bottleneck Insights]
    ANA --> AN3[GET /analytics/employee-performance\n🏅 Employee Performance Score]
```

---

## 🏢 8. HR Module

```mermaid
flowchart TD
    HR([🏢 HR Module])

    HR --> T[📄 Document Templates]
    HR --> D[📑 Generated Documents]
    HR --> S[📊 HR Statistics]

    T --> T1[POST — Create Template]
    T --> T2[GET — List Templates]
    T --> T3[GET /:id — Template Detail]
    T --> T4[PUT /:id — Update Template]
    T --> T5[DELETE /:id — Delete Template]
    T --> T6[GET /default/:type — Get Default Template]

    D --> D1[POST — Generate Document for Employee]
    D --> D2[GET — List Generated Documents]
    D --> D3[GET /:id — Document Detail]
    D --> D4[PUT /:id — Update Document]
    D --> D5[POST /:id/upload — Upload Signed File]

    S --> S1[GET /statistics — Document Stats]
```

**Document Types:** `OFFER_LETTER` · `JOINING_LETTER` · `PROMOTION_LETTER` · `TERMINATION_LETTER` · `APPRECIATION_LETTER` · `WARNING_LETTER` · `OTHER`

**Document Status Flow:**

```mermaid
stateDiagram-v2
    direction LR
    [*] --> DRAFT : Generated
    DRAFT --> GENERATED : Finalized
    GENERATED --> SENT : Emailed
    SENT --> SIGNED : Employee Signs
    SIGNED --> ARCHIVED : Archived
```

---

## 🏗️ 9. Organization Management

```mermaid
flowchart LR
    ORG([🏗️ Organization])

    ORG --> O1[POST /organization/register\nCreate New Organization\n🔓 Public Route]
    ORG --> O2[GET /organization/settings\nFetch Org Settings]
    ORG --> O3[PUT /organization/settings\nUpdate Settings + Logo Upload]
```

---

## ⏱️ 10. Time Tracking (TimeLogs)

> Managed in the data layer — logged automatically via device check-in/check-out.

| Field | Details |
|---|---|
| `checkIn` | Timestamp of clock-in |
| `checkOut` | Timestamp of clock-out |
| `type` | `WORK`, `LUNCH`, `BREAK`, `WASHROOM`, `PERSONAL_EMERGENCY`, `HOME`, `OTHER` |
| `latitude / longitude` | Geolocation of the log |
| `deviceId / deviceType` | Device fingerprint |
| `reason` | Optional reason for log type |

---

## 🧩 11. Frontend Pages (Next.js App Router)

```mermaid
flowchart TD
    PAGES([📱 Frontend Pages])

    PAGES --> FP1[🏠 /dashboard\nMain Dashboard — KPIs + Activity]
    PAGES --> FP2[📁 /dashboard/projects\nProject List + Create + Status Management]
    PAGES --> FP3[✅ /dashboard/tasks\nAll Tasks View — Kanban / Table]
    PAGES --> FP4[✅ /dashboard/tasks/:taskId\nTask Detail — Subtasks, Comments, Assignees]
    PAGES --> FP5[👥 /dashboard/users\nEmployee Directory]
    PAGES --> FP6[👤 /dashboard/profile\nMy Profile + Edit]
    PAGES --> FP7[📈 /dashboard/reports\nReports & Charts]
    PAGES --> FP8[📊 /dashboard/performance\nPerformance Dashboard]
    PAGES --> FP9[🔬 /dashboard/analysis\nAI-style Insights]
    PAGES --> FP10[🏢 /dashboard/hr\nHR Document Center]
    PAGES --> FP11[⚙️ /dashboard/settings\nOrg & App Settings]
```

---

## 🛡️ 12. Middleware Stack

```mermaid
flowchart LR
    REQ([📥 Incoming Request]) --> AM[authMiddleware\nVerify JWT Token]
    AM --> ACT[activityMiddleware\nLog User Activity]
    ACT --> UP[uploadMiddleware\nMultipart / File Upload]
    UP --> CTRL([🎛️ Controller])
```

---

## 🗄️ 13. Data Model Overview (Entity Relationships)

```mermaid
erDiagram
    ORGANISATION ||--o{ EMPLOYEE : has
    ORGANISATION ||--o{ PROJECT : owns
    ORGANISATION ||--o{ DOCUMENT_TEMPLATE : manages
    ORGANISATION ||--o{ GENERATED_DOCUMENT : stores

    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ PROJECT_HOLD_HISTORY : tracks

    TASK ||--o{ TASK : "parent / subtask"
    TASK ||--o{ TASK_ASSIGNEE : assigned_via
    TASK ||--o{ COMMENT : has

    EMPLOYEE ||--o{ TASK_ASSIGNEE : assignee
    EMPLOYEE ||--o{ COMMENT : authors
    EMPLOYEE ||--o{ TIME_LOG : logs
    EMPLOYEE ||--o{ GENERATED_DOCUMENT : receives

    DOCUMENT_TEMPLATE ||--o{ GENERATED_DOCUMENT : source_of
```

---

## 🚦 Role-Based Access Summary

| Feature | ADMIN | USER (Employee) |
|---|:---:|:---:|
| Register Employees | ✅ | ❌ |
| Delete Employees | ✅ | ❌ |
| Create / Edit Projects | ✅ | ❌ |
| Hold / Resume Projects | ✅ | ❌ |
| Create Tasks | ✅ | ✅ |
| Assign Tasks | ✅ | ✅ |
| Update Task Status | ✅ | ✅ |
| View All Reports | ✅ | ❌ |
| HR Document Generation | ✅ (isHR) | ❌ |
| View Own Tasks | ✅ | ✅ |
| Edit Own Profile | ✅ | ✅ |
| Organization Settings | ✅ | ❌ |

---

> 💡 **Tip:** All protected routes require a valid `Authorization: Bearer <token>` header. Organization context is derived from the JWT payload — no tenant ID required in the URL.
