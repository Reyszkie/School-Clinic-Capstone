# MQC School Clinic Management System

## What This System Is

MQC School Clinic Management System is a browser-based workspace for Mary the Queen College clinic. It supports staff sign-in, student and patient records, clinical visit documentation, medicine and equipment inventory, reports, user administration, audit history, deleted-record recovery, and local/shared data storage.

The application is built with Next.js and deployed as one Vercel application. The clinic interface is the existing HTML, CSS, and JavaScript workspace in `artifacts/mqc-clinic/public/clinic`. Next.js provides the application shell and API route handlers. Those server-side routes read and write Supabase through its REST API using a server-only secret key. Drizzle schemas and commands are available for database tooling, but they are not the runtime data-access path for the clinic API.

## Complete Feature List

### Staff Access and Identity

- MQC-branded staff sign-in screen.
- Username and password fields.
- Required-field validation for username and password.
- Case-insensitive username matching.
- Invalid username or password error message.
- Disabled-account error message.
- Password show/hide control.
- Remember me option.
- Signed HttpOnly server session cookie.
- Browser-session login by default.
- Thirty-day server session when Remember me is selected, restored only after checking the active account with the server.
- Second identity-verification step after sign-in.
- Password confirmation during identity verification.
- Identity-verification show/hide control.
- Cancel and close identity verification.
- Welcome confirmation after successful verification.
- Current user name and role in the workspace.
- Logout confirmation dialog.
- Audit entries for identity verification and logout.

### Application Shell

- Dashboard navigation.
- Patients navigation.
- Medicine and Equipment navigation.
- Reports navigation.
- Administration navigation.
- Settings shortcut.
- Active navigation state.
- Responsive sidebar.
- Mobile menu toggle.
- Current page title and description.
- Current Manila date and time clock.
- Alerts button.
- Alert indicator for low-stock or referral items.
- Alerts shortcut to the relevant dashboard or reports view.
- User initials avatar.
- Empty-state messages.
- Reusable modal dialogs.
- Modal close buttons and click-outside closing.
- Cancel buttons in forms and confirmations.
- Success, warning, and error toast messages.
- HTML escaping for displayed record values.

### Dashboard

- Total students served metric.
- Clinic visits today metric.
- Total visits this month metric.
- Returning students metric.
- Frequent visitors metric.
- Referral count metric.
- Low-stock medicine alert.
- Out-of-stock medicine alert.
- Expiring-medicine alert.
- Configurable low-stock threshold.
- Configurable expiration alert window.
- Clickable low-stock and expiring-medicine rows.
- Quick patient search by student ID, name, course, or year/grade.
- Search result limit for quick scanning.
- View Records action from dashboard results.
- Student clinical-record modal from dashboard search.

### Patients and Clinical Visits

- Find a Patient tab.
- Visit History tab.
- Patient search by student ID, name, course, or year/grade.
- Education-level filters for College, Senior High School, Junior High School, Elementary School, and Kindergarten.
- Course, section, or strand filter.
- Grouped college course options.
- Senior High School strand options.
- Junior High School section options.
- Elementary section options.
- Kindergarten section options.
- Add, select, edit, and delete patient actions.
- Deleted patient recovery.
- Patient initials avatar.
- Student ID, name, course, year, sex, age, contact, guardian, allergies, and medical-condition display.
- Warning styling for known allergies and medical conditions.
- Required student ID, last name, and given name validation.
- Duplicate student ID validation.
- Middle initial field.
- Year-level field.
- Age field with minimum and maximum values.
- Sex selection.
- Contact number field.
- Parent or guardian name and contact fields.
- Patient save and update confirmations.
- Patient audit entries for additions, updates, and deletions.
- Clinical Visit Records section.
- Visit count, date, time, reason, notes preview, nurse, and outcome display.
- View full clinical record action.
- Edit visit record action.
- New Patient Visit action.
- Visit date and time fields.
- Nurse-on-duty field.
- Reason selection with Other option.
- Detailed description field.
- Symptom start field.
- Pain level and pain location fields.
- Symptom checklist with Other option.
- Medical history fields for conditions, allergies, medication, similar symptoms, and last meal.
- Vital-sign fields for weight, height, temperature, blood pressure, heart rate, and oxygen saturation.
- Nurse assessment checklist with Other option.
- Nurse notes and assessment field.
- Treatment and intervention checklist with Other option.
- Additional treatment details field.
- Medication, dosage, and quantity-used fields.
- Clinic disposition selection.
- Release or referral time field.
- Remarks field.
- Parent or guardian notification fields.
- Clinic staff record and position fields.
- Clear visit form action.
- Required visit reason validation.
- Medicine stock availability validation.
- Medicine quantity deduction when used in a visit.
- Medicine quantity restoration when an existing visit is revised.
- Visit revision history.
- Superseded and active visit statuses.
- Original visit preservation after revision.
- Clinical record modal.
- Patient visit slip view and printing.
- Edit visit from the clinical record.
- Visit-history pagination.
- Deleted visit recovery.

