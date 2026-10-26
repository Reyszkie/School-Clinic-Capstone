-- DESTRUCTIVE reset for patient, clinical-visit, and audit data.
-- Verify the Supabase dashboard project reference before changing any values.
-- A backup reference is required by default. To proceed without one, explicitly
-- set operator_confirmed_without_backup and operator_confirmed to true.

begin;

do $$
declare
  confirmed_project_ref text := 'REPLACE_WITH_VERIFIED_SUPABASE_PROJECT_REF';
  verified_backup_reference text := 'REPLACE_WITH_VERIFIED_BACKUP_EXPORT_REFERENCE';
  operator_confirmed boolean := false;
  operator_confirmed_without_backup boolean := false;
begin
  if confirmed_project_ref = 'REPLACE_WITH_VERIFIED_SUPABASE_PROJECT_REF'
    or not operator_confirmed
    or (
      verified_backup_reference = 'REPLACE_WITH_VERIFIED_BACKUP_EXPORT_REFERENCE'
      and not operator_confirmed_without_backup
    ) then
    raise exception 'Reset blocked. Verify the target project and explicitly confirm the reset; provide a verified backup reference or explicitly confirm proceeding without one.';
  end if;
end;
$$;

create temporary table _clinic_reset_users on commit drop as
select id, auth_user_id, name, last_name, first_name, middle_initial, role, username,
       password_hash, status, deleted_at, created_at, updated_at
from public.clinic_users;

create temporary table _clinic_reset_medicines on commit drop as
select code, name, category, quantity, unit, batch_number, expiration_date, supplier,
       deleted_at, created_at, updated_at
from public.medicines;

create temporary table _clinic_reset_equipment on commit drop as
select id, name, category, quantity, condition, last_maintenance_date, status,
       deleted_at, created_at, updated_at
from public.equipment;

create temporary table _clinic_reset_visit_ids on commit drop as
select id from public.clinical_visits;

-- Remove visit-linked inventory ledger entries from the compatibility snapshot,
-- while preserving item baselines, additions, and all stock quantities.
update public.clinic_state as clinic
set state = coalesce(clinic.state, '{}'::jsonb) || jsonb_build_object(
  'students', '[]'::jsonb,
  'deletedStudents', '[]'::jsonb,
  'consultations', '[]'::jsonb,
  'auditLogs', '[]'::jsonb,
  'inventoryTransactions', coalesce((
    select jsonb_agg(entry)
    from jsonb_array_elements(
      case
        when jsonb_typeof(clinic.state->'inventoryTransactions') = 'array'
          then clinic.state->'inventoryTransactions'
        else '[]'::jsonb
      end
    ) as ledger(entry)
    where not exists (
      select 1
      from _clinic_reset_visit_ids as visit
      where visit.id = entry->>'referenceId'
    )
  ), '[]'::jsonb)
),
updated_at = now()
where clinic.id = 1;

delete from public.clinical_visit_inventory_deductions as deduction
using public.clinical_visits as visit
where deduction.visit_id = visit.id
  and exists (select 1 from public.patients as patient where patient.id = visit.patient_id);

delete from public.clinical_visits as visit
using public.patients as patient
where visit.patient_id = patient.id;

delete from public.patients;

-- The audit table's row-level mutation trigger remains installed. TRUNCATE is
-- used for this explicit maintenance action and does not create per-row events.
truncate table public.audit_logs;

do $$
begin
  if exists (select 1 from public.patients)
    or exists (select 1 from public.clinical_visits)
    or exists (select 1 from public.clinical_visit_inventory_deductions)
    or exists (select 1 from public.audit_logs) then
    raise exception 'Reset verification failed: patient, visit, inventory-deduction, or audit data remains.';
  end if;

  if exists (
    (select id, auth_user_id, name, last_name, first_name, middle_initial, role, username,
            password_hash, status, deleted_at, created_at, updated_at
     from public.clinic_users
     except
     select id, auth_user_id, name, last_name, first_name, middle_initial, role, username,
            password_hash, status, deleted_at, created_at, updated_at
     from _clinic_reset_users)
    union all
    (select id, auth_user_id, name, last_name, first_name, middle_initial, role, username,
            password_hash, status, deleted_at, created_at, updated_at
     from _clinic_reset_users
     except
     select id, auth_user_id, name, last_name, first_name, middle_initial, role, username,
            password_hash, status, deleted_at, created_at, updated_at
     from public.clinic_users)
  ) then
    raise exception 'Reset verification failed: clinic user accounts or permissions changed.';
  end if;

  if exists (
    (select code, name, category, quantity, unit, batch_number, expiration_date, supplier,
            deleted_at, created_at, updated_at
     from public.medicines
     except
     select code, name, category, quantity, unit, batch_number, expiration_date, supplier,
            deleted_at, created_at, updated_at
     from _clinic_reset_medicines)
    union all
    (select code, name, category, quantity, unit, batch_number, expiration_date, supplier,
            deleted_at, created_at, updated_at
     from _clinic_reset_medicines
     except
     select code, name, category, quantity, unit, batch_number, expiration_date, supplier,
            deleted_at, created_at, updated_at
     from public.medicines)
  ) then
    raise exception 'Reset verification failed: medicine records, quantities, or expiration dates changed.';
  end if;

  if exists (
    (select id, name, category, quantity, condition, last_maintenance_date, status,
            deleted_at, created_at, updated_at
     from public.equipment
     except
     select id, name, category, quantity, condition, last_maintenance_date, status,
            deleted_at, created_at, updated_at
     from _clinic_reset_equipment)
    union all
    (select id, name, category, quantity, condition, last_maintenance_date, status,
            deleted_at, created_at, updated_at
     from _clinic_reset_equipment
     except
     select id, name, category, quantity, condition, last_maintenance_date, status,
            deleted_at, created_at, updated_at
     from public.equipment)
  ) then
    raise exception 'Reset verification failed: medical supply or equipment records or quantities changed.';
  end if;

  if exists (
    select 1
    from public.clinic_state as clinic,
         jsonb_array_elements(
           case
             when jsonb_typeof(clinic.state->'inventoryTransactions') = 'array'
               then clinic.state->'inventoryTransactions'
             else '[]'::jsonb
           end
         ) as ledger(entry)
    where clinic.id = 1
      and exists (
        select 1 from _clinic_reset_visit_ids as visit
        where visit.id = entry->>'referenceId'
      )
  ) then
    raise exception 'Reset verification failed: visit-linked inventory entries remain in the compatibility snapshot.';
  end if;
end;
$$;

commit;
