# MQC School Clinic Management System

## What This System Is

MQC School Clinic Management System is a browser-based workspace for Mary the Queen College clinic. It supports staff sign-in, patient records, clinical visit documentation, medicine and medical supplies inventory, reports, user administration, audit history, deleted-record recovery, and local/shared data storage.

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
- Medicines and Supplies navigation.
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

- Total patients served metric.
- Clinic visits today metric.
- Total visits this month metric.
- Returning patients metric.
- Frequent visitors metric.
- Referral count metric.
- Low-stock medicine alert.
- Out-of-stock medicine alert.
- Expiring-medicine alert.
- Configurable low-stock threshold.
- Configurable expiration alert window.
- Clickable low-stock and expiring-medicine rows.
- Quick patient search by name, course, or year/grade.
- Search result limit for quick scanning.
- View Records action from dashboard results.
- Patient clinical-record modal from dashboard search.

### Patients and Clinical Visits

- Find a Patient tab.
- Visit History tab.
- Patient search by name, course, or year/grade.
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
- Name, institutional category, year or personnel type, sex, and guardian contact display.
- Required last name and given name validation.
- Automatic internal patient record identifiers.
- Duplicate patient matching to reuse the existing profile and its Clinical Visit Records.
- Middle initial field.
- Year-level field.
- Age field with minimum and maximum values.
- Sex selection.
- Contact number field.
- Parent or guardian name and contact fields.
- Add New Patient saves the patient profile only; clinical visits are created separately from the patient profile.
- Patient save and update confirmations.
- Patient audit entries for additions, updates, and deletions.
- Clinical Visit Records section.
- Visit count, date, time, reason, notes preview, nurse, and outcome display.
- View full clinical record action.
- Edit visit record action.
- New Patient Visit action.
- Distinct visit records remain linked to the patient; later visits do not overwrite earlier encounters.
- Visit date and time fields.
- Nurse-on-duty field.
- Reason selection with Other option.
- Detailed description field.
- Symptom start and pain level fields.
- Medical history fields for conditions, allergies, and current medication.
- Vital-sign fields for weight, height, temperature, blood pressure, heart rate, and oxygen saturation.
- Nurse notes field.
- Treatment and intervention checklist with Other option.
- Additional treatment details field.
- Medication and quantity-used fields.
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
- Item code, name, category, quantity, unit, and expiration fields.
- Add, edit, and delete medicine actions.
- Required medicine-name validation.
- Quantity and unit selection.
- Default medicine values.
- Pagination.
- Deleted medicine count.
- Deleted medicine recovery.
- Permanent medicine deletion confirmation.
- Medicine audit entries.
- Catalog entries for Mefenamic, Cetirizine, Paracetamol, Symdex, Carbocisteine, Aluminum Magnesium Antacid, Ibuprofen, and Loperamide.

### Medical Supplies

- Medical Supplies tab; the Medical Equipment tab is no longer shown.
- Search by supply name or ID.
- Supply ID, name, quantity, maintenance date, and status fields.
- Add, edit, and delete supply actions.
- Required supply-name validation.
- Quantity entry.
- Supply status selection.
- Pagination.
- Deleted supply recovery.
- Permanent supply deletion confirmation.
- Supply audit entries.
- Catalog includes Bandage, White Flower Oil, Mupirocin, and Eye Mo. Alcohol, Cotton Swabs, and Hand Sanitizer are retired from active supplies.
- Historical Medical Equipment records remain stored but are hidden from the active inventory interface.

### Reports and Insights