### Medicine Inventory

- Medicines tab.
- Search by medicine name, item code, or category.
- Status filters for Available, Low Stock, Out of Stock, Expiring Soon, and Expired.
- Item code, name, category, quantity, unit, batch, expiration, and supplier fields.
- Add, edit, and delete medicine actions.
- Required medicine-name validation.
- Quantity and unit selection.
- Default medicine values.
- Pagination.
- Deleted medicine count.
- Deleted medicine recovery.
- Permanent medicine deletion confirmation.
- Medicine audit entries.

### Equipment and Medical Tools

- Equipment and Medical Tools tab.
- Search by equipment name or ID.
- Status filters for Available, Under Maintenance, Damaged, and Replacement Needed.
- Equipment ID, name, quantity, condition, maintenance date, and status fields.
- Add, edit, and delete equipment actions.
- Required equipment-name validation.
- Quantity entry.
- Good, Fair, and Poor condition options.
- Equipment status selection.
- Pagination.
- Deleted equipment recovery.
- Permanent equipment deletion confirmation.
- Equipment audit entries.

### Reports and Insights

- Total clinic visits metric.
- Unique students served metric.
- Frequent clinic visitors metric.
- Common reasons for visits metric.
- Visits by grade level or section metric.
- Clinic visit trends metric.
- Patient disposition metric.
- Common reasons summary table.
- Patient disposition summary table.
- Grade-level or section summary table.
- Frequent clinic visitors table and visit-history action.
- Referral review section.
- Monthly referral concern list.
- Configurable referral threshold.
- Detail modals for visits, unique students, frequent visitors, reasons, grade levels, disposition, and trends.
- Print Report Copy action.
- Printable report summary, reasons, disposition, grade-level, monthly visit, frequent-visitor, and referral lists.
- Pop-up-blocked print warning.
- Manila timestamp on printed reports.

### User Management

- User Management tab.
- User ID, name, role, and status display.
- Active and Disabled statuses.
- Add, edit, enable, disable, and delete user actions.
- Deleted user recovery.
- Last name, first name, and middle initial fields.
- Head Nurse and Administrator role.
- Head Nurse role.
- Staff Nurse role.
- Username field.
- Password and confirm-password fields.
- Password show/hide controls.
- Required name, username, and new-password validation.
- Password confirmation validation.
- Leave-blank password behavior when editing a user.
- User audit entries.

### Audit Logs

- Audit Logs tab.
- Audit date and time.
- User who performed the action.
- Action description.
- Module name.
- Success, warning, and error status display.
- Audit pagination.
- Empty audit-state message.

### Deleted Records

- Deleted Records tab.
- Deleted patient visits list.
- Deleted patients list.
- Deleted medicines list.
- Deleted equipment list.
- Deleted users list.
- Restore actions for every record category.
- Permanent delete actions.
- Permanent delete confirmation dialog.
- Warning audit entry for permanent deletion.
- Empty-state message for each category.

### Settings

- Backup and Restore section.
- Create Backup action.
- Browser JSON backup download.
- Date-stamped backup filename.
- Restore Backup file picker.
- JSON backup validation.
- Invalid-backup error message.
- Restore of patients, consultations, medicines, equipment, users, and settings.
- Backup-restored audit entry.
- About System panel.
- Version and school-year display.

### Data, Persistence, and API

- Supabase PostgreSQL persistence through authenticated Next.js REST API routes.
- Normalized tables for patients, visits, inventory, users, settings, and audit logs, with `clinic_state` retained as a compatibility snapshot.
- Server-side session and role checks for clinic data, account creation, and permanent deletion.
- `GET /api/healthz` health endpoint.
- `GET /api/clinic-state` shared-state endpoint.
- `PUT /api/clinic-state` shared-state update endpoint.
- HTTP 401 responses for clinic-state access without an active signed-in session.
- HTTP 403 responses when non-administrators attempt account changes or permanent deletion.
- HTTP 404 response when shared state does not exist.
- HTTP 400 response for invalid clinic-state JSON.
- HTTP 500 response for database failures.
- No-store cache headers for shared clinic state.
- Legacy JSON state migration into the database when available.
- Browser localStorage only stores the remembered username preference, not an authentication token.
- Browser sessionStorage stores the non-remembered login marker.
- Shared-state hydration occurs only after a server-validated login.
- Queued shared-state writes.
- Shared-state availability warnings.
- Automatic inventory migration for older saved data.
- Saved timestamp in clinic snapshots.

