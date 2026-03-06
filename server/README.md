# Vighnotech API Server

Employee tracking, project management, and task assignment backend built with Express.js and PostgreSQL.

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** (Neon.tech hosted)
- **Cloudinary** account (for image uploads)

## Setup

1. **Clone the repository**
2. **Install dependencies:**
   ```bash
   cd server && npm install
   ```
3. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Then fill in your actual credentials. Generate a strong JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
4. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```
5. **Start development server:**
   ```bash
   npm run dev
   ```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (auto-restart on changes) |
| `npm start` | Production start |
| `npm run lint` | Run ESLint checks |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Generate Prisma client |

## Project Structure

```
server/
├── config/            # Database, JWT, Cloudinary, environment configuration
│   ├── cloudinary.js  # Image upload config (reads from env vars)
│   ├── db.js          # PostgreSQL connection pool
│   ├── env.js         # Centralized environment variable validation
│   └── jwtConfig.js   # JWT signing configuration
├── controller/        # Route handlers organized by domain
│   ├── auth/          # Authentication, employee CRUD, password management
│   ├── projects/      # Project CRUD, priority ordering, hold/resume
│   ├── task/          # Task CRUD, comments, assignments, sequential tasks
│   ├── analytics/     # Dashboard analytics and metrics
│   ├── performance/   # Employee performance scoring
│   ├── reports/       # Report generation and exports
│   ├── projects/      # Project management logic
│   ├── auth/          # Authentication handlers
│   └── ...            # Other modules
│   ├── organization/  # Organization settings and configuration
│   └── routes.js      # Central route aggregator
├── middleware/        # Express middleware
│   ├── authMiddleware.js    # JWT verification and user extraction
│   ├── activityMiddleware.js # Request activity logging
│   └── uploadMiddleware.js  # Multer file upload config
├── prisma/            # Database schema and migrations
│   ├── schema.prisma  # Database models
│   └── migrations/    # Migration history
├── utils/             # Shared utilities
│   ├── errorHandler.js    # Global error handler
│   ├── errors.js          # Custom error classes (BadRequest, NotFound, etc.)
│   ├── jwtGenerator.js    # JWT token creation
│   ├── logger.js          # Winston logging configuration
│   └── queryBuilders.js   # Shared SQL CTE builders and transaction helper
└── index.js           # Server entry point
```

## API Endpoints

See [API_REFERENCE.md](../docs/API_REFERENCE.md) for full endpoint documentation.

### Quick Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/register` | Yes | Register new employee |
| GET | `/api/auth/profile` | Yes | Get current user profile |
| GET | `/api/auth/organization` | Yes | List employees in org |
| GET | `/api/projects` | Yes | List org projects |
| POST | `/api/projects` | Yes | Create project |
| GET | `/api/tasks/projects/:id/tasks` | Yes | List tasks in project |
| POST | `/api/tasks` | Yes | Create task |
| PUT | `/api/tasks/:id/status` | Yes | Update task status |

## Environment Variables

See `.env.example` for the complete list. All variables prefixed with `CLOUDINARY_` and `JWT_SECRET` are **required**.

## Data Access Pattern

**Prisma** is used for schema management and migrations. **Raw `pg` queries** are used for all data access in controllers, with parameterized queries to prevent SQL injection. This is intentional — Prisma's query builder doesn't support all the complex CTEs and window functions used in analytics.

## Error Handling

All controllers use Express's `next(error)` pattern. Custom error classes in `utils/errors.js`:
- `BadRequestError` (400) — validation failures
- `NotFoundError` (404) — resource not found
- `UnprocessableEntityError` (422) — business logic violations

The global `errorHandler` middleware catches all errors and returns consistent JSON responses.
