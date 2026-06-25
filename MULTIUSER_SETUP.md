# CampusFlow Multi-User Setup

This version supports many students. Every student has a separate login, profile, task list and automation history.

## Supabase setup

1. Create a Supabase project.
2. Open `SQL Editor -> New query`.
3. Copy all contents of `supabase/schema.sql`.
4. Paste them into Supabase and click Run.
5. For a fast demo, open `Authentication -> Providers -> Email` and turn off Confirm email.
6. Open `Project Settings -> API`.

Copy:
- Project URL
- anon/public key
- service_role key

## Render variables

Add:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Never place the service role key in GitHub or Vercel. Redeploy Render.

The health endpoint should then include:

```json
"mode": "multi-user"
```

## Vercel variables

Add:

```text
VITE_API_URL=https://YOUR_RENDER_URL/api
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Redeploy Vercel.

## Test isolation

Create Student A, add a task, and sign out. Create Student B. Student B must not see Student A's profile, tasks or automation logs.