### Supabase Database Schema

The repository includes a normalized Supabase schema at `supabase/schema.sql`. It creates:

- `clinic_users` for staff accounts and future Supabase Auth user links.
- `patients` for student and patient profiles.
- `clinical_visits` for consultation records, vital signs, assessments, treatments, outcomes, and visit revisions.
- `medicines` for medicine stock, batches, expiration dates, suppliers, and soft deletion.
- `equipment` for medical tools, quantities, maintenance dates, conditions, statuses, and soft deletion.
- `audit_logs` for user actions and module activity.
- `clinic_settings` for clinic configuration and alert thresholds.
- `clinic_state` for backward compatibility with the current shared snapshot API.

Run `supabase/schema.sql` in the Supabase SQL Editor. The Drizzle schema and `db:push` command are separate tooling and are not a substitute for this runtime schema.

The clinic API reads normalized tables and uses `clinic_state` for compatibility fields and migration metadata. Row-level security is enabled; the API uses its server-side secret key, so that key must never be exposed to browser code.

## Technology

- Next.js App Router
- React
- TypeScript
- Vercel deployment
- Supabase PostgreSQL
- Drizzle ORM
- pnpm workspaces
- Plain HTML, CSS, and JavaScript clinic modules preserved under `public/clinic`
- Chart.js for clinic report charts

## Local Development

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Copy `.env.example` to `artifacts/mqc-clinic/.env.local`.
3. Set `SUPABASE_URL` to the URL of that Supabase project.
4. Set `SUPABASE_SECRET_KEY` to that project's server-side Secret key, or use `SUPABASE_SERVICE_ROLE_KEY` for a legacy project. Never expose this key to the browser.
5. Optionally set `AUDIT_SESSION_SECRET` to a separate long random secret for signing clinic sessions. If omitted, the server-side Supabase key is used.
6. Create the first administrator in the Supabase SQL Editor, replacing the sample username and password before running:

	```sql
insert into public.clinic_users (id, name, last_name, first_name, role, username, password_hash, status)
values ('NRS-ADMIN-001', 'Clinic Administrator', 'Administrator', 'Clinic', 'Head Nurse & Administrator', 'YOUR_ADMIN_USERNAME', extensions.crypt('REPLACE_WITH_A_STRONG_PASSWORD', extensions.gen_salt('bf')), 'Active');
	```

   The schema also creates a local test account (`testnurse` / `test12345`) with the Staff Nurse role. Change or remove it before production use.
7. Start the Next.js application:

	```powershell
	corepack pnpm --filter @workspace/mqc-clinic run dev
	```

8. Open `http://localhost:3000`.

The clinic API requires `SUPABASE_URL` and a matching server-side key to read or save records. `DATABASE_URL` is used by the separate Drizzle tooling, not by the clinic API runtime. If the API reports `Unregistered API key`, confirm the URL and key belong to the same Supabase project, then restart the development server.

## Vercel and Supabase Deployment

1. Create a Supabase project.
2. Copy the Supabase transaction pooler connection string from **Project Settings > Database**.
3. Keep `sslmode=require` in `DATABASE_URL`.
4. Import the repository into Vercel from the repository root.
5. Add `DATABASE_URL`, `PG_POOL_MAX=1`, `SUPABASE_URL`, and a matching `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) to Vercel Production, Preview, and Development environments.
6. Run `corepack pnpm db:push` once against the target Supabase database.
7. Deploy the Next.js application.
8. Verify `/api/healthz` after deployment.

## Verification Commands

```powershell
corepack pnpm install
corepack pnpm run typecheck
$env:DATABASE_URL = "postgresql://postgres:build-only@127.0.0.1:5432/postgres"
$env:PG_POOL_MAX = "1"
corepack pnpm --filter @workspace/mqc-clinic run build
```

## Important Prototype Notes

- The current staff credentials are demo credentials stored in the clinic data module. Replace them before real use.
- Login and authorization currently run in the browser. Production use should move authentication to Supabase Auth or another server-side identity provider.
- Clinic records are stored as one JSON document. Concurrent users can overwrite one another's latest snapshot; normalized tables would be better for production scale.
- The current clinic-state update route accepts an object but does not yet enforce a detailed record schema.
- Browser backups contain clinic data and should be handled as sensitive files.