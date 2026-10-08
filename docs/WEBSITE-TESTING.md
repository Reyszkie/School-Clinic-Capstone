# MQC Clinic: Local Setup and Testing

## Requirements

- Windows
- Node.js 24
- Corepack and pnpm
- A browser
- A Supabase project

The clinic API uses Supabase REST endpoints at runtime. A local PostgreSQL service is not required to run the website. `DATABASE_URL` is only used by the separate Drizzle tooling.

## 1. Install the project

Open PowerShell in the project folder:

```powershell
corepack enable
corepack pnpm install
```

Do not share your personal `.env` or `.env.local` files. They contain server credentials. Share `backups/mqc_clinic.backup` only if its patient records are safe to disclose.

## 2. Prepare Supabase

1. Create or select a Supabase project.
2. Open its SQL Editor and run the repository file `supabase/schema.sql`.
3. The schema creates a local test user: `testnurse` / `test12345`. This account has the Staff Nurse role; change or remove it before production use.
4. Create the first administrator in the SQL Editor. Replace the username and password placeholders with your own values before running:

```sql
insert into public.clinic_users (id, name, last_name, first_name, role, username, password_hash, status)
values (
  'NRS-ADMIN-001',
  'Clinic Administrator',
  'Administrator',
  'Clinic',
  'Head Nurse & Administrator',
  'YOUR_ADMIN_USERNAME',
  extensions.crypt('REPLACE_WITH_A_STRONG_PASSWORD', extensions.gen_salt('bf')),
  'Active'
)
on conflict (username) do nothing;
```

This first administrator can then create and manage clinic accounts from Administration. Account creation and permanent deletion are restricted to this role.

## 3. Configure the application

Copy the example environment file into the Next.js app folder:

```powershell
Copy-Item .env.example artifacts/mqc-clinic/.env.local
```

Edit `artifacts/mqc-clinic/.env.local` and set:

- `SUPABASE_URL` to the project URL.
- `SUPABASE_SECRET_KEY` to that project's server-side Secret key. `SUPABASE_SERVICE_ROLE_KEY` is accepted for legacy projects.
- `AUDIT_SESSION_SECRET` to a separate long random value (recommended). If omitted, the server-side Supabase key signs clinic sessions.

Never place the Supabase secret key in browser code, a `NEXT_PUBLIC_` variable, or a shared source archive. `DATABASE_URL` and `PG_POOL_MAX` are only needed when using Drizzle tooling; they are not required by the running clinic API.

## 4. Start the website and API

The website and API run in the same Next.js server. From the repository root:

```powershell
corepack pnpm --filter @workspace/mqc-clinic run dev
```

Open <http://localhost:3000/>. Check the public health endpoint at <http://localhost:3000/api/healthz>; it should return `{"status":"ok"}`. A signed-out request to `/api/clinic-state` should return HTTP 401.

## 5. Quick test

1. Sign in with the administrator account provisioned above.
2. Add a test patient and a clinic visit; confirm the chosen medicine or supplies are deducted.
3. Refresh and confirm the patient, visit, and inventory changes remain.
4. Open Reports and confirm the visit appears in the reason, grade, and disposition summaries.
5. Confirm the report summary labels open matching visit records.
6. Sign in as `testnurse` / `test12345` and confirm the account cannot create users or permanently delete records.
7. Export a backup, then test restoring it only in a development/test Supabase project.
8. Check “Remember me,” restart the browser, and verify the account is restored only while the server session remains active.

## 6. Project checks

From the repository root:

```powershell
corepack pnpm run typecheck
corepack pnpm --filter @workspace/mqc-clinic run build
```

The browser scripts can be syntax-checked with:

```powershell
Get-ChildItem artifacts/mqc-clinic/public/clinic/js -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Drizzle tooling

The Drizzle package is separate from the clinic API runtime. If you use it for database tooling, set `DATABASE_URL` to the project's PostgreSQL connection string and follow the package scripts. The clinic app's required runtime tables and policies are defined in `supabase/schema.sql`.