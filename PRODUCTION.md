# Production Deployment Runbook — Xidaa Discount Calculator

This runbook assumes you have created a Supabase project
(see README §4) and pasted the keys into `.env`.

## 1. Apply the database migration

**Option A — Dashboard (recommended):**

1. Open your project at supabase.com.
2. **SQL Editor → New query**.
3. Paste the entire contents of:
   ```
   supabase/migrations/20261103_init_xidaa_schema.sql
   ```
4. **Run**. You should see "Success" — 20+ tables, RLS policies, indexes and
   seeded catalogues/settings are created.

**Option B — CLI with psql:**

```bash
npm run db:migrate
```
requires `DATABASE_URL` in `.env` and `psql` installed.

## 2. Deploy Edge Functions

The app uses four server-side functions. From a machine with the
Supabase CLI (or `npx supabase`):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy auth-verify-pin auth-refresh auth-change-pin users-admin
```

The functions automatically receive `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` from the project.

> Without the CLI, deploy each function by pasting the contents of
> `supabase/functions/<name>/index.ts` into **Edge Functions → New function**
> in the dashboard, and add the three env vars above (Secret type).

## 3. Bootstrap users

```bash
node scripts/setup-admin.mjs
```

Creates (only if they do not exist):

| user | initial PIN | role |
| --- | --- | --- |
| `admin` | 9999 | Administrator |
| `sales` | 9999 | Sales Executive |

Both are stored as salted PBKDF2 hashes and must change their PIN at first
sign-in.

## 4. Host the web app

The app is a static build (nothing server-side in the bundle):

```bash
npm install
npm run build     # outputs dist/
```

Deploy `dist/` to any static host — Vercel, Netlify, Cloudflare Pages,
or Supabase Storage (bucket `web`, public) with `index.html` fallback.

Environment variables to set on the host:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

(Only the `VITE_` pair is needed by the browser app.)

## 5. Post-deploy checklist

- [ ] Open the site → login as `admin` / 9999 → change PIN.
- [ ] Settings → Scooter Models: map DL models and enter approved prices/costs.
- [ ] Create an order with scooters + batteries + transport → check options.
- [ ] Save → open Saved Orders → View → generate PDF.
- [ ] Log in as `sales` on another device → PIN the same order is visible;
      Settings shows "Administrator access required".
- [ ] Audit Log shows user creation, PIN changes, model updates, order saves.

## 6. Security reminders

- The `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` must NEVER be
  placed in `VITE_` variables or any client code.
- If a service-role key leaks, rotate it in the dashboard.
- RLS is the final backstop: all tables are locked down except through the
  documented policies (see migration file).
- Initial PINs are bootstrap-only; force a change at first login (built-in).
