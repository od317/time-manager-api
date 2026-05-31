## Backend README: `backend/README.md`

````markdown
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

## 📊 Database Models

### User

- Authentication with JWT
- Timezone stored for date calculations
- Linked settings for defaults

### Goal

- Hierarchical structure (self-referencing parent/children)
- Three types: `quantity`, `time`, `project`
- Target values, progress tracking, color coding
- Start/end dates with optional time

### Task

- Belongs to a goal
- Priority, estimated time, due date
- Status tracking (TODO → IN_PROGRESS → COMPLETED)
- Color inherited from parent goal

### Habit

- Frequency types: DAILY, WEEKLY, CUSTOM
- Day selection for weekly habits
- Streak tracking (current, longest)
- Amount tracking option
- Rollover support

### HabitLog

- Daily completion records
- Status: COMPLETED, SKIPPED, MISSED, ROLLOVER
- Optional value and notes

### TimeEntry

- Timer sessions linked to goals/tasks/habits
- Entry types: TIMER, MANUAL, POMODORO
- Status: RUNNING, PAUSED, COMPLETED

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
GET    /api/goals              - Get all goals (?status=ACTIVE)
GET    /api/goals/:id          - Get single goal with children/tasks
POST   /api/goals              - Create goal
PUT    /api/goals/:id          - Update goal
DELETE /api/goals/:id          - Delete goal (cascades)
PUT    /api/goals/reorder      - Reorder goals
GET    /api/goals/:id/stats    - Get goal statistics
```

### Tasks

```
POST   /api/tasks              - Create task
PUT    /api/tasks/:id          - Update task
DELETE /api/tasks/:id          - Delete task
GET    /api/tasks              - Get tasks (?status=TODO&goalId=xxx)
```

### Habits

```
GET    /api/habits             - Get all habits (?status=ACTIVE)
GET    /api/habits/:id         - Get single habit with logs
POST   /api/habits             - Create habit
PUT    /api/habits/:id         - Update habit
DELETE /api/habits/:id         - Delete habit
POST   /api/habits/:id/log     - Log completion
POST   /api/habits/:id/skip    - Skip habit for today
GET    /api/habits/:id/heatmap - Get yearly heatmap (?year=2026)
GET    /api/habits/:id/stats   - Get habit statistics
```

### Time Entries

```
GET    /api/time-entries            - Get all entries (?goalId=&startDate=&endDate=)
GET    /api/time-entries/running    - Get currently running timer
GET    /api/time-entries/summary    - Get time summary (?period=today|week|month)
GET    /api/time-entries/:id        - Get single entry
POST   /api/time-entries/start      - Start timer
POST   /api/time-entries/quick-log  - Quick log manual entry
PUT    /api/time-entries/:id/stop   - Stop timer
PUT    /api/time-entries/:id/pause  - Pause timer
PUT    /api/time-entries/:id/resume - Resume paused timer
PATCH  /api/time-entries/:id        - Update entry (goal/task context)
DELETE /api/time-entries/:id        - Delete entry
```

## 🔐 Authentication

- JWT-based authentication
- Tokens set as httpOnly cookies (production) or returned in response body
- Middleware protects all routes except register/login
- Token expiry: 7 days

## 📁 Project Structure

```
backend/
├── controllers/
│   ├── authController.js       # Register, login, logout
│   ├── goalController.js       # Goal CRUD + stats + reorder
│   ├── habitController.js      # Habit CRUD + log + heatmap + stats
│   └── timeEntryController.js  # Timer start/stop/pause/resume + summary
├── middleware/
│   ├── auth.js                 # JWT verification
│   └── errorHandler.js         # Global error handling
├── routes/
│   ├── auth.js
│   ├── goals.js
│   ├── habits.js
│   ├── tasks.js
│   └── timeEntries.js
├── utils/
│   └── prisma.js               # Prisma client singleton
├── prisma/
│   └── schema.prisma           # Database schema
├── server.js                   # Entry point
└── package.json
```

## 🗄️ Database Schema Highlights

### Goal Hierarchy

Goals can be nested infinitely through `parentId` self-reference:

```
Parent Goal
├── Sub-Goal 1
│   ├── Sub-Sub-Goal
│   └── Task 1
├── Sub-Goal 2
└── Task 2
```

### Habit Frequency

```prisma
frequencyType   String   // DAILY, WEEKLY, CUSTOM
frequencyDays   Int[]    // [0,1,2,3,4,5,6] for Sun-Sat
timesPerDay     Int      // How many times per day
```

### Time Entry Tracking

```prisma
goalId    String?   // Linked to goal
taskId    String?   // Linked to task
habitId   String?   // Linked to habit
duration  Int?      // Seconds
```

## 🔧 Scripts

| Script                   | Description                           |
| ------------------------ | ------------------------------------- |
| `npm run dev`            | Start development server with nodemon |
| `npm start`              | Start production server               |
| `npx prisma migrate dev` | Run database migrations               |
| `npx prisma generate`    | Generate Prisma client                |
| `npx prisma studio`      | Open database GUI                     |

## 🚀 Deployment

### Render (Free Tier)

1. Create a PostgreSQL database on Render
2. Deploy as Web Service from GitHub
3. Set environment variables
4. Run migrations on first deploy
