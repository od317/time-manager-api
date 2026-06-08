# ⏱️ TimeFlow - Backend API

REST API for the TimeFlow time management application. Built with Express.js, Prisma ORM, and PostgreSQL.

## 🚀 Tech Stack

| Category       | Technology                              |
| -------------- | --------------------------------------- |
| **Runtime**    | Node.js                                 |
| **Framework**  | Express.js                              |
| **ORM**        | Prisma                                  |
| **Database**   | PostgreSQL                              |
| **Auth**       | JWT (JSON Web Tokens)                   |
| **AI**         | OpenRouter (multi-model fallback)       |
| **Validation** | Manual (with Prisma schema constraints) |

## 📦 Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
cd backend
npm install
```

````

### Environment Variables

Create a `.env` file:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/timemanager"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Frontend URL
CLIENT_URL=http://localhost:3000

# AI (OpenRouter)
OPENROUTER_API_KEY=your-openrouter-api-key
```

### Database Setup

```bash
# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### Development

```bash
npm run dev
```

Server runs on `http://localhost:5000`

---

## 📊 Database Models

### User

- JWT authentication with email/password
- Timezone stored for date calculations
- Linked settings for defaults (grace periods, auto-fail, timer modes)
- Email verification and password reset tokens

### Goal

- **Hierarchical**: Infinite nesting via `parentId` self-reference
- **Types**: `quantity`, `time`, `project`
- **Status flow**: `ACTIVE → OVERDUE → COMPLETED` or `ACTIVE → OVERDUE → FAILED`
- Target values with progress tracking and color coding
- Start/end dates with deadline types (HARD/SOFT)
- Recurring support with custom rules
- Color cascades to all descendant sub-goals and tasks

### Task

- Belongs to a goal (or standalone)
- **Status flow**: `TODO → IN_PROGRESS → OVERDUE → COMPLETED/FAILED`
- Priority levels, estimated time, due dates
- Color inherited from parent goal
- Quantity tracking with check-ins
- Grace periods and auto-fail configuration

### Habit

- **Frequency types**: `DAILY`, `WEEKLY`, `CUSTOM`
- Day selection for weekly/custom habits (`[0-6]` for Sun-Sat)
- Streak tracking (current, longest) with automatic calculation
- Amount tracking with target values
- Rollover support (configurable max days)
- Multiple completions per day (`timesPerDay`)

### HabitLog

- Daily completion records (unique per habit per date)
- **Status**: `COMPLETED`, `SKIPPED`, `MISSED`, `ROLLOVER`
- Optional value and notes
- Rollover tracking with source date

### TimeEntry

- Timer sessions linked to goals/tasks/habits
- **Entry types**: `TIMER`, `MANUAL`, `POMODORO`
- **Status**: `RUNNING`, `PAUSED`, `COMPLETED`
- Auto-inherits `goalId` from linked task
- Duration in seconds with formatted output

---

## 🔄 Status Flows

### Goal Status Flow

```
ACTIVE ──────────────────────────────────────────► COMPLETED
  │                                                    ▲
  │ (past end date)                                    │
  ▼                                                    │
OVERDUE ─── (user completes) ─────────────────────────┘
  │
  │ (30 days overdue + auto-fail)
  ▼
FAILED
```

- **ACTIVE → OVERDUE**: When `endDate` passes without completion
- **OVERDUE → COMPLETED**: User finishes the goal
- **OVERDUE → FAILED**: Auto-failed after 30 days
- **OVERDUE → ACTIVE**: User extends `endDate` to future
- **FAILED goals**: Locked (only archive allowed)

### Task Status Flow

```
TODO ──────► IN_PROGRESS ──────► COMPLETED
  │              │                    ▲
  │              │                    │
  └──────────────┴──────► OVERDUE ───┘
                            │
                            ▼ (manual only)
                          FAILED
```

- Tasks stay `OVERDUE` indefinitely until user action
- No auto-fail for tasks (user maintains control)

### Habit Streak Calculation

- Streaks calculated backwards from today
- Consecutive `COMPLETED` logs = current streak
- Gap in logs breaks the streak
- Rollover logs count as completions for the rolled-over date

---

