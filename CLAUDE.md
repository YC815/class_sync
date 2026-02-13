# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassSync — a Next.js weekly class schedule management system with Google Calendar synchronization, built for 臺北市數位實驗高級中等學校. Users manage courses, assign them to a 7-day × 8-period schedule grid, and sync to Google Calendar.

## Commands

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type-check
npm run build         # Production build
npx vitest run        # Run all tests
npx vitest run src/app/api/weeks/[weekStart]/sync/route.test.ts  # Single test file
npx prisma generate   # Regenerate Prisma client (after schema changes)
npx prisma db push    # Push schema changes to database
```

Dev server runs on port 3008 (`next dev -p 3008`). **Do not run `npm run dev`.**

## Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Prisma 6** → PostgreSQL (client output: `src/generated/prisma`)
- **NextAuth.js 4** with Google OAuth (JWT strategy, offline access for Calendar scope)
- **SWR** for client data fetching, **Zod** for validation
- **Tailwind CSS 4** + **shadcn/ui** (new-york style, lucide icons)
- **Vitest** for testing (node environment, `@` alias configured)

## Architecture

### Path alias

`@/*` maps to `./src/*` (tsconfig + vitest config).

### Auth flow

NextAuth with Google OAuth stores access/refresh tokens in JWT. The `session` callback injects `accessToken`, `refreshToken`, `expiresAt` into the client session. Token refresh is handled in the JWT callback with `ReauthRequiredError` propagation via `session.error`. All API routes gate on `getServerSession(authOptions)`.

### Schedule data model

The schedule is a `WeekSchedule` — a nested object keyed by `[day: 0-6][period: 1-8]` holding `ScheduleCell | null`. Stored as JSON in the `Week` model, keyed by `(userId, weekStart)` where `weekStart` is the Monday date as `YYYY-MM-DD`.

Each cell tracks `courseId`, `courseName`, base/room info, `isSynced` flag, and `calendarEventId` for sync state.

### Google Calendar sync pipeline

1. **Preview** (`POST /api/weeks/[weekStart]/preview`) — diffs local schedule against DB `Event` records, returns create/update/delete actions
2. **Sync** (`POST /api/weeks/[weekStart]/sync`) — executes the actions against Google Calendar API, stores `calendarEventId` in DB
3. **Sync-deleted** (`POST /api/weeks/[weekStart]/sync-deleted`) — cleans up DB records for events deleted from Calendar
4. **Recover** (`POST /api/weeks/[weekStart]/recover`) — re-links orphaned Calendar events

Adjacent periods for the same course are merged into one Calendar event. Lunch break (periods 4→5) prevents merging.

### Client state management

- **SWR** for courses, bases, rooms, link-types (auto-revalidation)
- **useState** for schedule grid (local edits)
- **localStorage** fallback via `src/lib/local-schedule.ts` for unsaved changes
- Schedule saves are debounced (1000ms) before persisting to DB

### Period times

8 periods from 08:25–16:55, defined in `PERIOD_TIMES` (`src/lib/types.ts`). Lunch gap between period 4 (ends 11:55) and period 5 (starts 13:25).

### Taiwan academic calendar

Semester calculation in `schedule-utils.ts` uses ROC year (Western year − 1911). Semester 1: Aug–Jan, Semester 2: Feb–Jul.

### Key library files

- `src/lib/auth.ts` — NextAuth configuration (provider, callbacks, token refresh)
- `src/lib/google-calendar.ts` — Google Calendar API wrapper (create/update/delete events)
- `src/lib/google-auth.ts` — Token management, `ReauthRequiredError`
- `src/lib/schedule-utils.ts` — Schedule manipulation, semester calculation, event merging
- `src/lib/types.ts` — All shared types, constants (periods, bases, rooms)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/api-client.ts` — Client-side API wrapper with error callback

### Prisma

Schema at `prisma/schema.prisma`. Client generates to `src/generated/prisma` (non-default path). ESLint ignores `src/generated/**/*`. Key models: User, Course, CourseLink, Base, Room, Week (JSON schedule), Event (Calendar sync tracking), LinkType.

### UI components

shadcn/ui components in `src/components/ui/`. Config in `components.json`. Add new components via `npx shadcn@latest add <component>`.

## Environment Variables

Required in `.env.local` (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `NEXTAUTH_SECRET` — NextAuth encryption key
- `NEXTAUTH_URL` — App base URL
