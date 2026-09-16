# MQC Clinic: Simple Install and Test Guide

## Requirements

- Windows
- Node.js 24
- PostgreSQL 18
- A browser

The project uses Corepack and pnpm

## Send the project to a classmate

Send the project source folder or a ZIP file, including `package.json`, `pnpm-lock.yaml`, `.env.example`, `artifacts`, `lib`, `scripts`, `docs`, and `backups/mqc_clinic.backup` if your classmate should receive your current records.

Do not send `node_modules`, `.cache`, `.local`, `dist`, or your personal `.env` file. They are local/generated files and can contain machine-specific settings.

Your classmate must install Node.js 24, PostgreSQL 18, and a browser, then follow this guide from the beginning. The backup contains the clinic records from your local database, so only share it if those records are safe to share.

## 1. Install the project

Open PowerShell in the project folder:

```powershell
cd C:\Users\hirrua\Documents\mqc-clinic-updated
corepack enable
corepack pnpm install
```

## 2. Prepare PostgreSQL

Make sure the PostgreSQL service is running:

```powershell
Get-Service -Name "postgresql-x64-18"
```

If `psql` is not recognized, run:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
```

Connect as the PostgreSQL administrator. Enter the administrator password when prompted:

```powershell
psql -U postgres -h 127.0.0.1 -p 5432
```

Run this SQL in the PostgreSQL prompt:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'clinic') THEN
    CREATE ROLE clinic LOGIN PASSWORD 'clinic';
  ELSE
    ALTER ROLE clinic WITH LOGIN PASSWORD 'clinic';
  END IF;
END
$$;
CREATE DATABASE mqc_clinic OWNER clinic;
\q
```

If `mqc_clinic` already exists, ignore that message.

### Optional: restore the included records

Skip this section if your classmate should start with an empty database. After creating the `clinic` role and `mqc_clinic` database, run this from the project folder:

```powershell
$env:PGPASSWORD = "clinic"
pg_restore -h 127.0.0.1 -p 5432 -U clinic -d mqc_clinic --no-owner --no-privileges backups/mqc_clinic.backup
Remove-Item Env:PGPASSWORD
```

The backup was created with PostgreSQL 18 and contains the `clinic_state` table and its saved data. Do not run the restore more than once on the same database unless you intend to replace or merge the existing data.

### Connect with pgAdmin 4

In pgAdmin 4, right-click **Servers** and choose **Register > Server**. Use these values:

- **Name:** `MQC Clinic Local`
- **Host name/address:** `127.0.0.1`
- **Port:** `5432`
- **Maintenance database:** `mqc_clinic`
- **Username:** `clinic`
- **Password:** `clinic`

After saving, expand **Servers > MQC Clinic Local > Databases > mqc_clinic > Schemas > public > Tables**. The `clinic_state` table confirms the app database has been initialized. You can also open **Query Tool** and run:

```sql
SELECT current_database(), current_user;
SELECT to_regclass('public.clinic_state');
```

The expected results are `mqc_clinic`, `clinic`, and `clinic_state`.

Create the project environment and database table:

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
$env:DATABASE_URL = "postgresql://clinic:clinic@127.0.0.1:5432/mqc_clinic"
corepack pnpm db:push
```

## 3. Start the API

Open a new PowerShell window:

```powershell
cd C:\Users\hirrua\Documents\mqc-clinic-updated
$env:DATABASE_URL = "postgresql://clinic:clinic@127.0.0.1:5432/mqc_clinic"
$env:PORT = "3000"
corepack pnpm --filter @workspace/mqc-clinic run dev
```

Check the API in your browser:

<http://localhost:3000/api/healthz>

Expected result:

```json
{ "status": "ok" }
```

Leave this window running.

## 4. Start the website

Open another PowerShell window:

```powershell
cd C:\Users\hirrua\Documents\mqc-clinic-updated
$env:PORT = "25856"
$env:BASE_PATH = "/"
corepack pnpm --filter @workspace/mqc-clinic run dev
```

Open the website:

<http://localhost:25856/>

## 5. Test account

- Username: `NurseBolando`
- Password: `nurse12345`

This account is for local testing only.

## 6. Quick test

1. Sign in.
2. Open Dashboard, Patients, Inventory, Reports, Administration, and Settings.
3. Add a test patient.
4. Refresh the browser and confirm the patient remains.
5. Open a private browser window, sign in, and confirm the patient is visible there.
6. Edit a medicine or equipment item and confirm the change remains after refresh.
7. Restart the API and confirm the data remains.

## 7. Useful checks

Check PostgreSQL:

```powershell
Get-Service -Name "postgresql-x64-18"
Test-NetConnection -ComputerName 127.0.0.1 -Port 5432
```

Run project checks:

```powershell
corepack pnpm exec tsc --build
corepack pnpm --filter @workspace/mqc-clinic run typecheck
corepack pnpm --filter @workspace/mqc-clinic run typecheck
corepack pnpm --filter @workspace/mqc-clinic run build
```

## Stop the application

Press `Ctrl+C` in the API and website terminals.

PostgreSQL can remain running for the next test. To stop it, run PowerShell as Administrator:

```powershell
Stop-Service postgresql-x64-18
```
