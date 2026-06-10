# Murka System

Reimbursement portal for Murka. Requesters submit reimbursement claims with proof files; admins review, approve/reject, and manage projects, requesters, and groups. Daily email reminders nudge admins on pending items.

## Stack

- **Next.js 16** (App Router) — note: this repo runs a modified Next.js; read `node_modules/next/dist/docs/` before changing framework code (see `AGENTS.md`).
- **Supabase** — Postgres, auth, storage (proof files).
- **Resend** — transactional email (review notifications, admin reminders).
- **Tailwind CSS v4**.
- **Vercel** — hosting + cron.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

## Structure

```
app/
  page.tsx              # requester submission form
  login/                # auth
  admin/                # admin dashboard (review, projects, requesters)
  api/
    postreimburse/      # submit a reimbursement
    admin/review/       # approve / reject
    admin/projects/     # manage projects
    admin/requesters/   # manage requesters
    admin/notify/       # send notifications
    auth/callback/       # supabase auth callback
    cron/remind-admins/ # daily reminder job
lib/
  send-review-email.ts  # review-result emails
  send-reminder-email.ts# admin reminder emails
  format.ts             # formatting helpers
  idempotency.ts        # dedupe submissions
utils/supabase/         # supabase clients (browser / server)
supabase/               # SQL migrations + seed + history import
```

## Cron

`vercel.json` schedules `/api/cron/remind-admins` daily at 02:00 UTC.

## Database

Apply SQL in `supabase/` against the project. `migration.sql` is the base schema; `migrate-*.sql` are incremental changes; `history.sql` is a one-time CSV data import.

## Deploy

Push to the connected Vercel project. Set the env vars above in Vercel and confirm the cron is enabled.