- Total clinic visits metric.
- Unique patients served metric.
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
- Name, role, and status display; internal user IDs remain available to application operations.
- Active and Disabled statuses.
- Add, edit, enable, disable, and delete user actions.
- Deleted user recovery.
- Last name, first name, and middle initial fields.
- Head Nurse role with full administrative permissions.
- Staff Nurse role.
- Existing legacy Head Nurse & Administrator accounts retain access; the legacy role is not offered for new accounts.
- Username field.
- Password and confirm-password fields.
- Password show/hide controls.
- Required name, username, and new-password validation.
- Password confirmation validation.
- Head Nurses can change another user's password through Supabase Auth; Staff Nurses cannot use the interface or password API to do so.
- Password changes require matching values and at least 8 characters; plaintext passwords are never written to clinic tables.
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
- Deleted inventory items list.
- Deleted users list.
- Restore actions for every record category (Head Nurse and existing legacy administrators only).
- Permanent delete actions (Head Nurse and existing legacy administrators only).
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
- Server-side session and role checks for clinic data, account management, and deletion/restoration.
- Staff Nurses can add and edit records but cannot delete or restore them, including through direct API requests.
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
- Atomic clinical-visit saves and inventory deductions with stock checks enforced in PostgreSQL.
- Saved timestamp in clinic snapshots.

### Supabase Database Schema

The repository includes a normalized Supabase schema at `supabase/schema.sql`. It creates:

- `clinic_users` for staff accounts, future Supabase Auth user links, and per-user appearance preferences.
- `patients` for student and patient profiles.
- `patients.institutional_category` and `patients.personnel_type` for student classifications and campus personnel records, while retaining legacy `course` and `year_level` columns.
- `clinical_visits` for consultation records, vital signs, assessments, treatments, optional outcome details, and visit revisions.
- `clinical_visit_inventory_deductions` for idempotent treatment stock deductions and reversals.
- `medicines` for medicine stock, expiration dates, and soft deletion. Legacy batch and supplier columns are retained for existing records but are no longer used by the application.
- `equipment` for medical supply quantities, maintenance dates, statuses, and soft deletion. Legacy equipment and condition data are retained for historical records.
- `audit_logs` for user actions and module activity.
- `clinic_settings` for clinic configuration and alert thresholds.
- `clinic_state` for backward compatibility with the current shared snapshot API.
- `clinic_sync_meta` for normalized-data migration and synchronization state.

Run `supabase/schema.sql` in the Supabase SQL Editor for both new and existing installations before deploying application changes that use it. It adds the patient classification fields, the per-user `clinic_users.appearance_theme` preference, and allows visit outcome details to be left blank; restores patient profiles from a legacy `students` table or the `clinic_state` snapshot; backfills a missing `clinical_visits.patient_id` from legacy visit links or the snapshot; normalizes known legacy guardian-contact values; and installs the `register_clinic_patient`, `save_clinical_visit_with_inventory`, `update_clinical_visit_with_inventory`, and `set_clinical_visit_inventory_status` database functions. Patient registration uses the transactional registration function to detect possible matches and prevent simultaneous duplicate submissions. A database trigger prevents a patient purge from cascading into visit rows that are not already in Deleted Records. If any visit still cannot be linked to an existing patient, the migration stops with the first 20 unresolved visit and patient IDs so they can be restored or corrected without discarding visits. It also removes the obsolete function that created a patient and initial visit together. Existing `Head Nurse & Administrator` accounts are preserved and retain administrative access; create new accounts with the `Head Nurse` role. The Drizzle schema and `db:push` command are separate tooling and are not a substitute for this runtime schema.

`supabase/reset_patient_records.sql` is a destructive reset script. Verify the Supabase project before running it. By default it requires an external backup reference and explicit operator confirmation; proceeding without a backup requires explicitly setting `operator_confirmed_without_backup` and `operator_confirmed` to `true`. That option is irreversible without another backup. The script preserves user accounts and inventory rows and checks their data before committing.

The clinic API reads normalized tables and uses `clinic_state` for compatibility fields and migration metadata. Row-level security is enabled without client policies; data access is restricted to the authenticated server API, which uses its server-side secret key. That key must never be exposed to browser code.

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
6. Create the first Head Nurse in the Supabase SQL Editor, replacing the sample username and password before running:

	```sql
insert into public.clinic_users (id, name, last_name, first_name, role, username, password_hash, status)
values ('NRS-ADMIN-001', 'Clinic Head Nurse', 'Nurse', 'Clinic', 'Head Nurse', 'YOUR_ADMIN_USERNAME', extensions.crypt('REPLACE_WITH_A_STRONG_PASSWORD', extensions.gen_salt('bf')), 'Active');
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