## 🔌 API Endpoints

### Authentication

```
POST   /api/auth/register     - Register new user
POST   /api/auth/login         - Login user
GET    /api/auth/me            - Get current user
POST   /api/auth/logout        - Logout user
```

### Goals

```
GET    /api/goals              - Get all goals (?status=ACTIVE,OVERDUE&paginated=false)
GET    /api/goals/:id          - Get single goal with recursive time tracking
POST   /api/goals              - Create goal
PUT    /api/goals/:id          - Update goal (with status rules & color cascade)
DELETE /api/goals/:id          - Delete goal (cascades to children/tasks)
PUT    /api/goals/reorder      - Reorder goals (drag & drop)
GET    /api/goals/:id/stats    - Get goal statistics (recursive tasks/time)
```

### Tasks

```
GET    /api/tasks              - Get tasks (?status=TODO,IN_PROGRESS&goalId=xxx&date=2026-06-08)
POST   /api/tasks              - Create task (auto-inherits goal color)
PUT    /api/tasks/:id          - Update task (status rules, strips non-DB fields)
DELETE /api/tasks/:id          - Delete task
```

### Habits

```
GET    /api/habits             - Get all habits (?status=ACTIVE)
GET    /api/habits/:id         - Get single habit with logs
POST   /api/habits             - Create habit
PUT    /api/habits/:id         - Update habit
DELETE /api/habits/:id         - Delete habit
POST   /api/habits/:id/log     - Log completion (with user's local date)
POST   /api/habits/:id/skip    - Skip habit for a date
DELETE /api/habits/:id/log     - Unlog habit completion
GET    /api/habits/:id/heatmap - Get yearly heatmap (?year=2026)
GET    /api/habits/:id/stats   - Get habit statistics
```

### Time Entries

```
GET    /api/time-entries             - Get all entries with formatted durations
GET    /api/time-entries/running     - Get currently running/paused timer
GET    /api/time-entries/summary     - Time summary grouped by goal/task/habit (?period=today|week|month)
GET    /api/time-entries/task-summary - Task-level time breakdown (?goalId=&period=)
GET    /api/time-entries/:id         - Get single entry
POST   /api/time-entries/start       - Start timer (auto-inherits goalId from task)
POST   /api/time-entries/quick-log   - Quick log manual entry
PUT    /api/time-entries/:id/stop    - Stop timer
PUT    /api/time-entries/:id/pause   - Pause timer
PUT    /api/time-entries/:id/resume  - Resume paused timer
PATCH  /api/time-entries/:id         - Update entry context
DELETE /api/time-entries/:id         - Delete entry
POST   /api/time-entries/cleanup     - Close all running/paused timers
```

### AI Endpoints

```
POST   /api/ai/insights       - Get personalized productivity insights
POST   /api/ai/generate-plan  - AI generates goal plan (no save)
POST   /api/ai/create-plan    - Save edited plan to database
```

### Today Dashboard

```
GET    /api/today              - Today's dashboard (?date=2026-06-08)
```

Returns:

- Active & overdue goals with full hierarchy
- Today's scheduled habits with completion status
- Currently running timer
- Tasks due today
- Summary stats

---

## 🔐 Authentication

- JWT-based authentication
- Tokens stored in httpOnly cookies or Authorization header
- Middleware protects all routes except register/login
- Token expiry: 7 days
- Auto-check for overdue goals on authenticated requests (once per minute per user)

---

## 📅 Date Handling

All dates are normalized to **UTC midnight** (`T00:00:00.000Z`) for consistency:

- Frontend sends user's local date as `YYYY-MM-DD`
- Backend stores as `YYYY-MM-DDT00:00:00.000Z`
- All comparisons use UTC midnight
- Habit streaks calculated with UTC dates
- Time entries use full UTC timestamps

---

## 🎨 Goal Update Rules

| Status  | Edit Details | Edit Due Date    | Edit Target | Complete | Fail         |
| ------- | ------------ | ---------------- | ----------- | -------- | ------------ |
| ACTIVE  | ✅           | ✅               | ✅          | ✅       | ✅           |
| OVERDUE | ✅           | ✅ (extend only) | ❌          | ✅       | ✅           |
| FAILED  | ❌           | ❌               | ❌          | ❌       | Archive only |

- **Color cascade**: Changing a parent goal's color updates all descendant sub-goals and their tasks
- **Completing goals**: Requires all sub-goals and tasks to be completed first
- **Sub-goals**: Cannot be re-activated if parent is completed

---

## 📁 Project Structure

```
backend/
├── controllers/
│   ├── aiController.js          # AI insights, plan generation & creation
│   ├── authController.js        # Register, login, logout
│   ├── goalController.js        # Goal CRUD + stats + reorder + color cascade
│   ├── habitController.js       # Habit CRUD + log + skip + unlog + heatmap + stats
│   ├── timeEntryController.js   # Timer start/stop/pause/resume
│   └── todayController.js       # Today dashboard (recursive goal tree)
├── middleware/
│   ├── auth.js                  # JWT verification + overdue check
│   └── errorHandler.js          # Global error handling
├── routes/
│   ├── ai.js                    # /api/ai/*
│   ├── auth.js                  # /api/auth/*
│   ├── goals.js                 # /api/goals/*
│   ├── habits.js                # /api/habits/*
│   ├── tasks.js                 # /api/tasks/*
│   ├── timeEntries.js           # /api/time-entries/*
│   ├── today.js                 # /api/today
│   └── seed.js                  # /api/seed/* (dev only)
├── services/
│   └── deadlineService.js       # Auto-fail overdue goals
├── utils/
│   ├── prisma.js                # Prisma client singleton
│   └── cache.js                 # In-memory response cache
├── prisma/
│   └── schema.prisma            # Database schema with indexes
├── server.js                    # Entry point
└── package.json
```

---

## 🗄️ Database Schema Highlights

### Goal Hierarchy

Goals can be nested infinitely through `parentId` self-reference:

```
Parent Goal
├── Sub-Goal 1
│   ├── Sub-Sub-Goal
│   │   └── Task 1
│   └── Task 2
├── Sub-Goal 2
└── Task 3
```

### Performance Indexes

```prisma
Goal:   @@index([userId, status, priority])
Goal:   @@index([userId, status, endDate])
Task:   @@index([userId, status, dueDate])
Task:   @@index([userId, status, priority, dueDate])
Habit:  @@index([userId, status, frequencyType])
TimeEntry: @@index([userId, status])
```

### Time Formatting

All time durations returned in multiple formats:

```json
{
  "seconds": 2700,
  "minutes": 45,
  "hours": 0.75,
  "formatted": {
    "compact": "0h 45m 0s",
    "short": "45m 0s",
    "human": "45 minutes 0 seconds"
  }
}
```

---

## 🤖 AI Integration

- **Provider**: OpenRouter with multi-model fallback
- **Free tier**: Uses `openrouter/free` auto-router + specific free models
- **Fallback chain**: `moonshotai/kimi-k2.6:free` → `openrouter/free` → `deepseek/deepseek-r1:free`
- **Rate limits**: ~50 requests/day on free tier
- **Insights**: Analyzes goals, tasks, habits with direct coaching persona
- **Plan Generation**: Creates structured goal plans with sub-goals and tasks
- **Plan Creation**: User reviews and edits plan before saving to database

---

## 🔧 Scripts

| Script                   | Description                           |
| ------------------------ | ------------------------------------- |
| `npm run dev`            | Start development server with nodemon |
| `npm start`              | Start production server               |
| `npx prisma migrate dev` | Run database migrations               |
| `npx prisma generate`    | Generate Prisma client                |
| `npx prisma studio`      | Open database GUI                     |
| `npx prisma db seed`     | Seed database with test data          |

---

## 🚀 Deployment

### Render (Free Tier)

1. Create a PostgreSQL database on Render (or use Neon)
2. Deploy as Web Service from GitHub
3. Set environment variables:
   ```env
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-secret
   CLIENT_URL=https://your-frontend.com
   OPENROUTER_API_KEY=sk-or-v1-...
   NODE_ENV=production
   PORT=10000
   ```
4. Build command: `npm install && npx prisma generate`
5. Start command: `node server.js`

```

```
````
