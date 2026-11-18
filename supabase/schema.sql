-- MQC School Clinic Management System
-- Run this file in Supabase SQL Editor for the normalized schema.
-- clinic_state is retained for compatibility with the current snapshot API.

create extension if not exists "pgcrypto";

create table if not exists public.clinic_users (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  last_name text not null,
  first_name text not null,
  middle_initial text,
  role text not null check (role in ('Head Nurse & Administrator', 'Head Nurse', 'Staff Nurse', 'Super Admin')),
  username text not null unique,
  appearance_theme text not null default 'ocean',
  password_hash text,
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinic_users
  add column if not exists appearance_theme text not null default 'ocean';
alter table public.clinic_users
  drop constraint if exists clinic_users_role_check;
alter table public.clinic_users
  add constraint clinic_users_role_check
  check (role in ('Head Nurse & Administrator', 'Head Nurse', 'Staff Nurse', 'Super Admin'));

create table if not exists public.patients (
  id text primary key,
  last_name text not null,
  first_name text not null,
  middle_initial text,
  name text not null,
  course text not null,
  year_level text not null,
  institutional_category text,
  personnel_type text,
  gender text,
  age integer constraint patients_age_check check (age is null or age between 0 and 120),
  contact text,
  guardian_name text,
  guardian_contact text,
  allergies text default 'Not Yet Assessed',
  medical_conditions text default 'None',
  symptoms jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patients alter column allergies set default 'Not Yet Assessed';
alter table public.patients
  add column if not exists symptoms jsonb not null default '[]'::jsonb;
alter table public.patients
  add column if not exists institutional_category text,
  add column if not exists personnel_type text;
update public.patients
set institutional_category = course
where institutional_category is null;

create table if not exists public.medicines (
  code text primary key,
  name text not null,
  category text not null default 'General',
  quantity integer not null default 0 constraint medicines_quantity_check check (quantity >= 0),
  unit text not null,
  -- Legacy row-level metadata is retained only for migration into batch records.
  batch_number text,
  expiration_date date,
  supplier text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id text primary key,
  name text not null,
  category text not null default 'Medical Supplies' check (category in ('Medical Equipment', 'Medical Supplies')),
  quantity integer not null default 0 check (quantity >= 0),
  -- Retained for historical equipment data; the Medical Supplies UI does not expose condition.
  condition text not null default 'Good' check (condition in ('Good', 'Fair', 'Poor')),
  last_maintenance_date date,
  status text not null default 'Available' check (status in ('Available', 'Under Maintenance', 'Damaged', 'Replacement Needed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Temporary legacy column used to migrate existing item-level dates to batches below.
alter table public.medicines
  add column if not exists production_date date;

alter table public.medicines
  add column if not exists batches jsonb not null default '[]'::jsonb;

alter table public.equipment
  add column if not exists batches jsonb not null default '[]'::jsonb;

alter table public.equipment
  add column if not exists category text not null default 'Medical Equipment';
alter table public.equipment
  alter column category set default 'Medical Supplies';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipment_category_check' and conrelid = 'public.equipment'::regclass) then
    alter table public.equipment add constraint equipment_category_check check (category in ('Medical Equipment', 'Medical Supplies')) not valid;
  end if;
end;
$$;

update public.equipment
set category = 'Medical Supplies'
where lower(btrim(name)) = any(array[
  'cotton balls',
  'elastic bandage',
  'adhesive bandages (band-aids)',
  'gauze pads',
  'medical tape',
  'disposable face masks',
  'medical gloves',
  'bandage',
  'white flower oil',
  'mupirocin',
  'eye mo',
  'alcohol',
  'alcohol (70% isopropyl)'
]);

create table if not exists public.clinical_visits (
  id text primary key,
  patient_id text not null references public.patients(id) on delete cascade,
  nurse_id text references public.clinic_users(id) on delete set null,
  nurse_name text not null,
  visit_date date not null,
  visit_time text not null,
  complaint text not null,
  description text,
  symptom_start text,
  pain_level text,
  pain_location text,
  symptoms jsonb not null default '[]'::jsonb,
  known_conditions text,
  allergies_history text,
  current_medication text,
  previous_similar text,
  last_meal text,
  weight text,
  height text,
  temperature text,
  blood_pressure text,
  heart_rate text,
  respiratory_rate text,
  oxygen_saturation text,
  assessment text,
  assessment_other text,
  notes text,
  interventions jsonb not null default '[]'::jsonb,
  treatment_given text,
  treatment_items jsonb not null default '[]'::jsonb,
  medicine_code text references public.medicines(code) on delete set null,
  medicine_name text,
  medicine_quantity integer check (medicine_quantity is null or medicine_quantity > 0),
  equipment_used jsonb not null default '[]'::jsonb,
  equipment_quantity integer check (equipment_quantity is null or equipment_quantity > 0),
  supply_used text,
  supply_item_id text references public.equipment(id) on delete set null,
  supply_quantity integer check (supply_quantity is null or supply_quantity > 0),
  dosage text,
  outcome text not null,
  released_at text,
  remarks text,
  guardian_contacted text,
  guardian_method text,
  person_contacted text,
  staff_record text,
  position text,
  status text not null default 'Active' check (status in ('Active', 'Superseded', 'Deleted')),
  version_of text,
  revision integer not null default 1,
  supersedes_id text,
  superseded_by text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_visits
  add column if not exists treatment_items jsonb not null default '[]'::jsonb;

-- Visit outcome is optional clinical information; legacy rows remain unchanged.
alter table public.clinical_visits
  alter column outcome drop not null;

create or replace function public.prevent_patient_delete_with_undeleted_visits()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.clinical_visits
    where patient_id = old.id
      and deleted_at is null
      and status <> 'Deleted'
  ) then
    raise exception 'Patient records with visits outside Deleted Records cannot be permanently removed.'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists patients_prevent_delete_with_undeleted_visits on public.patients;
create trigger patients_prevent_delete_with_undeleted_visits
before delete on public.patients
for each row execute function public.prevent_patient_delete_with_undeleted_visits();

-- Add the patient link when upgrading installations created before visits were
-- normalized with a patient_id column.
alter table public.clinical_visits
  add column if not exists patient_id text;

alter table public.clinical_visits
  add column if not exists respiratory_rate text,
  add column if not exists reason_other text,
  add column if not exists equipment_used jsonb not null default '[]'::jsonb,
  add column if not exists equipment_quantity integer,
  add column if not exists supply_used text,
  add column if not exists supply_item_id text references public.equipment(id) on delete set null,
  add column if not exists supply_quantity integer;

update public.equipment as inventory
set category = 'Medical Supplies'
where inventory.category = 'Medical Equipment'
  and exists (
    select 1 from public.clinical_visits as visits
    where visits.supply_item_id = inventory.id
      or lower(btrim(visits.supply_used)) = lower(btrim(inventory.name))
  );

update public.clinical_visits
set guardian_contacted = case lower(btrim(guardian_contacted))
  when 'yes' then 'Yes'
  when 'no' then 'No'
  when 'not applical' then 'Not Applicable'
  when 'not applicable' then 'Not Applicable'
  when 'n/a' then 'Not Applicable'
  when 'na' then 'Not Applicable'
  else guardian_contacted
end
where lower(btrim(guardian_contacted)) in ('yes', 'no', 'not applical', 'not applicable', 'n/a', 'na');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinical_visits_equipment_quantity_check' and conrelid = 'public.clinical_visits'::regclass) then
    alter table public.clinical_visits add constraint clinical_visits_equipment_quantity_check check (equipment_quantity is null or equipment_quantity > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_visits_supply_quantity_check' and conrelid = 'public.clinical_visits'::regclass) then
    alter table public.clinical_visits add constraint clinical_visits_supply_quantity_check check (supply_quantity is null or supply_quantity > 0) not valid;
  end if;
end;
$$;

create table if not exists public.clinical_visit_inventory_deductions (
  visit_id text not null references public.clinical_visits(id) on delete cascade,
  item_type text not null check (item_type in ('medicine', 'equipment')),
  item_id text not null,
  quantity integer not null check (quantity > 0),
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (visit_id, item_type, item_id)
);

alter table public.clinical_visit_inventory_deductions enable row level security;

drop function if exists public.save_clinical_visit_with_inventory(jsonb, text);

create or replace function public.save_clinical_visit_with_inventory(
  p_visit jsonb,
  p_patient_allergies text,
  p_user_id text,
  p_username text,
  p_user_name text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit public.clinical_visits;
  v_previous public.clinical_visits;
  v_deduction record;
  v_quantity integer;
  v_stock integer;
  v_item_id text;
  v_item_name text;
  v_batch_deduction record;
  v_has_batch_deductions boolean;
  v_has_deductions boolean;
  v_treatment jsonb;
  v_treatment_type text;
begin
  v_visit := jsonb_populate_record(null::public.clinical_visits, p_visit);
  if v_visit.id is null or v_visit.patient_id is null then
    raise exception 'A visit ID and patient ID are required.';
  end if;
  if v_visit.visit_date is null or nullif(btrim(v_visit.visit_time), '') is null then
    raise exception 'A visit date and time are required.';
  end if;
  if nullif(btrim(v_visit.complaint), '') is null then
    raise exception 'A reason for the clinic visit is required.';
  end if;
  if v_visit.guardian_contacted is not null
    and v_visit.guardian_contacted not in ('Yes', 'No', 'Not Applicable') then
    raise exception 'Parent / Guardian Contacted must be Yes, No, or Not Applicable.';
  end if;
  v_visit.treatment_items := coalesce(v_visit.treatment_items, '[]'::jsonb);
  if jsonb_typeof(v_visit.treatment_items) <> 'array' then
    raise exception 'Treatment items must be a list.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_visit.treatment_items) as items(value)
    group by value->>'item_type', value->>'item_id'
    having count(*) > 1
  ) then
    raise exception 'An inventory item cannot be selected more than once.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_visit.id, 0));

  if exists (select 1 from public.clinical_visits where id = v_visit.id) then
    return;
  end if;

  if v_visit.medicine_name is not null and v_visit.medicine_code is null then
    raise exception 'The selected medicine could not be matched to an inventory item.';
  end if;

  if not exists (select 1 from public.patients where id = v_visit.patient_id) then
    raise exception 'The patient record for this visit could not be found.';
  end if;

  if v_visit.supersedes_id is not null then
    select * into v_previous
    from public.clinical_visits
    where id = v_visit.supersedes_id
    for update;

    if found and v_previous.status = 'Active' then
      select exists (
        select 1
        from public.clinical_visit_inventory_deductions
        where visit_id = v_previous.id
      ) into v_has_deductions;

      if v_has_deductions then
        for v_deduction in
          select *
          from public.clinical_visit_inventory_deductions
          where visit_id = v_previous.id and reversed_at is null
          for update
        loop
          if v_deduction.item_type = 'medicine' then
            select exists (
              select 1
              from public.medicine_batch_deductions
              where visit_id = v_previous.id
                and medicine_code = v_deduction.item_id
                and reversed_at is null
            ) into v_has_batch_deductions;
            if v_has_batch_deductions then
              for v_batch_deduction in
                select *
                from public.medicine_batch_deductions
                where visit_id = v_previous.id
                  and medicine_code = v_deduction.item_id
                  and reversed_at is null
                for update
              loop
                update public.medicine_batches
                set quantity = quantity + v_batch_deduction.quantity,
                    updated_at = now()
                where id = v_batch_deduction.batch_id
                  and status = 'Available';
                if found then
                  perform public.refresh_medicine_batch_snapshot(v_deduction.item_id);
                end if;
                update public.medicine_batch_deductions
                set reversed_at = now()
                where visit_id = v_batch_deduction.visit_id
                  and batch_id = v_batch_deduction.batch_id;
              end loop;
            else
              update public.medicines
              set quantity = quantity + v_deduction.quantity
              where code = v_deduction.item_id;
            end if;
          else
            update public.equipment
            set quantity = quantity + v_deduction.quantity
            where id = v_deduction.item_id;
          end if;
          update public.clinical_visit_inventory_deductions
          set reversed_at = now()
          where visit_id = v_deduction.visit_id
            and item_type = v_deduction.item_type
            and item_id = v_deduction.item_id;
        end loop;
      else
        if v_previous.medicine_code is not null and coalesce(v_previous.medicine_quantity, 0) > 0 then
          update public.medicines
          set quantity = quantity + v_previous.medicine_quantity
          where code = v_previous.medicine_code;
        end if;
        v_item_id := v_previous.supply_item_id;
        if v_item_id is null and v_previous.supply_used is not null then
          select id into v_item_id
          from public.equipment
          where name = v_previous.supply_used
          order by id
          limit 1;
        end if;
        if v_item_id is not null and coalesce(v_previous.supply_quantity, 0) > 0 then
          update public.equipment
          set quantity = quantity + v_previous.supply_quantity
          where id = v_item_id;
        end if;
        if jsonb_typeof(v_previous.equipment_used) = 'array' then
          for v_item_name in select jsonb_array_elements_text(v_previous.equipment_used)
          loop
            update public.equipment
            set quantity = quantity + greatest(coalesce(v_previous.equipment_quantity, 1), 1)
            where id = (
              select id from public.equipment where id = v_item_name or name = v_item_name order by id limit 1
            );
          end loop;
        end if;
      end if;

      update public.clinical_visits
      set status = 'Superseded', superseded_by = v_visit.id
      where id = v_previous.id;
    end if;
  end if;

  v_visit.supply_item_id := coalesce(v_visit.supply_item_id, (
    select id from public.equipment where name = v_visit.supply_used order by id limit 1
  ));
  if v_visit.supply_used is not null and v_visit.supply_item_id is null then
    raise exception 'The selected medical supply could not be matched to an inventory item.';
  end if;
  v_visit.created_at := coalesce(v_visit.created_at, now());
  v_visit.updated_at := now();
  insert into public.clinical_visits
  select (v_visit).*;

  if jsonb_array_length(v_visit.treatment_items) = 0 and v_visit.medicine_code is not null then
    v_quantity := v_visit.medicine_quantity;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Medication quantity must be a positive whole number.';
    end if;
    perform public.deduct_medicine_fefo(
      v_visit.medicine_code,
      v_visit.medicine_name,
      v_quantity,
      v_visit.id,
      p_user_id,
      p_username,
      p_user_name,
      p_role
    );
    insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
    values (v_visit.id, 'medicine', v_visit.medicine_code, v_quantity);
  end if;

  if jsonb_array_length(v_visit.treatment_items) = 0 and v_visit.supply_item_id is not null then
    v_quantity := v_visit.supply_quantity;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Supply quantity must be a positive whole number.';
    end if;
    update public.equipment
    set quantity = quantity - v_quantity
    where id = v_visit.supply_item_id
      and name = v_visit.supply_used
      and quantity >= v_quantity
      and status = 'Available'
      and deleted_at is null
    returning quantity + v_quantity into v_stock;
    if not found then
      select quantity into v_stock from public.equipment where id = v_visit.supply_item_id;
      raise exception 'Insufficient stock for %: % available, % requested.',
        coalesce(v_visit.supply_used, v_visit.supply_item_id), coalesce(v_stock, 0), v_quantity
        using errcode = 'P0001';
    end if;
    insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
    values (v_visit.id, 'equipment', v_visit.supply_item_id, v_quantity);
  end if;

  if jsonb_typeof(v_visit.equipment_used) = 'array' then
    for v_item_name in select jsonb_array_elements_text(v_visit.equipment_used)
    loop
      select id into v_item_id
      from public.equipment
      where (id = v_item_name or name = v_item_name)
        and category = 'Medical Equipment' and status = 'Available' and deleted_at is null
      order by id
      limit 1;
      v_quantity := greatest(coalesce(v_visit.equipment_quantity, 1), 1);
      if v_item_id is null then
        raise exception 'Inventory item % is not available.', v_item_name using errcode = 'P0001';
      end if;
      update public.equipment
      set quantity = quantity - v_quantity
      where id = v_item_id and quantity >= v_quantity
      returning quantity + v_quantity into v_stock;
      if not found then
        select quantity into v_stock from public.equipment where id = v_item_id;
        raise exception 'Insufficient stock for %: % available, % requested.',
          v_item_name, coalesce(v_stock, 0), v_quantity using errcode = 'P0001';
      end if;
      insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
      values (v_visit.id, 'equipment', v_item_id, v_quantity);
    end loop;
  end if;

  for v_treatment in
    select value from jsonb_array_elements(v_visit.treatment_items) as items(value)
  loop
    v_treatment_type := v_treatment->>'item_type';
    v_item_id := nullif(btrim(v_treatment->>'item_id'), '');
    v_item_name := nullif(btrim(v_treatment->>'item_name'), '');
    if v_treatment_type is null or v_treatment_type not in ('medicine', 'equipment') or v_item_id is null
      or coalesce(v_treatment->>'quantity', '') !~ '^[1-9][0-9]{0,9}$' then
      raise exception 'Every treatment item requires a valid inventory record and positive whole-number quantity.';
    end if;
    if (v_treatment->>'quantity')::numeric > 2147483647 then
      raise exception 'Treatment quantity exceeds the maximum supported inventory quantity.';
    end if;
    v_quantity := (v_treatment->>'quantity')::integer;
    if v_treatment_type = 'medicine' then
      perform public.deduct_medicine_fefo(
        v_item_id,
        v_item_name,
        v_quantity,
        v_visit.id,
        p_user_id,
        p_username,
        p_user_name,
        p_role
      );
    else
      update public.equipment
      set quantity = quantity - v_quantity
      where id = v_item_id
        and name = v_item_name
        and category = 'Medical Supplies'
        and quantity >= v_quantity
        and status = 'Available'
        and deleted_at is null
      returning quantity + v_quantity into v_stock;
    end if;
    if v_treatment_type = 'equipment' and not found then
      if v_treatment_type = 'medicine' then
        select quantity into v_stock from public.medicines where code = v_item_id;
      else
        select quantity into v_stock from public.equipment where id = v_item_id;
      end if;
      raise exception 'Insufficient stock or unavailable inventory for %: % available, % requested.',
        coalesce(v_item_name, v_item_id), coalesce(v_stock, 0), v_quantity
        using errcode = 'P0001';
    end if;
    insert into public.clinical_visit_inventory_deductions
      (visit_id, item_type, item_id, quantity)
    values
      (v_visit.id, v_treatment_type, v_item_id, v_quantity);
    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details, module, status
    ) values (
      p_user_id,
      coalesce(nullif(btrim(p_user_name), ''), v_visit.nurse_name),
      nullif(btrim(p_username), ''),
      coalesce(nullif(btrim(p_role), ''), 'Unknown'),
      format('Treatment inventory deducted — %s × %s — visit %s',
        v_item_name, v_quantity, v_visit.id),
      format('Inventory record %s; quantity deducted: %s; patient visit: %s',
        v_item_id, v_quantity, v_visit.id),
      case when v_treatment_type = 'medicine' then 'Medicines' else 'Medical Supplies' end,
      'Success'
    );
  end loop;

  update public.patients
  set allergies = coalesce(p_patient_allergies, allergies)
  where id = v_visit.patient_id;
end;
$$;

create or replace function public.update_clinical_visit_with_inventory(
  p_visit jsonb,
  p_patient_allergies text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit public.clinical_visits;
  v_previous public.clinical_visits;
  v_old_medicine_quantity integer;
  v_old_supply_quantity integer;
  v_old_supply_id text;
  v_new_supply_id text;
  v_delta integer;
  v_deduction record;
  v_item_id text;
  v_requested_ids text[];
  v_selected_values text[];
begin
  select * into v_previous
  from public.clinical_visits
  where id = p_visit->>'id'
  for update;
  if not found or v_previous.status <> 'Active' or v_previous.deleted_at is not null then
    raise exception 'The active visit to update could not be found.';
  end if;

  v_visit := jsonb_populate_record(v_previous, p_visit);
  if v_visit.patient_id is distinct from v_previous.patient_id then
    raise exception 'A visit cannot be reassigned to a different patient.';
  end if;
  if v_visit.visit_date is null or nullif(btrim(v_visit.visit_time), '') is null then
    raise exception 'A visit date and time are required.';
  end if;
  if nullif(btrim(v_visit.complaint), '') is null then
    raise exception 'A reason for the clinic visit is required.';
  end if;
  if v_visit.medicine_name = '' then v_visit.medicine_name := null; end if;
  if v_visit.medicine_name is not null and v_visit.medicine_code is null then
    raise exception 'The selected medicine could not be matched to an inventory item.';
  end if;
  if v_visit.medicine_code is not null and (v_visit.medicine_quantity is null or v_visit.medicine_quantity <= 0) then
    raise exception 'Medication quantity must be a positive whole number.';
  end if;

  v_old_supply_id := v_previous.supply_item_id;
  if v_old_supply_id is null and v_previous.supply_used is not null then
    select id into v_old_supply_id from public.equipment
    where category = 'Medical Supplies'
      and (id = v_previous.supply_used or lower(btrim(name)) = lower(btrim(v_previous.supply_used)))
    order by (id = v_previous.supply_used) desc, id limit 1;
  end if;
  v_new_supply_id := v_visit.supply_item_id;
  if v_new_supply_id is not null then
    select id, name into v_new_supply_id, v_visit.supply_used
    from public.equipment
    where id = v_new_supply_id and category = 'Medical Supplies';
    if not found then
      raise exception 'The selected inventory record could not be matched to a medical supplies item.';
    end if;
  elsif v_visit.supply_used is not null then
    select id, name into v_new_supply_id, v_visit.supply_used
    from public.equipment
    where category = 'Medical Supplies'
      and (id = v_visit.supply_used or lower(btrim(name)) = lower(btrim(v_visit.supply_used)))
    order by (id = v_visit.supply_used) desc, id limit 1;
  end if;
  if v_visit.supply_used is not null and v_new_supply_id is null then
    raise exception 'The selected medical supply could not be matched to inventory.';
  end if;
  v_visit.supply_item_id := v_new_supply_id;
  if v_new_supply_id is not null and (v_visit.supply_quantity is null or v_visit.supply_quantity <= 0) then
    raise exception 'Supply quantity must be a positive whole number.';
  end if;
  if jsonb_typeof(v_visit.equipment_used) <> 'array' then
    raise exception 'Medical equipment selections must be an array of inventory IDs.';
  end if;
  if jsonb_array_length(v_visit.equipment_used) > 0
    and (v_visit.equipment_quantity is null or v_visit.equipment_quantity <= 0) then
    raise exception 'Equipment quantity must be a positive whole number.';
  end if;
  select coalesce(array_agg(distinct value), array[]::text[])
    into v_selected_values
  from jsonb_array_elements_text(v_visit.equipment_used) as selections(value);
  if exists (
    select 1 from unnest(v_selected_values) as requested(item_id)
    where not exists (
      select 1 from public.equipment
      where (id = requested.item_id or name = requested.item_id)
        and category = 'Medical Equipment'
    ) and not exists (
      select 1 from jsonb_array_elements_text(v_previous.equipment_used) as previous_values(value)
      where previous_values.value = requested.item_id
    )
  ) then
    raise exception 'A selected item is not a medical equipment inventory record.';
  end if;
  select coalesce(array_agg(distinct equipment.id), array[]::text[])
    into v_requested_ids
  from unnest(v_selected_values) as requested(item_id)
  join public.equipment on (equipment.id = requested.item_id or equipment.name = requested.item_id)
    and equipment.category = 'Medical Equipment';

  select coalesce(sum(quantity), 0)::integer into v_old_medicine_quantity
  from public.clinical_visit_inventory_deductions
  where visit_id = v_previous.id and item_type = 'medicine' and reversed_at is null;
  if v_old_medicine_quantity = 0 then
    v_old_medicine_quantity := case when v_previous.medicine_code is null then 0 else coalesce(v_previous.medicine_quantity, 0) end;
  end if;
  select coalesce(sum(quantity), 0)::integer into v_old_supply_quantity
  from public.clinical_visit_inventory_deductions
  where visit_id = v_previous.id and item_type = 'equipment'
    and item_id = coalesce(v_old_supply_id, '') and reversed_at is null;
  if v_old_supply_quantity = 0 then
    v_old_supply_quantity := case when v_old_supply_id is null then 0 else coalesce(v_previous.supply_quantity, 0) end;
  end if;

  if v_previous.medicine_code is not distinct from v_visit.medicine_code then
    v_delta := v_old_medicine_quantity - coalesce(v_visit.medicine_quantity, 0);
    if v_delta > 0 then
      if not exists (select 1 from public.medicines where code = v_previous.medicine_code) then
        raise exception 'The historical medicine is no longer in inventory, so its recorded quantity cannot be changed.';
      end if;
      update public.medicines set quantity = quantity + v_delta where code = v_previous.medicine_code;
    elsif v_delta < 0 then
      update public.medicines
      set quantity = quantity + v_delta
      where code = v_visit.medicine_code and deleted_at is null
        and (expiration_date is null or expiration_date >= current_date)
        and quantity >= -v_delta;
      if not found then raise exception 'The selected medicine is unavailable or has insufficient stock.' using errcode = 'P0001'; end if;
    end if;
  else
    if v_previous.medicine_code is not null and v_old_medicine_quantity > 0 then
      update public.medicines set quantity = quantity + v_old_medicine_quantity where code = v_previous.medicine_code;
    end if;
    if v_visit.medicine_code is not null then
      update public.medicines
      set quantity = quantity - v_visit.medicine_quantity
      where code = v_visit.medicine_code and name = v_visit.medicine_name
        and deleted_at is null and (expiration_date is null or expiration_date >= current_date)
        and quantity >= v_visit.medicine_quantity;
      if not found then raise exception 'The selected medicine is unavailable or has insufficient stock.' using errcode = 'P0001'; end if;
    end if;
  end if;

  if v_old_supply_id is not distinct from v_new_supply_id then
    v_delta := v_old_supply_quantity - coalesce(v_visit.supply_quantity, 0);
    if v_delta > 0 then
      update public.equipment set quantity = quantity + v_delta where id = v_old_supply_id;
    elsif v_delta < 0 then
      update public.equipment
      set quantity = quantity + v_delta
      where id = v_new_supply_id and category = 'Medical Supplies'
        and status = 'Available' and deleted_at is null and quantity >= -v_delta;
      if not found then raise exception 'The selected medical supply is unavailable or has insufficient stock.' using errcode = 'P0001'; end if;
    end if;
  else
    if v_old_supply_id is not null and v_old_supply_quantity > 0 then
      update public.equipment set quantity = quantity + v_old_supply_quantity where id = v_old_supply_id;
    end if;
    if v_new_supply_id is not null then
      update public.equipment
      set quantity = quantity - v_visit.supply_quantity
      where id = v_new_supply_id and name = v_visit.supply_used
        and category = 'Medical Supplies' and status = 'Available'
        and deleted_at is null and quantity >= v_visit.supply_quantity;
      if not found then raise exception 'The selected medical supply is unavailable or has insufficient stock.' using errcode = 'P0001'; end if;
    end if;
  end if;

  for v_deduction in
    select * from public.clinical_visit_inventory_deductions
    where visit_id = v_previous.id and item_type = 'equipment'
      and item_id <> coalesce(v_old_supply_id, '') and reversed_at is null
    for update
  loop
    if v_deduction.item_id = any(v_requested_ids) then
      v_delta := v_deduction.quantity - v_visit.equipment_quantity;
      if v_delta > 0 then
        update public.equipment set quantity = quantity + v_delta where id = v_deduction.item_id;
      elsif v_delta < 0 then
        update public.equipment set quantity = quantity + v_delta
        where id = v_deduction.item_id and category = 'Medical Equipment'
          and status = 'Available' and deleted_at is null and quantity >= -v_delta;
        if not found then raise exception 'The selected medical equipment is unavailable or has insufficient stock.' using errcode = 'P0001'; end if;
      end if;
      update public.clinical_visit_inventory_deductions
      set quantity = v_visit.equipment_quantity
      where visit_id = v_previous.id and item_type = 'equipment' and item_id = v_deduction.item_id;
    else
      update public.equipment set quantity = quantity + v_deduction.quantity where id = v_deduction.item_id;
      update public.clinical_visit_inventory_deductions
      set reversed_at = now()
      where visit_id = v_previous.id and item_type = 'equipment' and item_id = v_deduction.item_id;
    end if;
  end loop;

  foreach v_item_id in array v_requested_ids
  loop
    if not exists (
      select 1 from public.clinical_visit_inventory_deductions
      where visit_id = v_previous.id and item_type = 'equipment'
        and item_id = v_item_id and reversed_at is null
    ) then
      update public.equipment set quantity = quantity - v_visit.equipment_quantity
      where id = v_item_id and category = 'Medical Equipment'
        and status = 'Available' and deleted_at is null
        and quantity >= v_visit.equipment_quantity;
      if not found then raise exception 'The selected medical equipment is unavailable or has insufficient stock.' using errcode = 'P0001'; end if;
      insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity, reversed_at)
      values (v_previous.id, 'equipment', v_item_id, v_visit.equipment_quantity, null)
      on conflict (visit_id, item_type, item_id) do update
      set quantity = excluded.quantity, reversed_at = null;
    end if;
  end loop;

  update public.clinical_visit_inventory_deductions
  set reversed_at = now()
  where visit_id = v_previous.id and reversed_at is null
    and ((item_type = 'medicine' and item_id = coalesce(v_previous.medicine_code, '') and v_previous.medicine_code is distinct from v_visit.medicine_code)
      or (item_type = 'equipment' and item_id = coalesce(v_old_supply_id, '') and v_old_supply_id is distinct from v_new_supply_id));
  if v_visit.medicine_code is not null then
    insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity, reversed_at)
    values (v_visit.id, 'medicine', v_visit.medicine_code, v_visit.medicine_quantity, null)
    on conflict (visit_id, item_type, item_id) do update
    set quantity = excluded.quantity, reversed_at = null;
  end if;
  if v_new_supply_id is not null then
    insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity, reversed_at)
    values (v_visit.id, 'equipment', v_new_supply_id, v_visit.supply_quantity, null)
    on conflict (visit_id, item_type, item_id) do update
    set quantity = excluded.quantity, reversed_at = null;
  end if;

  v_visit.created_at := v_previous.created_at;
  v_visit.updated_at := now();
  v_visit.status := 'Active';
  v_visit.deleted_at := null;
  update public.clinical_visits set
    nurse_id = v_visit.nurse_id, nurse_name = v_visit.nurse_name, visit_date = v_visit.visit_date,
    visit_time = v_visit.visit_time, complaint = v_visit.complaint, reason_other = v_visit.reason_other,
    description = v_visit.description, symptom_start = v_visit.symptom_start, pain_level = v_visit.pain_level,
    pain_location = v_visit.pain_location, symptoms = v_visit.symptoms, known_conditions = v_visit.known_conditions,
    allergies_history = v_visit.allergies_history, current_medication = v_visit.current_medication,
    previous_similar = v_visit.previous_similar, last_meal = v_visit.last_meal, weight = v_visit.weight,
    height = v_visit.height, temperature = v_visit.temperature, blood_pressure = v_visit.blood_pressure,
    heart_rate = v_visit.heart_rate, respiratory_rate = v_visit.respiratory_rate,
    oxygen_saturation = v_visit.oxygen_saturation, assessment = v_visit.assessment,
    assessment_other = v_visit.assessment_other, notes = v_visit.notes, interventions = v_visit.interventions,
    treatment_given = v_visit.treatment_given, medicine_code = v_visit.medicine_code,
    medicine_name = v_visit.medicine_name, medicine_quantity = v_visit.medicine_quantity,
    equipment_used = v_visit.equipment_used, equipment_quantity = v_visit.equipment_quantity,
    supply_used = v_visit.supply_used, supply_item_id = v_visit.supply_item_id,
    supply_quantity = v_visit.supply_quantity, dosage = v_visit.dosage, outcome = v_visit.outcome,
    released_at = v_visit.released_at, remarks = v_visit.remarks,
    guardian_contacted = v_visit.guardian_contacted, guardian_method = v_visit.guardian_method,
    person_contacted = v_visit.person_contacted, staff_record = v_visit.staff_record,
    position = v_visit.position, version_of = v_previous.version_of, revision = v_previous.revision,
    supersedes_id = v_previous.supersedes_id, superseded_by = v_previous.superseded_by,
    updated_at = v_visit.updated_at
  where id = v_previous.id and patient_id = v_previous.patient_id and status = 'Active';

  update public.patients set allergies = coalesce(p_patient_allergies, allergies)
  where id = v_previous.patient_id;
end;
$$;

-- Patient profiles are saved separately from clinical visits.
drop function if exists public.save_new_patient_with_initial_visit(jsonb, jsonb, text);

create or replace function public.set_clinical_visit_inventory_status(
  p_visit_id text,
  p_deleted boolean,
  p_restore_patient boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit public.clinical_visits;
  v_deduction record;
  v_item_id text;
  v_item_name text;
  v_quantity integer;
  v_stock integer;
  v_has_deductions boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_visit_id, 0));
  select * into v_visit
  from public.clinical_visits
  where id = p_visit_id
  for update;
  if not found then
    raise exception 'The clinical visit could not be found.';
  end if;

  if p_deleted then
    if v_visit.status = 'Deleted' then
      raise exception 'The clinical visit is already deleted.';
    end if;
    if v_visit.status <> 'Active' then
      raise exception 'Only an active clinical visit can be deleted.';
    end if;
    select exists (
      select 1 from public.clinical_visit_inventory_deductions where visit_id = v_visit.id
    ) into v_has_deductions;
    if v_has_deductions then
      for v_deduction in
        select *
        from public.clinical_visit_inventory_deductions
        where visit_id = v_visit.id and reversed_at is null
        for update
      loop
        if v_deduction.item_type = 'medicine' then
          update public.medicines set quantity = quantity + v_deduction.quantity where code = v_deduction.item_id;
        else
          update public.equipment set quantity = quantity + v_deduction.quantity where id = v_deduction.item_id;
        end if;
        update public.clinical_visit_inventory_deductions
        set reversed_at = now()
        where visit_id = v_deduction.visit_id and item_type = v_deduction.item_type and item_id = v_deduction.item_id;
      end loop;
    else
      if v_visit.medicine_code is not null and coalesce(v_visit.medicine_quantity, 0) > 0 then
        update public.medicines set quantity = quantity + v_visit.medicine_quantity where code = v_visit.medicine_code;
        insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity, reversed_at)
        values (v_visit.id, 'medicine', v_visit.medicine_code, v_visit.medicine_quantity, now());
      end if;
      v_item_id := v_visit.supply_item_id;
      if v_item_id is null and v_visit.supply_used is not null then
        select id into v_item_id from public.equipment where name = v_visit.supply_used order by id limit 1;
      end if;
      if v_item_id is not null and coalesce(v_visit.supply_quantity, 0) > 0 then
        update public.equipment set quantity = quantity + v_visit.supply_quantity where id = v_item_id;
        insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity, reversed_at)
        values (v_visit.id, 'equipment', v_item_id, v_visit.supply_quantity, now());
      end if;
      if jsonb_typeof(v_visit.equipment_used) = 'array' then
        for v_item_name in select jsonb_array_elements_text(v_visit.equipment_used)
        loop
          select id into v_item_id from public.equipment where id = v_item_name or name = v_item_name order by id limit 1;
          if v_item_id is not null then
            v_quantity := greatest(coalesce(v_visit.equipment_quantity, 1), 1);
            update public.equipment set quantity = quantity + v_quantity where id = v_item_id;
            insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity, reversed_at)
            values (v_visit.id, 'equipment', v_item_id, v_quantity, now());
          end if;
        end loop;
      end if;
    end if;
    update public.clinical_visits set status = 'Deleted', deleted_at = now() where id = v_visit.id;
  else
    if v_visit.status <> 'Deleted' then
      raise exception 'The clinical visit is no longer deleted.';
    end if;
    select exists (
      select 1 from public.clinical_visit_inventory_deductions where visit_id = v_visit.id
    ) into v_has_deductions;
    if v_has_deductions then
      for v_deduction in
        select *
        from public.clinical_visit_inventory_deductions
        where visit_id = v_visit.id and reversed_at is not null
        for update
      loop
        if v_deduction.item_type = 'medicine' then
          update public.medicines
          set quantity = quantity - v_deduction.quantity
          where code = v_deduction.item_id
            and quantity >= v_deduction.quantity
            and deleted_at is null
            and (expiration_date is null or expiration_date >= current_date)
          returning quantity + v_deduction.quantity into v_stock;
        else
          update public.equipment
          set quantity = quantity - v_deduction.quantity
          where id = v_deduction.item_id
            and quantity >= v_deduction.quantity
            and status = 'Available'
            and deleted_at is null
          returning quantity + v_deduction.quantity into v_stock;
        end if;
        if not found then
          raise exception 'Insufficient inventory to restore visit %.', v_visit.id using errcode = 'P0001';
        end if;
        update public.clinical_visit_inventory_deductions
        set reversed_at = null
        where visit_id = v_deduction.visit_id and item_type = v_deduction.item_type and item_id = v_deduction.item_id;
      end loop;
    else
      if v_visit.medicine_code is not null and coalesce(v_visit.medicine_quantity, 0) > 0 then
        update public.medicines
        set quantity = quantity - v_visit.medicine_quantity
        where code = v_visit.medicine_code
          and quantity >= v_visit.medicine_quantity
          and deleted_at is null
          and (expiration_date is null or expiration_date >= current_date)
        returning quantity + v_visit.medicine_quantity into v_stock;
        if not found then
          raise exception 'Insufficient inventory to restore visit %.', v_visit.id using errcode = 'P0001';
        end if;
        insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
        values (v_visit.id, 'medicine', v_visit.medicine_code, v_visit.medicine_quantity);
      end if;
      v_item_id := v_visit.supply_item_id;
      if v_item_id is null and v_visit.supply_used is not null then
        select id into v_item_id from public.equipment where name = v_visit.supply_used order by id limit 1;
      end if;
      if v_item_id is not null and coalesce(v_visit.supply_quantity, 0) > 0 then
        update public.equipment
        set quantity = quantity - v_visit.supply_quantity
        where id = v_item_id
          and quantity >= v_visit.supply_quantity
          and status = 'Available'
          and deleted_at is null
        returning quantity + v_visit.supply_quantity into v_stock;
        if not found then
          raise exception 'Insufficient inventory to restore visit %.', v_visit.id using errcode = 'P0001';
        end if;
        insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
        values (v_visit.id, 'equipment', v_item_id, v_visit.supply_quantity);
      end if;
      if jsonb_typeof(v_visit.equipment_used) = 'array' then
        for v_item_name in select jsonb_array_elements_text(v_visit.equipment_used)
        loop
          select id into v_item_id from public.equipment where id = v_item_name or name = v_item_name order by id limit 1;
          v_quantity := greatest(coalesce(v_visit.equipment_quantity, 1), 1);
          update public.equipment
          set quantity = quantity - v_quantity
          where id = v_item_id
            and quantity >= v_quantity
            and status = 'Available'
            and deleted_at is null
          returning quantity + v_quantity into v_stock;
          if not found then
            raise exception 'Insufficient inventory to restore visit %.', v_visit.id using errcode = 'P0001';
          end if;
          insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
          values (v_visit.id, 'equipment', v_item_id, v_quantity);
        end loop;
      end if;
    end if;
    update public.clinical_visits set status = 'Active', deleted_at = null where id = v_visit.id;
    if p_restore_patient then
      update public.patients set deleted_at = null, deleted_by = null where id = v_visit.patient_id;
    end if;
  end if;
end;
$$;

revoke all on function public.save_clinical_visit_with_inventory(jsonb, text, text, text, text, text) from public;
grant execute on function public.save_clinical_visit_with_inventory(jsonb, text, text, text, text, text) to service_role;
revoke all on function public.update_clinical_visit_with_inventory(jsonb, text) from public;
grant execute on function public.update_clinical_visit_with_inventory(jsonb, text) to service_role;
revoke all on function public.set_clinical_visit_inventory_status(text, boolean, boolean) from public;
grant execute on function public.set_clinical_visit_inventory_status(text, boolean, boolean) to service_role;

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  user_id text references public.clinic_users(id) on delete set null,
  user_name text not null,
  username text,
  role text not null default 'Unknown',
  action text not null,
  event_details text,
  lockout_duration_minutes integer,
  module text not null,
  status text not null default 'Success',
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists role text not null default 'Unknown';
alter table public.audit_logs add column if not exists username text;
alter table public.audit_logs add column if not exists event_details text;
alter table public.audit_logs add column if not exists lockout_duration_minutes integer;
alter table public.audit_logs drop constraint if exists audit_logs_status_check;
alter table public.audit_logs
  add constraint audit_logs_status_check
  check (status in ('Success', 'Warning', 'Error', 'Locked', 'Disabled'));
drop trigger if exists audit_logs_prevent_mutation on public.audit_logs;
update public.audit_logs as logs
set role = users.role
from public.clinic_users as users
where logs.user_id = users.id and logs.role = 'Unknown';

alter table public.audit_logs enable row level security;

-- Audit writes use the server-side secret key; do not expose direct anon/authenticated access.
drop policy if exists "audit_logs_all_access" on public.audit_logs;

create table if not exists public.clinic_sessions (
  user_id text primary key references public.clinic_users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.clinic_sessions
  add column if not exists last_activity_at timestamptz not null default now();

alter table public.clinic_sessions enable row level security;
revoke all on public.clinic_sessions from public, anon, authenticated;

create or replace function public.release_clinic_session_on_account_inactive()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (old.status = 'Active' and new.status = 'Disabled')
    or (old.deleted_at is null and new.deleted_at is not null) then
    delete from public.clinic_sessions where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.release_clinic_session_on_account_inactive() from public, anon, authenticated;
drop trigger if exists clinic_users_release_session_on_inactive on public.clinic_users;
create trigger clinic_users_release_session_on_inactive
after update of status, deleted_at on public.clinic_users
for each row execute function public.release_clinic_session_on_account_inactive();

create table if not exists public.clinic_login_attempts (
  username text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  lockout_stage smallint not null default 0,
  locked_until timestamptz,
  permanently_disabled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.clinic_login_attempts
  add column if not exists lockout_stage smallint not null default 0;
alter table public.clinic_login_attempts
  add column if not exists permanently_disabled_at timestamptz;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clinic_login_attempts'::regclass
      and conname = 'clinic_login_attempts_lockout_stage_check'
  ) then
    alter table public.clinic_login_attempts
      add constraint clinic_login_attempts_lockout_stage_check
      check (lockout_stage between 0 and 4);
  end if;
end;
$$;
update public.clinic_login_attempts
set lockout_stage = 1
where failed_attempts >= 5 and lockout_stage = 0;

alter table public.clinic_login_attempts enable row level security;
revoke all on public.clinic_login_attempts from public, anon, authenticated;

drop function if exists public.get_clinic_login_lockout(text);
create or replace function public.get_clinic_login_lockout(p_username text)
returns table (
  is_locked boolean,
  locked_until timestamptz,
  permanently_disabled boolean,
  lockout_stage smallint,
  failed_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locked_until timestamptz;
  v_permanently_disabled boolean;
  v_lockout_stage smallint;
  v_failed_attempts integer;
begin
  select attempts.locked_until,
         attempts.permanently_disabled_at is not null,
         attempts.lockout_stage,
         attempts.failed_attempts
    into v_locked_until, v_permanently_disabled, v_lockout_stage, v_failed_attempts
  from public.clinic_login_attempts as attempts
  where attempts.username = p_username;

  if not found then
    return query select false, null::timestamptz, false, 0::smallint, 0;
    return;
  end if;

  return query
  select coalesce(v_locked_until > clock_timestamp(), false),
         case when v_locked_until > clock_timestamp() then v_locked_until else null end,
         v_permanently_disabled,
         v_lockout_stage,
         v_failed_attempts;
end;
$$;

drop function if exists public.record_clinic_login_attempt(text, boolean);
create or replace function public.record_clinic_login_attempt(
  p_username text,
  p_succeeded boolean
)
returns table (
  is_locked boolean,
  locked_until timestamptz,
  permanently_disabled boolean,
  lockout_stage smallint,
  failed_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text := p_username;
  v_attempts public.clinic_login_attempts%rowtype;
  v_user public.clinic_users%rowtype;
  v_now timestamptz;
  v_failed_attempts integer;
  v_next_stage smallint;
  v_stage_threshold integer;
  v_lockout_minutes integer;
  v_event_details text;
begin
  if v_username is null or v_username = '' then
    raise exception 'A username is required to record a login attempt.';
  end if;
  if p_succeeded is null then
    raise exception 'A login attempt result is required.';
  end if;

  insert into public.clinic_login_attempts (username)
  values (v_username)
  on conflict (username) do nothing;

  select attempts.*
    into v_attempts
  from public.clinic_login_attempts as attempts
  where attempts.username = v_username
  for update;
  v_now := clock_timestamp();

  if v_attempts.permanently_disabled_at is not null then
    return query select false, null::timestamptz, true,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  if v_attempts.locked_until > v_now then
    return query select true, v_attempts.locked_until, false,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  if v_attempts.locked_until is not null then
    update public.clinic_login_attempts
    set failed_attempts = 0, locked_until = null, updated_at = v_now
    where username = v_username
    returning * into v_attempts;
  end if;

  if p_succeeded then
    update public.clinic_login_attempts
    set failed_attempts = 0,
        lockout_stage = 0,
        locked_until = null,
        updated_at = v_now
    where username = v_username;
    return query select false, null::timestamptz, false, 0::smallint, 0;
    return;
  end if;

  v_failed_attempts := v_attempts.failed_attempts + 1;
  v_stage_threshold := case when v_attempts.lockout_stage = 0 then 5 else 3 end;

  if v_failed_attempts < v_stage_threshold then
    update public.clinic_login_attempts
    set failed_attempts = v_failed_attempts,
        locked_until = null,
        updated_at = v_now
    where username = v_username
    returning * into v_attempts;

    return query select false, null::timestamptz, false,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  v_next_stage := v_attempts.lockout_stage + 1;
  select users.*
    into v_user
  from public.clinic_users as users
  where users.username = v_username
  limit 1;
  if not found then
    raise exception 'The clinic account for this login attempt no longer exists.';
  end if;

  if v_next_stage < 4 then
    v_lockout_minutes := case v_next_stage
      when 1 then 10
      when 2 then 15
      when 3 then 20
    end;
    v_event_details := case v_next_stage
      when 1 then format(
        'Account locked after %s consecutive failed login attempts. Lockout stage 1 of 3; duration %s minutes.',
        v_failed_attempts, v_lockout_minutes
      )
      else format(
        'Account locked after %s additional consecutive failed login attempts following expiration of stage %s lockout. Lockout stage %s of 3; duration %s minutes.',
        v_failed_attempts, v_attempts.lockout_stage, v_next_stage, v_lockout_minutes
      )
    end;

    update public.clinic_login_attempts
    set failed_attempts = v_failed_attempts,
        lockout_stage = v_next_stage,
        locked_until = v_now + make_interval(mins => v_lockout_minutes),
        updated_at = v_now
    where username = v_username
    returning * into v_attempts;

    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details,
      lockout_duration_minutes, module, status, created_at
    )
    values (
      v_user.id, v_user.username, v_user.username, v_user.role,
      'Account Locked', v_event_details, v_lockout_minutes,
      'Authentication', 'Locked', v_now
    );

    return query select true, v_attempts.locked_until, false,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  update public.clinic_login_attempts
  set failed_attempts = v_failed_attempts,
      lockout_stage = 4,
      locked_until = null,
      permanently_disabled_at = v_now,
      updated_at = v_now
  where username = v_username;

  perform set_config('mqc.account_security_transition', 'true', true);
  update public.clinic_users
  set status = 'Disabled'
  where id = v_user.id and status <> 'Disabled';
  perform set_config('mqc.account_security_transition', 'false', true);

  v_event_details := format(
    'Account permanently disabled after %s additional consecutive failed login attempts following expiration of stage 3 lockout. Final lockout stage 4; reason: repeated failed authentication.',
    v_failed_attempts
  );
  insert into public.audit_logs (
    user_id, user_name, username, role, action, event_details,
    lockout_duration_minutes, module, status, created_at
  )
  values (
    v_user.id, v_user.username, v_user.username, v_user.role,
    'Account Permanently Disabled', v_event_details, null,
    'Authentication', 'Disabled', v_now
  );

  return query select false, null::timestamptz, true, 4::smallint, v_failed_attempts;
end;
$$;

revoke all on function public.get_clinic_login_lockout(text) from public, anon, authenticated;
grant execute on function public.get_clinic_login_lockout(text) to service_role;
revoke all on function public.record_clinic_login_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.record_clinic_login_attempt(text, boolean) to service_role;

create or replace function public.create_clinic_session(
  p_user_id text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table (
  created boolean,
  reason text,
  expires_at timestamptz,
  locked_until timestamptz,
  permanently_disabled boolean,
  lockout_stage smallint,
  failed_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
  v_attempts public.clinic_login_attempts%rowtype;
  v_user public.clinic_users%rowtype;
  v_existing_session public.clinic_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at is null
    or p_expires_at <= v_now
    or p_expires_at > v_now + interval '30 days 1 minute' then
    raise exception 'Invalid clinic session details.';
  end if;

  select users.username
    into v_username
  from public.clinic_users as users
  where users.id = p_user_id;
  if not found then
    return query select false, 'account_disabled'::text, null::timestamptz,
                        null::timestamptz, false, 0::smallint, 0;
    return;
  end if;

  insert into public.clinic_login_attempts (username)
  values (v_username)
  on conflict (username) do nothing;

  select attempts.*
    into v_attempts
  from public.clinic_login_attempts as attempts
  where attempts.username = v_username
  for update;
  v_now := clock_timestamp();

  if v_attempts.permanently_disabled_at is not null then
    return query select false, 'permanently_disabled'::text, null::timestamptz,
                        null::timestamptz, true,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;
  if v_attempts.locked_until > v_now then
    return query select false, 'locked'::text, null::timestamptz,
                        v_attempts.locked_until, false,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  select users.*
    into v_user
  from public.clinic_users as users
  where users.id = p_user_id
    and users.username = v_username
  for update;
  if not found or v_user.status <> 'Active' or v_user.deleted_at is not null then
    return query select false, 'account_disabled'::text, null::timestamptz,
                        null::timestamptz, false,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  select sessions.*
    into v_existing_session
  from public.clinic_sessions as sessions
  where sessions.user_id = p_user_id
  for update;

  if found
    and v_existing_session.expires_at > v_now
    and v_existing_session.last_activity_at > v_now - interval '5 minutes' then
    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details,
      module, status, created_at
    )
    values (
      v_user.id, v_user.name, v_user.username, v_user.role,
      'Concurrent Login Rejected',
      'A login was rejected because this account already has an active session on another browser or device.',
      'Authentication', 'Warning', v_now
    );
    return query select false, 'active_session'::text,
                        v_existing_session.expires_at, null::timestamptz, false,
                        v_attempts.lockout_stage, v_attempts.failed_attempts;
    return;
  end if;

  if found then
    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details,
      module, status, created_at
    )
    values (
      v_user.id, v_user.name, v_user.username, v_user.role,
      case
        when v_existing_session.last_activity_at <= v_now - interval '5 minutes'
          then 'Automatic Logout'
        else 'Session Expired'
      end,
      case
        when v_existing_session.last_activity_at <= v_now - interval '5 minutes'
          then 'The session was automatically terminated after 5 consecutive minutes of inactivity.'
        else 'The previous clinic session expired and was released when a new session was established.'
      end,
      'Authentication',
      case
        when v_existing_session.last_activity_at <= v_now - interval '5 minutes'
          then 'Success'
        else 'Warning'
      end,
      v_now
    );
  end if;

  insert into public.clinic_sessions (user_id, token_hash, expires_at, created_at)
  values (p_user_id, p_token_hash, p_expires_at, v_now)
  on conflict (user_id) do update
  set token_hash = excluded.token_hash,
      expires_at = excluded.expires_at,
      last_activity_at = excluded.last_activity_at,
      created_at = excluded.created_at;

  update public.clinic_login_attempts
  set failed_attempts = 0,
      lockout_stage = 0,
      locked_until = null,
      updated_at = v_now
  where username = v_username;

  insert into public.audit_logs (
    user_id, user_name, username, role, action, event_details,
    module, status, created_at
  )
  values (
    v_user.id, v_user.name, v_user.username, v_user.role,
    'Signed In', 'A new clinic session was established.',
    'Authentication', 'Success', v_now
  );

  return query select true, null::text, p_expires_at, null::timestamptz,
                      false, 0::smallint, 0;
end;
$$;

drop function if exists public.validate_clinic_session(text, text);
drop function if exists public.validate_clinic_session(text, text, boolean);
create function public.validate_clinic_session(
  p_user_id text,
  p_token_hash text,
  p_record_activity boolean default false
)
returns table (
  is_valid boolean,
  expired boolean,
  last_activity_at timestamptz,
  user_name text,
  role text,
  username text,
  appearance_theme text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.clinic_sessions%rowtype;
  v_user public.clinic_users%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select sessions.*
    into v_session
  from public.clinic_sessions as sessions
  where sessions.user_id = p_user_id
    and sessions.token_hash = p_token_hash
  for update;

  if not found then
    return query select false, false, null::timestamptz,
      null::text, null::text, null::text, null::text;
    return;
  end if;

  if v_session.last_activity_at <= v_now - interval '5 minutes' then
    delete from public.clinic_sessions as sessions
    where sessions.user_id = p_user_id
      and sessions.token_hash = p_token_hash;

    select users.*
      into v_user
    from public.clinic_users as users
    where users.id = p_user_id;
    if found then
      insert into public.audit_logs (
        user_id, user_name, username, role, action, event_details,
        module, status, created_at
      )
      values (
        v_user.id, v_user.name, v_user.username, v_user.role,
        'Automatic Logout',
        'The session was automatically terminated after 5 consecutive minutes of inactivity.',
        'Authentication', 'Success', v_now
      );
    end if;

    return query select false, true, v_session.last_activity_at,
      null::text, null::text, null::text, null::text;
    return;
  end if;

  select users.*
    into v_user
  from public.clinic_users as users
  where users.id = p_user_id
    and users.status = 'Active'
    and users.deleted_at is null;
  if not found or v_session.expires_at <= v_now then
    return query select false, false, v_session.last_activity_at,
      null::text, null::text, null::text, null::text;
    return;
  end if;

  if p_record_activity then
    update public.clinic_sessions as sessions
    set last_activity_at = v_now
    where sessions.user_id = p_user_id
      and sessions.token_hash = p_token_hash;
    return query select true, false, v_now,
      v_user.name, v_user.role, v_user.username, v_user.appearance_theme;
  else
    return query select true, false, v_session.last_activity_at,
      v_user.name, v_user.role, v_user.username, v_user.appearance_theme;
  end if;
end;
$$;

drop function if exists public.release_clinic_session(text, text);
create or replace function public.release_clinic_session(
  p_user_id text,
  p_token_hash text,
  p_reason text default 'manual'
)
returns table (released boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.clinic_sessions%rowtype;
  v_user public.clinic_users%rowtype;
  v_released_user_id text;
  v_automatic boolean;
  v_now timestamptz := clock_timestamp();
begin
  select sessions.*
    into v_session
  from public.clinic_sessions as sessions
  where sessions.user_id = p_user_id
    and sessions.token_hash = p_token_hash
  for update;
  if not found then
    return query select false;
    return;
  end if;

  v_automatic := p_reason = 'inactivity_timeout'
    or v_session.last_activity_at <= v_now - interval '5 minutes';
  delete from public.clinic_sessions as sessions
  where sessions.user_id = p_user_id
    and sessions.token_hash = p_token_hash
  returning sessions.user_id into v_released_user_id;

  if not found then
    return query select false;
    return;
  end if;

  select users.*
    into v_user
  from public.clinic_users as users
  where users.id = v_released_user_id;
  if found then
    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details,
      module, status, created_at
    )
    values (
      v_user.id, v_user.name, v_user.username, v_user.role,
      case when v_automatic then 'Automatic Logout' else 'Logout' end,
      case when v_automatic
        then 'The session was automatically terminated after 5 consecutive minutes of inactivity.'
        else 'The active clinic session was ended by the account holder.'
      end,
      'Authentication', 'Success', v_now
    );
  end if;

  return query select true;
end;
$$;

revoke all on function public.create_clinic_session(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_clinic_session(text, text, timestamptz) to service_role;
revoke all on function public.validate_clinic_session(text, text, boolean) from public, anon, authenticated;
grant execute on function public.validate_clinic_session(text, text, boolean) to service_role;
revoke all on function public.release_clinic_session(text, text, text) from public, anon, authenticated;
grant execute on function public.release_clinic_session(text, text, text) to service_role;

create or replace function public.reactivate_clinic_user(
  p_user_id text,
  p_actor_id text
)
returns table (id text, name text, role text, username text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.clinic_users%rowtype;
  v_user public.clinic_users%rowtype;
  v_attempts public.clinic_login_attempts%rowtype;
  v_target_username text;
  v_now timestamptz;
begin
  select users.*
    into v_actor
  from public.clinic_users as users
  where users.id = p_actor_id
    and users.status = 'Active'
    and users.deleted_at is null
    and users.role in ('Head Nurse', 'Super Admin')
  limit 1;
  if not found then
    raise exception 'Only an active Head Nurse or Super Admin can reactivate clinic accounts.';
  end if;

  select users.username
    into v_target_username
  from public.clinic_users as users
  where users.id = p_user_id and users.deleted_at is null;
  if not found then
    raise exception 'This clinic account is no longer available.';
  end if;

  insert into public.clinic_login_attempts (username)
  values (v_target_username)
  on conflict (username) do nothing;

  select attempts.*
    into v_attempts
  from public.clinic_login_attempts as attempts
  where attempts.username = v_target_username
  for update;
  v_now := clock_timestamp();

  select users.*
    into v_user
  from public.clinic_users as users
  where users.id = p_user_id
    and users.deleted_at is null
  for update;
  if not found or v_user.status <> 'Disabled' or v_user.username <> v_target_username then
    raise exception 'Only a disabled, non-archived account can be reactivated.';
  end if;

  if (v_user.id = 'SYS-SUPER-ADMIN' or lower(v_user.username) = 'super admin')
    and v_attempts.permanently_disabled_at is null then
    raise exception 'The Super Admin maintenance account can only be reactivated after a permanent security lockout.';
  end if;

  perform set_config('mqc.account_security_transition', 'true', true);
  update public.clinic_users
  set status = 'Active'
  where clinic_users.id = v_user.id
  returning * into v_user;
  perform set_config('mqc.account_security_transition', 'false', true);

  update public.clinic_login_attempts
  set failed_attempts = 0,
      lockout_stage = 0,
      locked_until = null,
      permanently_disabled_at = null,
      updated_at = v_now
  where username = v_user.username;

  insert into public.audit_logs (
    user_id, user_name, username, role, action, event_details,
    module, status, created_at
  )
  values (
    v_actor.id, v_actor.name, v_actor.username, v_actor.role,
    'Account Reactivated',
    format(
      'Account %s reactivated by %s after administrator review; progressive login lockout reset.',
      v_user.username, v_actor.username
    ),
    'Authentication', 'Success', v_now
  );

  return query select v_user.id, v_user.name, v_user.role, v_user.username, v_user.status;
end;
$$;

revoke all on function public.reactivate_clinic_user(text, text) from public, anon, authenticated;
grant execute on function public.reactivate_clinic_user(text, text) to service_role;

create table if not exists public.clinic_settings (
  id integer primary key default 1 check (id = 1),
  clinic_name text not null,
  address text,
  contact_number text,
  email text,
  clinic_open time,
  clinic_close time,
  clinic_days jsonb not null default '[]'::jsonb,
  patient_id_prefix text,
  low_stock_threshold integer not null default 15 check (low_stock_threshold >= 0),
  expiration_alert_days integer not null default 14 check (expiration_alert_days >= 0),
  password_min_length integer not null default 8 check (password_min_length > 0),
  session_timeout_minutes integer not null default 30 check (session_timeout_minutes > 0),
  date_format text not null default 'MMM D, YYYY',
  time_format text not null default '12-hour',
  timezone text not null default 'Asia/Manila',
  language text not null default 'English',
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_state (
  id integer primary key check (id = 1),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Marks the point at which normalized tables become the source of truth.
create table if not exists public.clinic_sync_meta (
  id integer primary key check (id = 1),
  normalized_ready boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Migrate rows from installations that stored patient profiles in public.students.
do $$
begin
  if to_regclass('public.students') is not null then
    execute $migration$
      insert into public.patients (
        id, last_name, first_name, middle_initial, name, course, year_level,
        institutional_category, personnel_type, gender, age, contact,
        guardian_name, guardian_contact, allergies, medical_conditions, symptoms,
        deleted_at, deleted_by, updated_at
      )
      select
        patient_id,
        coalesce(nullif(patient->>'lastName', ''), nullif(patient->>'last_name', ''),
          split_part(coalesce(nullif(patient->>'name', ''), 'Unknown Patient'), ',', 1)),
        coalesce(nullif(patient->>'firstName', ''), nullif(patient->>'first_name', ''),
          case when position(',' in coalesce(patient->>'name', '')) > 0
            then nullif(btrim(split_part(patient->>'name', ',', 2)), '')
            else nullif(patient->>'name', '') end, 'Unknown'),
        coalesce(nullif(patient->>'middleInitial', ''), nullif(patient->>'middle_initial', '')),
        coalesce(nullif(patient->>'name', ''), 'Unknown Patient'),
        coalesce(nullif(patient->>'course', ''), nullif(patient->>'institutionalCategory', ''),
          nullif(patient->>'institutional_category', ''), 'Not recorded'),
        coalesce(nullif(patient->>'year', ''), nullif(patient->>'yearLevel', ''),
          nullif(patient->>'year_level', ''), nullif(patient->>'personnelType', ''),
          nullif(patient->>'personnel_type', ''), 'Not recorded'),
        coalesce(nullif(patient->>'institutionalCategory', ''),
          nullif(patient->>'institutional_category', ''), nullif(patient->>'course', ''),
          'Not recorded'),
        coalesce(nullif(patient->>'personnelType', ''), nullif(patient->>'personnel_type', '')),
        coalesce(nullif(patient->>'gender', ''), nullif(patient->>'sex', '')),
        case when coalesce(patient->>'age', '') ~ '^[0-9]{1,3}$'
          and (patient->>'age')::numeric between 0 and 120
          then (patient->>'age')::integer else null end,
        coalesce(nullif(patient->>'contact', ''), nullif(patient->>'phone', '')),
        coalesce(nullif(patient->>'guardianName', ''), nullif(patient->>'guardian_name', '')),
        coalesce(nullif(patient->>'guardianContact', ''), nullif(patient->>'guardian_contact', '')),
        coalesce(nullif(patient->>'allergies', ''), 'Not Yet Assessed'),
        coalesce(nullif(patient->>'conditions', ''), nullif(patient->>'medicalConditions', ''),
          nullif(patient->>'medical_conditions', ''), 'None'),
        case when jsonb_typeof(patient->'symptoms') = 'array'
          then patient->'symptoms' else '[]'::jsonb end,
        case when lower(coalesce(patient->>'deleted', 'false')) = 'true'
          or patient->>'status' = 'Deleted' then now() else null end,
        coalesce(nullif(patient->>'deletedBy', ''), nullif(patient->>'deleted_by', '')),
        now()
      from (
        select to_jsonb(students) as patient,
          coalesce(
            nullif(to_jsonb(students)->>'id', ''),
            nullif(to_jsonb(students)->>'patient_id', ''),
            nullif(to_jsonb(students)->>'student_id', '')
          ) as patient_id
        from public.students as students
      ) as legacy_students
      where patient_id is not null
      on conflict (id) do nothing
    $migration$;
  end if;
end;
$$;

-- Restore patient profiles from the legacy snapshot before linking visits.
with snapshot_patient_rows as (
  select entries.patient
  from public.clinic_state as snapshots
  cross join lateral (
    select value as patient
    from jsonb_array_elements(
      case when jsonb_typeof(snapshots.state->'students') = 'array'
        then snapshots.state->'students' else '[]'::jsonb end
    )
    union all
    select value as patient
    from jsonb_array_elements(
      case when jsonb_typeof(snapshots.state->'patients') = 'array'
        then snapshots.state->'patients' else '[]'::jsonb end
    )
    union all
    select value as patient
    from jsonb_array_elements(
      case when jsonb_typeof(snapshots.state->'deletedStudents') = 'array'
        then snapshots.state->'deletedStudents' else '[]'::jsonb end
    )
  ) as entries
),
patient_rows as (
  select distinct on (nullif(patient->>'id', ''))
    patient,
    coalesce(
      nullif(patient->>'lastName', ''),
      nullif(patient->>'last_name', ''),
      split_part(coalesce(nullif(patient->>'name', ''), 'Unknown Patient'), ',', 1)
    ) as last_name,
    coalesce(
      nullif(patient->>'firstName', ''),
      nullif(patient->>'first_name', ''),
      case
        when position(',' in coalesce(patient->>'name', '')) > 0
          then nullif(btrim(split_part(patient->>'name', ',', 2)), '')
        else nullif(patient->>'name', '')
      end,
      'Unknown'
    ) as first_name
  from snapshot_patient_rows
  where nullif(patient->>'id', '') is not null
  order by nullif(patient->>'id', ''),
    case when lower(coalesce(patient->>'deleted', 'false')) = 'true'
      or patient->>'status' = 'Deleted' then 1 else 0 end desc
)
insert into public.patients (
  id, last_name, first_name, middle_initial, name, course, year_level,
  institutional_category, personnel_type, gender, age, contact,
  guardian_name, guardian_contact, allergies, medical_conditions, symptoms,
  deleted_at, deleted_by, updated_at
)
select
  patient->>'id',
  last_name,
  first_name,
  coalesce(nullif(patient->>'middleInitial', ''), nullif(patient->>'middle_initial', '')),
  coalesce(nullif(patient->>'name', ''), concat_ws(', ', last_name, first_name)),
  coalesce(
    nullif(patient->>'course', ''),
    nullif(patient->>'institutionalCategory', ''),
    nullif(patient->>'institutional_category', ''),
    'Not recorded'
  ),
  coalesce(
    nullif(patient->>'year', ''),
    nullif(patient->>'yearLevel', ''),
    nullif(patient->>'year_level', ''),
    nullif(patient->>'personnelType', ''),
    nullif(patient->>'personnel_type', ''),
    'Not recorded'
  ),
  coalesce(
    nullif(patient->>'institutionalCategory', ''),
    nullif(patient->>'institutional_category', ''),
    nullif(patient->>'course', ''),
    'Not recorded'
  ),
  coalesce(nullif(patient->>'personnelType', ''), nullif(patient->>'personnel_type', '')),
  coalesce(nullif(patient->>'gender', ''), nullif(patient->>'sex', '')),
  case
    when coalesce(patient->>'age', '') ~ '^[0-9]{1,3}$'
      and (patient->>'age')::numeric between 0 and 120
      then (patient->>'age')::integer
    else null
  end,
  coalesce(nullif(patient->>'contact', ''), nullif(patient->>'phone', '')),
  coalesce(nullif(patient->>'guardianName', ''), nullif(patient->>'guardian_name', '')),
  coalesce(nullif(patient->>'guardianContact', ''), nullif(patient->>'guardian_contact', '')),
  coalesce(nullif(patient->>'allergies', ''), 'Not Yet Assessed'),
  coalesce(
    nullif(patient->>'conditions', ''),
    nullif(patient->>'medicalConditions', ''),
    nullif(patient->>'medical_conditions', ''),
    'None'
  ),
  case when jsonb_typeof(patient->'symptoms') = 'array' then patient->'symptoms' else '[]'::jsonb end,
  case
    when lower(coalesce(patient->>'deleted', 'false')) = 'true'
      or patient->>'status' = 'Deleted' then now()
    else null
  end,
  coalesce(nullif(patient->>'deletedBy', ''), nullif(patient->>'deleted_by', '')),
  now()
from patient_rows
on conflict (id) do nothing;

-- Preserve patient links from older normalized schemas and the legacy snapshot.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinical_visits'
      and column_name = 'student_id'
  ) then
    execute '
      update public.clinical_visits
      set patient_id = student_id::text
      where patient_id is null and student_id is not null
    ';
  end if;
end;
$$;

update public.clinical_visits as visits
set patient_id = coalesce(
  nullif(entries.visit->>'studentId', ''),
  nullif(entries.visit->>'patientId', ''),
  nullif(entries.visit->>'patient_id', '')
)
from public.clinic_state as snapshot
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(snapshot.state->'consultations') = 'array'
      then snapshot.state->'consultations'
    else '[]'::jsonb
  end
) as entries(visit)
where visits.patient_id is null
  and visits.id::text = coalesce(
    entries.visit->>'id',
    entries.visit->>'visitId',
    entries.visit->>'visit_id'
  );

-- Create placeholder patient profiles for visits that still lack one,
-- so every visit has a valid patient link before the not-null constraint.
insert into public.patients (
  id, last_name, first_name, middle_initial, name, course, year_level,
  institutional_category, personnel_type, gender, age, contact,
  guardian_name, guardian_contact, allergies, medical_conditions, symptoms,
  deleted_at, deleted_by, updated_at
)
select
  visits.id,
  'Unknown', 'Patient', null, 'Unknown Patient',
  'Not recorded', 'Not recorded',
  'Not recorded', null, null, null, null,
  null, null, 'Not Yet Assessed', 'None', '[]'::jsonb,
  null, null, now()
from public.clinical_visits as visits
left join public.patients as patients on patients.id = visits.patient_id
where visits.patient_id is null or patients.id is null
on conflict (id) do nothing;

-- Link any remaining visits whose patient_id is still null or dangling
-- to the placeholder patients just created (same id as the visit).
update public.clinical_visits as visits
set patient_id = visits.id
where patient_id is null
   or not exists (
     select 1 from public.patients where id = visits.patient_id
   );

-- Final safety check: fail only if some visit still cannot be linked.
do $$
declare
  v_unlinked_visits text;
begin
  select string_agg(
    format('visit_id=%s, patient_id=%s', visit_id, patient_id),
    '; ' order by visit_id
  )
  into v_unlinked_visits
  from (
    select
      visits.id as visit_id,
      coalesce(visits.patient_id, '<NULL>') as patient_id
    from public.clinical_visits as visits
    left join public.patients as patients on patients.id = visits.patient_id
    where visits.patient_id is null or patients.id is null
    order by visits.id
    limit 20
  ) as unlinked;

  if v_unlinked_visits is not null then
    raise exception 'Cannot migrate clinical visit patient links. First unresolved records (up to 20): %.', v_unlinked_visits;
  end if;
end;
$$;

alter table public.clinical_visits
  alter column patient_id set not null;

-- Upgrade existing databases so deleting a patient also deletes that patient's visits.
alter table public.clinical_visits
  drop constraint if exists clinical_visits_patient_id_fkey;
alter table public.clinical_visits
  add constraint clinical_visits_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

-- Add missing checks to existing installations without rejecting legacy rows.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_age_check' and conrelid = 'public.patients'::regclass) then
    alter table public.patients add constraint patients_age_check check (age is null or age between 0 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'medicines_quantity_check' and conrelid = 'public.medicines'::regclass) then
    alter table public.medicines add constraint medicines_quantity_check check (quantity >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_quantity_check' and conrelid = 'public.equipment'::regclass) then
    alter table public.equipment add constraint equipment_quantity_check check (quantity >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_settings_low_stock_threshold_check' and conrelid = 'public.clinic_settings'::regclass) then
    alter table public.clinic_settings add constraint clinic_settings_low_stock_threshold_check check (low_stock_threshold >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_settings_expiration_alert_days_check' and conrelid = 'public.clinic_settings'::regclass) then
    alter table public.clinic_settings add constraint clinic_settings_expiration_alert_days_check check (expiration_alert_days >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_settings_password_min_length_check' and conrelid = 'public.clinic_settings'::regclass) then
    alter table public.clinic_settings add constraint clinic_settings_password_min_length_check check (password_min_length > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_settings_session_timeout_minutes_check' and conrelid = 'public.clinic_settings'::regclass) then
    alter table public.clinic_settings add constraint clinic_settings_session_timeout_minutes_check check (session_timeout_minutes > 0) not valid;
  end if;
end;
$$;

insert into public.clinic_sync_meta (id, normalized_ready)
values (1, false)
on conflict (id) do nothing;

-- Preserve visit details from the legacy snapshot when upgrading normalized storage.
update public.clinical_visits as visits
set respiratory_rate = coalesce(visits.respiratory_rate, nullif(entries.visit->>'respiratoryRate', '')),
  reason_other = coalesce(visits.reason_other, nullif(entries.visit->>'reasonOther', '')),
    equipment_used = case
      when visits.equipment_used = '[]'::jsonb
        and jsonb_typeof(entries.visit->'equipmentUsed') = 'array'
        and entries.visit->'equipmentUsed' <> '[]'::jsonb then entries.visit->'equipmentUsed'
      else visits.equipment_used
    end,
    equipment_quantity = coalesce(visits.equipment_quantity, case
      when entries.visit->>'equipmentQty' ~ '^[0-9]+$' then case
        when (entries.visit->>'equipmentQty')::numeric between 1 and 2147483647 then (entries.visit->>'equipmentQty')::integer
        else null
      end
      else null
    end),
    supply_used = coalesce(visits.supply_used, nullif(entries.visit->>'supplyUsed', '')),
    supply_quantity = coalesce(visits.supply_quantity, case
      when entries.visit->>'supplyQty' ~ '^[0-9]+$' then case
        when (entries.visit->>'supplyQty')::numeric between 1 and 2147483647 then (entries.visit->>'supplyQty')::integer
        else null
      end
      else null
    end)
from public.clinic_state as snapshots
cross join lateral jsonb_array_elements(coalesce(snapshots.state->'consultations', '[]'::jsonb)) as entries(visit)
where snapshots.id = 1
  and entries.visit->>'id' = visits.id;

-- Keep modification times reliable for both the application and Supabase Table Editor.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_super_admin_account()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if (new.id = 'SYS-SUPER-ADMIN' or lower(new.username) = 'super admin' or new.role = 'Super Admin')
      and not (
        new.id = 'SYS-SUPER-ADMIN'
        and new.username = 'super admin'
        and new.role = 'Super Admin'
        and new.status = 'Active'
        and new.deleted_at is null
      ) then
      raise exception 'The Super Admin maintenance account is reserved.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.id = 'SYS-SUPER-ADMIN' or lower(old.username) = 'super admin' then
      raise exception 'The Super Admin maintenance account cannot be deleted.';
    end if;
    return old;
  end if;

  if old.id = 'SYS-SUPER-ADMIN' or lower(old.username) = 'super admin' then
    if new.id is distinct from old.id
      or new.username is distinct from old.username
      or new.role is distinct from old.role
      or new.deleted_at is distinct from old.deleted_at then
      raise exception 'The Super Admin maintenance account cannot be modified or archived.';
    end if;
    if new.status is distinct from old.status
      and current_setting('mqc.account_security_transition', true) is distinct from 'true' then
      raise exception 'The Super Admin maintenance account status can only change through authorized account security controls.';
    end if;
  elsif new.role = 'Super Admin' then
    raise exception 'The Super Admin role is reserved for the maintenance account.';
  end if;
  return new;
end;
$$;

drop trigger if exists clinic_users_protect_super_admin on public.clinic_users;
create trigger clinic_users_protect_super_admin
before insert or update or delete on public.clinic_users
for each row execute function public.protect_super_admin_account();

create or replace function public.set_super_admin_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_password is null or length(p_password) < 12 then
    raise exception 'The Super Admin password must be at least 12 characters.';
  end if;

  update public.clinic_users
  set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
  where id = 'SYS-SUPER-ADMIN'
    and username = 'super admin'
    and role = 'Super Admin'
    and status = 'Active'
    and deleted_at is null
    and password_hash is null;

  if not found then
    if not exists (
      select 1
      from public.clinic_users
      where id = 'SYS-SUPER-ADMIN'
        and username = 'super admin'
        and role = 'Super Admin'
        and status = 'Active'
        and deleted_at is null
        and password_hash is not null
    ) then
      raise exception 'The protected Super Admin account is not available.';
    end if;
  end if;
end;
$$;

revoke all on function public.set_super_admin_password(text) from public, anon, authenticated;
grant execute on function public.set_super_admin_password(text) to service_role;

drop trigger if exists clinic_users_set_updated_at on public.clinic_users;
create trigger clinic_users_set_updated_at
before update on public.clinic_users
for each row execute function public.set_updated_at();

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

drop trigger if exists medicines_set_updated_at on public.medicines;
create trigger medicines_set_updated_at
before update on public.medicines
for each row execute function public.set_updated_at();

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

drop trigger if exists clinical_visits_set_updated_at on public.clinical_visits;
create trigger clinical_visits_set_updated_at
before update on public.clinical_visits
for each row execute function public.set_updated_at();

drop trigger if exists clinic_settings_set_updated_at on public.clinic_settings;
create trigger clinic_settings_set_updated_at
before update on public.clinic_settings
for each row execute function public.set_updated_at();

drop trigger if exists clinic_state_set_updated_at on public.clinic_state;
create trigger clinic_state_set_updated_at
before update on public.clinic_state
for each row execute function public.set_updated_at();

drop trigger if exists clinic_sync_meta_set_updated_at on public.clinic_sync_meta;
create trigger clinic_sync_meta_set_updated_at
before update on public.clinic_sync_meta
for each row execute function public.set_updated_at();

create index if not exists clinical_visits_patient_date_idx
  on public.clinical_visits (patient_id, visit_date desc);
create index if not exists clinical_visits_date_idx
  on public.clinical_visits (visit_date desc);
create index if not exists patients_active_name_match_idx
  on public.patients (
    lower(regexp_replace(btrim(last_name), '[[:space:]]+', ' ', 'g')),
    lower(regexp_replace(btrim(first_name), '[[:space:]]+', ' ', 'g'))
  )
  where deleted_at is null;
create index if not exists patients_active_guardian_contact_match_idx
  on public.patients (
    regexp_replace(coalesce(guardian_contact, ''), '[^0-9]', '', 'g')
  )
  where deleted_at is null;
create index if not exists medicines_expiration_idx
  on public.medicines (expiration_date);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_user_created_idx
  on public.audit_logs (user_id, created_at desc, id desc);

-- RLS is enabled without client policies; access flows through the authenticated server API.
alter table public.clinic_users enable row level security;

-- Local test account for the clinic login endpoint.
-- It is immediately soft-archived below so the sample account cannot sign in.
insert into public.clinic_users (
  id, name, last_name, first_name, role, username, password_hash, status
)
values (
  'NRS-TEST', 'Test Nurse', 'Nurse', 'Test', 'Staff Nurse', 'testnurse', extensions.crypt('test12345', extensions.gen_salt('bf')), 'Active'
)
on conflict do nothing;

-- Archive the sample account (named "test nurse" in older data or "testnurse" here).
-- Soft deletion keeps it available in Administration → Archive for restoration.
update public.clinic_users
set deleted_at = now(),
    updated_at = now()
where deleted_at is null
  and (
    lower(btrim(username)) = 'test nurse'
    or (
      lower(btrim(username)) = 'testnurse'
      and not exists (
        select 1
        from public.clinic_users
        where lower(btrim(username)) = 'test nurse'
      )
    )
  );

-- Permanent system maintenance account. Passwords are stored only as bcrypt hashes.
insert into public.clinic_users (
  id, name, last_name, first_name, role, username, password_hash, status
)
values (
  'SYS-SUPER-ADMIN',
  'System Administrator',
  'System',
  'Administrator',
  'Super Admin',
  'super admin',
  null,
  'Active'
)
on conflict do nothing;

-- Migrate clinic users already saved in the legacy browser snapshot.
insert into public.clinic_users (
  id,
  auth_user_id,
  name,
  last_name,
  first_name,
  middle_initial,
  role,
  username,
  status,
  deleted_at,
  updated_at
)
select
  nullif(user_row->>'id', ''),
  case
    when user_row->>'authUserId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then (user_row->>'authUserId')::uuid
    else null
  end,
  coalesce(nullif(user_row->>'name', ''), concat_ws(', ', nullif(user_row->>'lastName', ''), nullif(user_row->>'firstName', ''))),
  coalesce(nullif(user_row->>'lastName', ''), split_part(user_row->>'name', ',', 1)),
  coalesce(nullif(user_row->>'firstName', ''), btrim(split_part(user_row->>'name', ',', 2))),
  nullif(user_row->>'middleInitial', ''),
  case when user_row->>'role' in ('Head Nurse & Administrator', 'Head Nurse', 'Staff Nurse', 'Super Admin') then user_row->>'role' else 'Staff Nurse' end,
  nullif(user_row->>'username', ''),
  case when user_row->>'status' = 'Disabled' then 'Disabled' else 'Active' end,
  case when coalesce((user_row->>'deleted')::boolean, false) then now() else null end,
  now()
from public.clinic_state as snapshots
cross join lateral jsonb_array_elements(coalesce(snapshots.state->'users', '[]'::jsonb)) as entries(user_row)
where snapshots.id = 1
  and nullif(user_row->>'id', '') is not null
  and nullif(user_row->>'username', '') is not null
  and coalesce(nullif(user_row->>'name', ''), concat_ws(', ', nullif(user_row->>'lastName', ''), nullif(user_row->>'firstName', ''))) is not null
  and nullif(user_row->>'lastName', '') is not null
  and nullif(user_row->>'firstName', '') is not null
on conflict do nothing;

update public.clinic_sync_meta
set normalized_ready = true,
    updated_at = now()
where id = 1
  and (
    not exists (
      select 1
      from public.clinic_state as snapshots
      cross join lateral jsonb_array_elements(coalesce(snapshots.state->'users', '[]'::jsonb)) as entries(user_row)
      where snapshots.id = 1
        and nullif(entries.user_row->>'username', '') is not null
    )
    or not exists (
      select 1
      from public.clinic_state as snapshots
      cross join lateral jsonb_array_elements(coalesce(snapshots.state->'users', '[]'::jsonb)) as entries(user_row)
      where snapshots.id = 1
        and nullif(entries.user_row->>'username', '') is not null
        and not exists (
          select 1
          from public.clinic_users as users
          where users.username = entries.user_row->>'username'
        )
    )
  );

-- Repair legacy audit rows when the old snapshot still contains a verifiable user ID.

update public.audit_logs as logs
set user_name = users.name
from public.clinic_users as users
where logs.user_id = users.id
  and lower(logs.user_name) = 'system';

update public.audit_logs as logs
set user_id = (
      select users.id
      from public.clinic_state as snapshots
      cross join lateral jsonb_array_elements(coalesce(snapshots.state->'auditLogs', '[]'::jsonb)) as entries(entry)
      join public.clinic_users as users on users.id = nullif(entries.entry->>'userId', '')
      where logs.action = entries.entry->>'action'
        and logs.module = entries.entry->>'module'
        and logs.created_at::date = to_date(entries.entry->>'date', 'YYYY-MM-DD')
      limit 1
    ),
    user_name = (
      select users.name
      from public.clinic_state as snapshots
      cross join lateral jsonb_array_elements(coalesce(snapshots.state->'auditLogs', '[]'::jsonb)) as entries(entry)
      join public.clinic_users as users on users.id = nullif(entries.entry->>'userId', '')
      where logs.action = entries.entry->>'action'
        and logs.module = entries.entry->>'module'
        and logs.created_at::date = to_date(entries.entry->>'date', 'YYYY-MM-DD')
      limit 1
    )
where logs.user_id is null
  and lower(logs.user_name) = 'system'
  and exists (
    select 1
    from public.clinic_state as snapshots
    cross join lateral jsonb_array_elements(coalesce(snapshots.state->'auditLogs', '[]'::jsonb)) as entries(entry)
    join public.clinic_users as users on users.id = nullif(entries.entry->>'userId', '')
    where logs.action = entries.entry->>'action'
      and logs.module = entries.entry->>'module'
      and logs.created_at::date = to_date(entries.entry->>'date', 'YYYY-MM-DD')
  );

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and old.user_id is not null
    and new.user_id is null
    and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  raise exception 'Audit log records are immutable.';
end;
$$;

drop trigger if exists audit_logs_prevent_mutation on public.audit_logs;
create trigger audit_logs_prevent_mutation
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create or replace function public.authenticate_clinic_user(p_username text, p_password text)
returns table (id text, name text, role text, username text, status text)
language sql
security definer
set search_path = public
as $$
  select id, name, role, username, status
  from public.clinic_users
  where username = p_username
    and status = 'Active'
    and deleted_at is null
    and password_hash is not null
    and extensions.crypt(p_password, password_hash) = password_hash;
$$;

revoke all on function public.authenticate_clinic_user(text, text) from public;
grant execute on function public.authenticate_clinic_user(text, text) to service_role;

create or replace function public.change_legacy_clinic_user_password(
  p_username text,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_updated integer;
begin
  update public.clinic_users
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where username = p_username
    and role in ('Head Nurse', 'Super Admin')
    and status = 'Active'
    and deleted_at is null
    and password_hash is not null
    and extensions.crypt(p_current_password, password_hash) = password_hash;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.change_legacy_clinic_user_password(text, text, text) from public;
grant execute on function public.change_legacy_clinic_user_password(text, text, text) to service_role;

alter table public.patients enable row level security;
alter table public.medicines enable row level security;
alter table public.equipment enable row level security;
alter table public.clinical_visits enable row level security;
alter table public.audit_logs enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_state enable row level security;
alter table public.clinic_sync_meta enable row level security;

create or replace function public.register_clinic_patient(
  p_patient jsonb,
  p_confirmed_distinct_ids text[] default '{}',
  p_selected_patient_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient public.patients;
  v_match_ids text[];
  v_matches jsonb;
  v_last_name text;
  v_first_name text;
  v_middle_initial text;
  v_course text;
  v_year_level text;
  v_guardian_contact text;
  v_normalized_last_name text;
  v_normalized_first_name text;
begin
  if p_selected_patient_id is not null then
    select patient.* into v_patient
    from public.patients as patient
    where patient.id = p_selected_patient_id
      and patient.deleted_at is null;

    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;

    return jsonb_build_object(
      'status', 'selected',
      'patient', to_jsonb(v_patient),
      'hasVisits', exists (
        select 1
        from public.clinical_visits as visit
        where visit.patient_id = v_patient.id
      )
    );
  end if;

  if p_patient is null then
    raise exception 'Patient details are required.';
  end if;

  v_last_name := nullif(btrim(p_patient ->> 'lastName'), '');
  v_first_name := nullif(btrim(p_patient ->> 'firstName'), '');
  v_middle_initial := nullif(btrim(p_patient ->> 'middleInitial'), '');
  v_course := nullif(btrim(p_patient ->> 'course'), '');
  v_year_level := nullif(btrim(p_patient ->> 'year'), '');
  v_guardian_contact := nullif(btrim(p_patient ->> 'guardianContact'), '');
  if v_last_name is null or v_first_name is null or v_course is null or v_year_level is null then
    raise exception 'Last name, given name, category, and year level are required.';
  end if;
  if v_guardian_contact is null or v_guardian_contact !~ '^[0-9]{11}$' then
    raise exception 'Parent / Guardian Contact must contain exactly 11 digits.';
  end if;

  v_normalized_last_name := lower(regexp_replace(v_last_name, '[[:space:]]+', ' ', 'g'));
  v_normalized_first_name := lower(regexp_replace(v_first_name, '[[:space:]]+', ' ', 'g'));
  perform pg_advisory_xact_lock(hashtextextended(
    'patient-name:' || length(v_normalized_last_name)::text || ':' ||
      v_normalized_last_name || ':' || length(v_normalized_first_name)::text || ':' ||
      v_normalized_first_name,
    0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'patient-contact:' || v_guardian_contact,
    0
  ));

  select
    coalesce(array_agg(patient.id order by patient.created_at, patient.id), '{}'),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', patient.id,
      'name', patient.name,
      'lastName', patient.last_name,
      'firstName', patient.first_name,
      'middleInitial', patient.middle_initial,
      'course', patient.course,
      'institutionalCategory', patient.institutional_category,
      'personnelType', patient.personnel_type,
      'year', patient.year_level,
      'gender', patient.gender,
      'guardianName', patient.guardian_name,
      'guardianContact', patient.guardian_contact,
      'allergies', patient.allergies,
      'conditions', patient.medical_conditions,
      'symptoms', patient.symptoms,
      'nameMatches',
        lower(regexp_replace(btrim(patient.last_name), '[[:space:]]+', ' ', 'g')) =
          lower(regexp_replace(v_last_name, '[[:space:]]+', ' ', 'g'))
        and lower(regexp_replace(btrim(patient.first_name), '[[:space:]]+', ' ', 'g')) =
          lower(regexp_replace(v_first_name, '[[:space:]]+', ' ', 'g')),
      'guardianContactMatches',
        regexp_replace(coalesce(patient.guardian_contact, ''), '[^0-9]', '', 'g') = v_guardian_contact,
      'hasVisits', exists (
        select 1
        from public.clinical_visits as visit
        where visit.patient_id = patient.id
      )
    ) order by patient.created_at, patient.id), '[]'::jsonb)
  into v_match_ids, v_matches
  from public.patients as patient
  where patient.deleted_at is null
    and (
      (
        lower(regexp_replace(btrim(patient.last_name), '[[:space:]]+', ' ', 'g')) =
          lower(regexp_replace(v_last_name, '[[:space:]]+', ' ', 'g'))
        and lower(regexp_replace(btrim(patient.first_name), '[[:space:]]+', ' ', 'g')) =
          lower(regexp_replace(v_first_name, '[[:space:]]+', ' ', 'g'))
      )
      or regexp_replace(coalesce(patient.guardian_contact, ''), '[^0-9]', '', 'g') = v_guardian_contact
    );

  if cardinality(v_match_ids) > 0
    and not (v_match_ids <@ coalesce(p_confirmed_distinct_ids, '{}')) then
    return jsonb_build_object('status', 'possible_matches', 'matches', v_matches);
  end if;

  insert into public.patients (
    id, last_name, first_name, middle_initial, name, course, year_level,
    institutional_category, personnel_type, gender, guardian_name, guardian_contact,
    allergies, medical_conditions, symptoms
  ) values (
    nullif(btrim(p_patient ->> 'id'), ''),
    v_last_name,
    v_first_name,
    v_middle_initial,
    coalesce(nullif(btrim(p_patient ->> 'name'), ''), v_last_name || ', ' || v_first_name),
    v_course,
    v_year_level,
    coalesce(nullif(btrim(p_patient ->> 'institutionalCategory'), ''), v_course),
    nullif(btrim(p_patient ->> 'personnelType'), ''),
    nullif(btrim(p_patient ->> 'gender'), ''),
    nullif(btrim(p_patient ->> 'guardianName'), ''),
    v_guardian_contact,
    coalesce(nullif(btrim(p_patient ->> 'allergies'), ''), 'Not Yet Assessed'),
    coalesce(nullif(btrim(p_patient ->> 'conditions'), ''), 'None'),
    case
      when jsonb_typeof(p_patient -> 'symptoms') = 'array' then p_patient -> 'symptoms'
      else '[]'::jsonb
    end
  )
  returning * into v_patient;

  return jsonb_build_object(
    'status', 'created',
    'patient', to_jsonb(v_patient),
    'hasVisits', false
  );
end;
$$;

revoke all on function public.register_clinic_patient(jsonb, text[], text) from public, anon, authenticated;
grant execute on function public.register_clinic_patient(jsonb, text[], text) to service_role;

create table if not exists public.clinic_monthly_patient_counts (
  month_start date primary key,
  registered_count integer not null default 0 check (registered_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.clinic_monthly_patient_counts enable row level security;
revoke all on public.clinic_monthly_patient_counts from public, anon, authenticated;

insert into public.clinic_monthly_patient_counts (month_start, registered_count)
select
  date_trunc('month', patients.created_at at time zone 'Asia/Manila')::date,
  count(*)::integer
from public.patients as patients
group by 1
on conflict (month_start) do update
set registered_count = greatest(
      public.clinic_monthly_patient_counts.registered_count,
      excluded.registered_count
    ),
    updated_at = clock_timestamp();

create table if not exists public.clinic_maintenance_runs (
  run_key text primary key,
  job_name text not null check (job_name in ('monthly_patient_archive', 'six_month_archive_cleanup')),
  period_key text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success')),
  result jsonb not null default '{}'::jsonb
);

alter table public.clinic_maintenance_runs enable row level security;
revoke all on public.clinic_maintenance_runs from public, anon, authenticated;

create table if not exists public.clinic_archive_cleanup_backups (
  id bigint generated by default as identity primary key,
  run_key text not null references public.clinic_maintenance_runs(run_key) on delete restrict,
  source_table text not null check (source_table in ('patients', 'medicines', 'equipment')),
  source_key text not null,
  archived_at timestamptz not null,
  record_data jsonb not null,
  backed_up_at timestamptz not null default now(),
  unique (run_key, source_table, source_key)
);

alter table public.clinic_archive_cleanup_backups enable row level security;
revoke all on public.clinic_archive_cleanup_backups from public, anon, authenticated;

create index if not exists patients_archive_cleanup_idx
  on public.patients (deleted_at)
  where deleted_at is not null;
create index if not exists medicines_archive_cleanup_idx
  on public.medicines (deleted_at)
  where deleted_at is not null;
create index if not exists equipment_archive_cleanup_idx
  on public.equipment (deleted_at)
  where deleted_at is not null;

create or replace function public.run_scheduled_record_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_local_now timestamp;
  v_month_start_local timestamp;
  v_previous_month_start_local timestamp;
  v_month_start timestamptz;
  v_previous_month_start timestamptz;
  v_next_month_start timestamptz;
  v_retention_cutoff timestamptz;
  v_month_key text;
  v_cleanup_key text;
  v_monthly_run_key text;
  v_cleanup_run_key text;
  v_monthly_claimed boolean := false;
  v_cleanup_claimed boolean := false;
  v_archived_patients integer := 0;
  v_previous_month_registrations integer := 0;
  v_current_month_registrations integer := 0;
  v_deleted_patients integer := 0;
  v_deleted_medicines integer := 0;
  v_deleted_equipment integer := 0;
  v_preserved_patients integer := 0;
  v_voided_batches integer := 0;
  v_result jsonb;
begin
  v_local_now := v_now at time zone 'Asia/Manila';
  v_month_start_local := date_trunc('month', v_local_now);
  v_previous_month_start_local := v_month_start_local - interval '1 month';
  v_month_start := v_month_start_local at time zone 'Asia/Manila';
  v_previous_month_start := v_previous_month_start_local at time zone 'Asia/Manila';
  v_next_month_start := (v_month_start_local + interval '1 month') at time zone 'Asia/Manila';
  v_month_key := to_char(v_month_start_local, 'YYYY-MM');
  v_monthly_run_key := 'monthly-patient-archive:' || v_month_key;

  insert into public.clinic_maintenance_runs (
    run_key, job_name, period_key, status
  )
  values (
    v_monthly_run_key, 'monthly_patient_archive', v_month_key, 'running'
  )
  on conflict (run_key) do nothing
  returning true into v_monthly_claimed;
  v_monthly_claimed := coalesce(v_monthly_claimed, false);

  if v_monthly_claimed then
    select count(*)::integer
      into v_previous_month_registrations
    from public.patients as patients
    where patients.created_at >= v_previous_month_start
      and patients.created_at < v_month_start;

    insert into public.clinic_monthly_patient_counts (
      month_start, registered_count, updated_at
    )
    values (
      v_previous_month_start_local::date,
      v_previous_month_registrations,
      v_now
    )
    on conflict (month_start) do update
    set registered_count = greatest(
          public.clinic_monthly_patient_counts.registered_count,
          excluded.registered_count
        ),
        updated_at = excluded.updated_at;

    update public.patients
    set deleted_at = v_now,
        deleted_by = 'SYSTEM_SCHEDULER'
    where deleted_at is null
      and created_at >= v_previous_month_start
      and created_at < v_month_start;
    get diagnostics v_archived_patients = row_count;

    select count(*)::integer
      into v_current_month_registrations
    from public.patients as patients
    where patients.created_at >= v_month_start
      and patients.created_at < v_next_month_start;

    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details,
      module, status, created_at
    )
    values (
      null, 'System Scheduler', 'system_scheduler', 'System',
      'Monthly Patient Archiving',
      format(
        'Archived %s patient record(s) registered during %s. Categories processed: patients. Reason: scheduled monthly archiving by Asia/Manila calendar month. Execution status: Success.',
        v_archived_patients,
        to_char(v_previous_month_start_local, 'YYYY-MM')
      ),
      'System Maintenance', 'Success', v_now
    );

    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details,
      module, status, created_at
    )
    values (
      null, 'System Scheduler', 'system_scheduler', 'System',
      'Monthly Patient Count Reset',
      format(
        'The dashboard patient-registration count is now scoped to %s; %s registration(s) existed at execution time and 0 records were changed by the count reset. No patient or visit history was deleted. Reason: begin a new monthly count period. Execution status: Success.',
        v_month_key,
        v_current_month_registrations
      ),
      'System Maintenance', 'Success', v_now
    );

    update public.clinic_maintenance_runs
    set completed_at = v_now,
        status = 'success',
        result = jsonb_build_object(
          'archivedPatients', v_archived_patients,
          'previousMonthRegistrations', v_previous_month_registrations,
          'currentMonthRegistrations', v_current_month_registrations
        )
    where run_key = v_monthly_run_key;
  end if;

  if extract(month from v_local_now)::integer in (1, 7) then
    v_cleanup_key := v_month_key;
    v_cleanup_run_key := 'six-month-archive-cleanup:' || v_cleanup_key;
    v_retention_cutoff := (v_local_now - interval '6 months') at time zone 'Asia/Manila';

    insert into public.clinic_maintenance_runs (
      run_key, job_name, period_key, status
    )
    values (
      v_cleanup_run_key, 'six_month_archive_cleanup', v_cleanup_key, 'running'
    )
    on conflict (run_key) do nothing
    returning true into v_cleanup_claimed;
    v_cleanup_claimed := coalesce(v_cleanup_claimed, false);

    if v_cleanup_claimed then
      -- Block concurrent writes before checking references and deleting, in mutation order.
      lock table public.clinical_visits in share row exclusive mode;
      lock table public.clinical_visit_inventory_deductions in share row exclusive mode;
      lock table public.medicines in share row exclusive mode;
      lock table public.equipment in share row exclusive mode;
      lock table public.patients in share row exclusive mode;

      with eligible as (
        select patients.*
        from public.patients as patients
        where patients.deleted_at <= v_retention_cutoff
          and not exists (
            select 1
            from public.clinical_visits as visits
            where visits.patient_id = patients.id
          )
        for update of patients skip locked
      )
      insert into public.clinic_archive_cleanup_backups (
        run_key, source_table, source_key, archived_at, record_data
      )
      select
        v_cleanup_run_key, 'patients', eligible.id, eligible.deleted_at,
        to_jsonb(eligible)
      from eligible;

      delete from public.patients as patients
      using public.clinic_archive_cleanup_backups as backup
      where backup.run_key = v_cleanup_run_key
        and backup.source_table = 'patients'
        and backup.source_key = patients.id
        and patients.deleted_at <= v_retention_cutoff
        and not exists (
          select 1
          from public.clinical_visits as visits
          where visits.patient_id = patients.id
        );
      get diagnostics v_deleted_patients = row_count;

      select count(*)::integer
        into v_preserved_patients
      from public.patients as patients
      where patients.deleted_at <= v_retention_cutoff
        and exists (
          select 1
          from public.clinical_visits as visits
          where visits.patient_id = patients.id
        );

      with eligible as (
        select medicines.*
        from public.medicines as medicines
        where medicines.deleted_at <= v_retention_cutoff
          and not exists (
            select 1
            from public.clinical_visits as visits
            where visits.medicine_code = medicines.code
              or visits.medicine_name = medicines.name
          )
          and not exists (
            select 1
            from public.clinical_visit_inventory_deductions as deductions
            where deductions.item_type = 'medicine'
              and deductions.item_id = medicines.code
          )
        for update of medicines skip locked
      )
      insert into public.clinic_archive_cleanup_backups (
        run_key, source_table, source_key, archived_at, record_data
      )
      select
        v_cleanup_run_key, 'medicines', eligible.code, eligible.deleted_at,
        to_jsonb(eligible)
      from eligible;

      delete from public.medicines as medicines
      using public.clinic_archive_cleanup_backups as backup
      where backup.run_key = v_cleanup_run_key
        and backup.source_table = 'medicines'
        and backup.source_key = medicines.code
        and medicines.deleted_at <= v_retention_cutoff
        and not exists (
          select 1
          from public.clinical_visits as visits
          where visits.medicine_code = medicines.code
            or visits.medicine_name = medicines.name
        )
        and not exists (
          select 1
          from public.clinical_visit_inventory_deductions as deductions
          where deductions.item_type = 'medicine'
            and deductions.item_id = medicines.code
        );
      get diagnostics v_deleted_medicines = row_count;

      with eligible as (
        select equipment.*
        from public.equipment as equipment
        where equipment.deleted_at <= v_retention_cutoff
          and not exists (
            select 1
            from public.clinical_visits as visits
            where visits.supply_item_id = equipment.id
              or visits.supply_used = equipment.name
              or coalesce(visits.equipment_used, '[]'::jsonb) @> jsonb_build_array(equipment.name)
              or coalesce(visits.equipment_used, '[]'::jsonb) @> jsonb_build_array(equipment.id)
          )
          and not exists (
            select 1
            from public.clinical_visit_inventory_deductions as deductions
            where deductions.item_type = 'equipment'
              and deductions.item_id = equipment.id
          )
        for update of equipment skip locked
      )
      insert into public.clinic_archive_cleanup_backups (
        run_key, source_table, source_key, archived_at, record_data
      )
      select
        v_cleanup_run_key, 'equipment', eligible.id, eligible.deleted_at,
        to_jsonb(eligible)
      from eligible;

      delete from public.equipment as equipment
      using public.clinic_archive_cleanup_backups as backup
      where backup.run_key = v_cleanup_run_key
        and backup.source_table = 'equipment'
        and backup.source_key = equipment.id
        and equipment.deleted_at <= v_retention_cutoff
        and not exists (
          select 1
          from public.clinical_visits as visits
          where visits.supply_item_id = equipment.id
            or visits.supply_used = equipment.name
            or coalesce(visits.equipment_used, '[]'::jsonb) @> jsonb_build_array(equipment.name)
            or coalesce(visits.equipment_used, '[]'::jsonb) @> jsonb_build_array(equipment.id)
        )
        and not exists (
          select 1
          from public.clinical_visit_inventory_deductions as deductions
          where deductions.item_type = 'equipment'
            and deductions.item_id = equipment.id
        );
      get diagnostics v_deleted_equipment = row_count;

      insert into public.audit_logs (
        user_id, user_name, username, role, action, event_details,
        module, status, created_at
      )
      values (
        null, 'System Scheduler', 'system_scheduler', 'System',
        'Six-Month Archive Cleanup',
        format(
          'Processed archived records at the six-month cleanup interval. Categories: patients, medicines, medical supplies, and medical equipment. Permanently deleted %s patient(s), %s medicine(s), and %s inventory item(s); %s archived patient(s) were retained because clinical visits reference them. Reason: six-month retention policy. Execution status: Success.',
          v_deleted_patients,
          v_deleted_medicines,
          v_deleted_equipment,
          v_preserved_patients
        ),
        'System Maintenance', 'Success', v_now
      );

      insert into public.audit_logs (
        user_id, user_name, username, role, action, event_details,
        module, status, created_at
      )
      values (
        null, 'System Scheduler', 'system_scheduler', 'System',
        'Permanent Deletion of Expired Archived Records',
        format(
          'Backed up and deleted %s expired archived patient(s), %s medicine(s), and %s medical supply/equipment item(s). Referenced records and all clinical visits were preserved. Backup table: clinic_archive_cleanup_backups. Retention cutoff: %s. Reason: remove only unreferenced records archived for at least six months. Execution status: Success.',
          v_deleted_patients,
          v_deleted_medicines,
          v_deleted_equipment,
          to_char(v_retention_cutoff at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS')
        ),
        'System Maintenance', 'Success', v_now
      );

      update public.clinic_maintenance_runs
      set completed_at = v_now,
          status = 'success',
          result = jsonb_build_object(
            'deletedPatients', v_deleted_patients,
            'deletedMedicines', v_deleted_medicines,
            'deletedEquipment', v_deleted_equipment,
            'preservedPatientsWithVisits', v_preserved_patients,
            'retentionCutoff', v_retention_cutoff
          )
      where run_key = v_cleanup_run_key;
    end if;
  end if;

  select public.void_expiring_medicine_batches() into v_voided_batches;

  v_result := jsonb_build_object(
    'status', 'success',
    'localDate', v_local_now::date,
    'timezone', 'Asia/Manila',
    'monthlyArchive', case
      when v_monthly_claimed then jsonb_build_object(
        'status', 'completed',
        'archivedPatients', v_archived_patients,
        'previousMonthRegistrations', v_previous_month_registrations
      )
      else jsonb_build_object('status', 'already_completed')
    end,
    'archiveCleanup', case
      when extract(month from v_local_now)::integer not in (1, 7) then jsonb_build_object('status', 'not_scheduled')
      when v_cleanup_claimed then jsonb_build_object(
        'status', 'completed',
        'deletedPatients', v_deleted_patients,
        'deletedMedicines', v_deleted_medicines,
        'deletedEquipment', v_deleted_equipment,
        'preservedPatientsWithVisits', v_preserved_patients
      )
      else jsonb_build_object('status', 'already_completed')
    end
  );
  return v_result;
end;
$$;

revoke all on function public.run_scheduled_record_maintenance() from public, anon, authenticated;
grant execute on function public.run_scheduled_record_maintenance() to service_role;

-- Batch-level medicine and supply inventory
create table if not exists public.medicine_batches (
  id text primary key,
  medicine_code text not null references public.medicines(code) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  production_date date,
  expiration_date date,
  status text not null default 'Available' check (status in ('Available', 'Voided', 'Expired')),
  voided_quantity integer not null default 0 check (voided_quantity >= 0),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medicine_batches
  add column if not exists production_date date;

alter table public.medicine_batches
  drop constraint if exists medicine_batches_medicine_code_expiration_date_key;

create table if not exists public.supply_batches (
  id text primary key,
  supply_id text not null references public.equipment(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  expiration_date date,
  batch_number text,
  voided_quantity integer not null default 0 check (voided_quantity >= 0),
  voided_at timestamptz,
  status text not null default 'Available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medicine_batch_deductions (
  visit_id text not null references public.clinical_visits(id) on delete cascade,
  batch_id text not null references public.medicine_batches(id) on delete restrict,
  medicine_code text not null,
  quantity integer not null check (quantity > 0),
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (visit_id, batch_id)
);

alter table public.medicine_batch_deductions
  add column if not exists reversed_at timestamptz;

create index if not exists medicine_batches_fefo_idx
  on public.medicine_batches (medicine_code, expiration_date, status);
create index if not exists medicine_batches_void_idx
  on public.medicine_batches (status, expiration_date);

alter table public.medicine_batches enable row level security;
alter table public.supply_batches enable row level security;
alter table public.medicine_batch_deductions enable row level security;

insert into public.medicine_batches (
  id, medicine_code, quantity, production_date, expiration_date, status, voided_quantity, voided_at
)
select
  coalesce(nullif(batch.value->>'id', ''), medicines.code || '-B' || batch.ordinality::text),
  medicines.code,
  case when coalesce(batch.value->>'qty', batch.value->>'quantity', '') ~ '^[0-9]{1,10}$'
    then least(coalesce(batch.value->>'qty', batch.value->>'quantity')::numeric, 2147483647)::integer
    else 0 end,
  case
    when coalesce(batch.value->>'productionDate', batch.value->>'production_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then coalesce(batch.value->>'productionDate', batch.value->>'production_date')::date
    else medicines.production_date
  end,
  case when coalesce(batch.value->>'exp', batch.value->>'expirationDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then coalesce(batch.value->>'exp', batch.value->>'expirationDate')::date
    else null end,
  case lower(coalesce(batch.value->>'status', 'available'))
    when 'voided' then 'Voided'
    when 'expired' then 'Expired'
    else 'Available' end,
  case when coalesce(batch.value->>'voidedQuantity', '') ~ '^[0-9]{1,10}$'
    then least((batch.value->>'voidedQuantity')::numeric, 2147483647)::integer
    else 0 end,
  case when coalesce(batch.value->>'voidedAt', '') = '' then null
    else (batch.value->>'voidedAt')::timestamptz end
from public.medicines
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(medicines.batches) = 'array' then medicines.batches else '[]'::jsonb end
) with ordinality as batch(value, ordinality)
on conflict (id) do update
set production_date = coalesce(
  public.medicine_batches.production_date,
  excluded.production_date
);

insert into public.medicine_batches (
  id, medicine_code, quantity, production_date, expiration_date
)
select
  medicines.code || '-LEGACY',
  medicines.code,
  medicines.quantity,
  medicines.production_date,
  medicines.expiration_date
from public.medicines
where (medicines.quantity > 0 or medicines.production_date is not null or medicines.expiration_date is not null)
  and not exists (
    select 1 from public.medicine_batches
    where medicine_code = medicines.code
  )
on conflict (id) do update
set production_date = coalesce(
  public.medicine_batches.production_date,
  excluded.production_date
);

drop trigger if exists medicines_sync_batches on public.medicines;

update public.medicine_batches as batches
set production_date = medicines.production_date
from public.medicines
where batches.medicine_code = medicines.code
  and batches.production_date is null
  and medicines.production_date is not null;

update public.medicines
set quantity = coalesce((
      select sum(batches.quantity)::integer
      from public.medicine_batches as batches
      where batches.medicine_code = medicines.code
        and batches.status = 'Available'
    ), 0),
    batches = coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', batches.id,
          'qty', batches.quantity,
          'productionDate', batches.production_date,
          'exp', batches.expiration_date,
          'status', batches.status,
          'voidedQuantity', batches.voided_quantity,
          'voidedAt', batches.voided_at
        )
        order by batches.expiration_date asc nulls last, batches.id
      )
      from public.medicine_batches as batches
      where batches.medicine_code = medicines.code
    ), '[]'::jsonb)
where exists (
  select 1 from public.medicine_batches as batches
  where batches.medicine_code = medicines.code
);

alter table public.medicines
  drop column if exists production_date;

create or replace function public.refresh_medicine_batch_snapshot(p_medicine_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_sync_setting text := current_setting('app.syncing_medicine_batches', true);
begin
  perform set_config('app.syncing_medicine_batches', 'on', true);
  update public.medicines
  set quantity = coalesce((
        select sum(batches.quantity)::integer
        from public.medicine_batches as batches
        where batches.medicine_code = p_medicine_code
          and batches.status = 'Available'
      ), 0),
      batches = coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', batches.id,
            'qty', batches.quantity,
            'productionDate', batches.production_date,
            'exp', batches.expiration_date,
            'status', batches.status,
            'voidedQuantity', batches.voided_quantity,
            'voidedAt', batches.voided_at
          )
          order by batches.expiration_date asc nulls last, batches.id
        )
        from public.medicine_batches as batches
        where batches.medicine_code = p_medicine_code
      ), '[]'::jsonb),
      updated_at = now()
  where code = p_medicine_code;
  perform set_config(
    'app.syncing_medicine_batches',
    coalesce(v_previous_sync_setting, 'off'),
    true
  );
end;
$$;

create or replace function public.sync_medicine_batches_from_inventory_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch jsonb;
  v_batch_id text;
  v_batch_production date;
  v_batch_expiration date;
  v_batch_quantity integer;
  v_batch_status text;
  v_voided_quantity integer;
  v_index integer;
  v_delta integer;
  v_remaining integer;
  v_deduct integer;
  v_existing_batch record;
  v_previous_sync_setting text;
begin
  if current_setting('app.syncing_medicine_batches', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' or (
    new.batches is distinct from old.batches
    and jsonb_typeof(new.batches) = 'array'
    and jsonb_array_length(new.batches) > 0
  ) then
    if jsonb_typeof(new.batches) = 'array' and jsonb_array_length(new.batches) > 0 then
      for v_batch, v_index in
        select entries.value, entries.ordinality::integer
        from jsonb_array_elements(new.batches) with ordinality as entries(value, ordinality)
      loop
        v_batch_id := coalesce(nullif(v_batch->>'id', ''), new.code || '-B' || v_index::text);
        v_batch_production := case
          when coalesce(v_batch->>'productionDate', v_batch->>'production_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            then coalesce(v_batch->>'productionDate', v_batch->>'production_date')::date
          else null
        end;
        v_batch_expiration := case
          when coalesce(v_batch->>'exp', v_batch->>'expirationDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            then coalesce(v_batch->>'exp', v_batch->>'expirationDate')::date
          else null
        end;
        v_batch_quantity := case
          when coalesce(v_batch->>'qty', v_batch->>'quantity', '') ~ '^[0-9]{1,10}$'
            then least(coalesce(v_batch->>'qty', v_batch->>'quantity')::numeric, 2147483647)::integer
          else 0
        end;
        v_batch_status := case lower(coalesce(v_batch->>'status', 'available'))
          when 'voided' then 'Voided'
          when 'expired' then 'Expired'
          else 'Available'
        end;
        v_voided_quantity := case
          when coalesce(v_batch->>'voidedQuantity', '') ~ '^[0-9]{1,10}$'
            then least((v_batch->>'voidedQuantity')::numeric, 2147483647)::integer
          else 0
        end;
        insert into public.medicine_batches (
          id, medicine_code, quantity, production_date, expiration_date, status, voided_quantity, voided_at
        )
        values (
          v_batch_id, new.code, v_batch_quantity, v_batch_production, v_batch_expiration,
          v_batch_status, v_voided_quantity,
          case when nullif(v_batch->>'voidedAt', '') is null then null
            else (v_batch->>'voidedAt')::timestamptz end
        )
        on conflict (id) do update
        set quantity = excluded.quantity,
            production_date = case
              when v_batch ? 'productionDate' or v_batch ? 'production_date'
                then excluded.production_date
              else public.medicine_batches.production_date
            end,
            expiration_date = excluded.expiration_date,
            status = excluded.status,
            voided_quantity = excluded.voided_quantity,
            voided_at = excluded.voided_at,
            updated_at = now()
        where public.medicine_batches.medicine_code = excluded.medicine_code;
      end loop;
    elsif tg_op = 'INSERT' and new.quantity > 0 then
      insert into public.medicine_batches (
        id, medicine_code, quantity, production_date, expiration_date
      )
      values (
        new.code || '-LEGACY', new.code, new.quantity, null, new.expiration_date
      )
      on conflict (id) do nothing;
    end if;
  elsif tg_op = 'UPDATE' and new.quantity is distinct from old.quantity then
    v_delta := new.quantity - old.quantity;
    if v_delta > 0 then
      select * into v_existing_batch
      from public.medicine_batches
      where medicine_code = new.code
        and expiration_date is not distinct from new.expiration_date
        and status = 'Available'
      order by id
      limit 1
      for update;
      if found then
        update public.medicine_batches
        set quantity = quantity + v_delta, updated_at = now()
        where id = v_existing_batch.id;
      else
        insert into public.medicine_batches (
          id, medicine_code, quantity, expiration_date
        )
        values (
          new.code || '-ADJ-' || substr(md5(clock_timestamp()::text || random()::text), 1, 12),
          new.code,
          v_delta,
          new.expiration_date
        );
      end if;
    else
      v_remaining := abs(v_delta);
      for v_existing_batch in
        select id, quantity
        from public.medicine_batches
        where medicine_code = new.code and status = 'Available' and quantity > 0
        order by expiration_date asc nulls last, id
        for update
      loop
        exit when v_remaining = 0;
        v_deduct := least(v_existing_batch.quantity, v_remaining);
        update public.medicine_batches
        set quantity = quantity - v_deduct, updated_at = now()
        where id = v_existing_batch.id;
        v_remaining := v_remaining - v_deduct;
      end loop;
      if v_remaining > 0 then
        raise exception 'Inventory adjustment exceeds the batch-level stock for medicine %.', new.code;
      end if;
    end if;
  end if;

  v_previous_sync_setting := current_setting('app.syncing_medicine_batches', true);
  perform set_config('app.syncing_medicine_batches', 'on', true);
  update public.medicines
  set quantity = coalesce((
        select sum(batches.quantity)::integer
        from public.medicine_batches as batches
        where batches.medicine_code = new.code
          and batches.status = 'Available'
      ), 0),
      batches = coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', batches.id,
            'qty', batches.quantity,
            'productionDate', batches.production_date,
            'exp', batches.expiration_date,
            'status', batches.status,
            'voidedQuantity', batches.voided_quantity,
            'voidedAt', batches.voided_at
          )
          order by batches.expiration_date asc nulls last, batches.id
        )
        from public.medicine_batches as batches
        where batches.medicine_code = new.code
      ), '[]'::jsonb),
      updated_at = now()
  where code = new.code;
  perform set_config(
    'app.syncing_medicine_batches',
    coalesce(v_previous_sync_setting, 'off'),
    true
  );
  return new;
end;
$$;

drop trigger if exists medicines_sync_batches on public.medicines;
create trigger medicines_sync_batches
after insert or update on public.medicines
for each row execute function public.sync_medicine_batches_from_inventory_row();

create or replace function public.merge_inventory_item(
  p_item_type text,
  p_incoming jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_medicine public.medicines%rowtype;
  v_equipment public.equipment%rowtype;
  v_batches jsonb;
  v_incoming_batches jsonb;
  v_batch jsonb;
  v_batch_production date;
  v_batch_expiration date;
  v_batch_number text;
  v_batch_quantity integer;
  v_batch_index integer;
  v_total_quantity integer;
  v_identity text;
  v_incoming_id text;
  v_merged boolean;
begin
  if jsonb_typeof(p_incoming) <> 'object' then
    raise exception 'Inventory item must be a JSON object.';
  end if;

  v_incoming_id := coalesce(
    nullif(p_incoming->>'code', ''),
    nullif(p_incoming->>'id', '')
  );
  if v_incoming_id is null then
    raise exception 'Inventory item ID is required.';
  end if;

  if p_item_type = 'medicine' then
    v_identity := concat_ws(
      '|',
      lower(regexp_replace(btrim(coalesce(p_incoming->>'name', '')), '\s+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(p_incoming->>'category', 'General')), '\s+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(p_incoming->>'unit', 'piece')), '\s+', ' ', 'g'))
    );
    perform pg_advisory_xact_lock(hashtext('medicine|' || v_identity));

    select * into v_medicine
    from public.medicines
    where deleted_at is null
      and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(coalesce(p_incoming->>'name', '')), '\s+', ' ', 'g'))
      and lower(regexp_replace(btrim(category), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(coalesce(p_incoming->>'category', 'General')), '\s+', ' ', 'g'))
      and lower(regexp_replace(btrim(unit), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(coalesce(p_incoming->>'unit', 'piece')), '\s+', ' ', 'g'))
    order by created_at, code
    limit 1
    for update;

    v_merged := found;
    if not v_merged then
      insert into public.medicines (
        code, name, category, quantity, unit,
        expiration_date, batches, deleted_at, updated_at
      )
      values (
        v_incoming_id,
        coalesce(p_incoming->>'name', ''),
        coalesce(p_incoming->>'category', 'General'),
        greatest(0, coalesce(nullif(p_incoming->>'quantity', '')::integer, 0)),
        coalesce(p_incoming->>'unit', 'piece'),
        nullif(p_incoming->>'expiration_date', '')::date,
        case when jsonb_typeof(p_incoming->'batches') = 'array'
          then p_incoming->'batches' else '[]'::jsonb end,
        nullif(p_incoming->>'deleted_at', '')::timestamptz,
        now()
      )
      returning * into v_medicine;
      return jsonb_build_object('canonical_id', v_medicine.code, 'merged', false);
    end if;

    v_batches := case
      when jsonb_typeof(v_medicine.batches) = 'array' then v_medicine.batches
      else '[]'::jsonb
    end;
    if jsonb_array_length(v_batches) = 0 and v_medicine.quantity > 0 then
      v_batches := jsonb_build_array(jsonb_build_object(
        'id', v_medicine.code || '-LEGACY',
        'qty', v_medicine.quantity,
        'exp', v_medicine.expiration_date,
        'status', 'Available'
      ));
    end if;
    v_incoming_batches := case
      when jsonb_typeof(p_incoming->'batches') = 'array' then p_incoming->'batches'
      else '[]'::jsonb
    end;
    if jsonb_array_length(v_incoming_batches) = 0
      and coalesce(nullif(p_incoming->>'quantity', '')::integer, 0) > 0 then
      v_incoming_batches := jsonb_build_array(jsonb_build_object(
        'id', v_incoming_id || '-B1',
        'qty', (p_incoming->>'quantity')::integer,
        'exp', nullif(p_incoming->>'expiration_date', ''),
        'status', 'Available'
      ));
    end if;

    for v_batch in select value from jsonb_array_elements(v_incoming_batches)
    loop
      v_batch_production := case
        when coalesce(v_batch->>'productionDate', v_batch->>'production_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then coalesce(v_batch->>'productionDate', v_batch->>'production_date')::date
        else null
      end;
      v_batch_expiration := nullif(coalesce(
        v_batch->>'exp',
        v_batch->>'expirationDate',
        v_batch->>'expiration_date'
      ), '')::date;
      v_batch_quantity := greatest(0, coalesce(
        nullif(coalesce(v_batch->>'qty', v_batch->>'quantity'), '')::integer,
        0
      ));
      v_batch_index := null;
      if lower(coalesce(v_batch->>'status', 'available')) = 'available' then
        select (entry.ordinality - 1)::integer into v_batch_index
        from jsonb_array_elements(v_batches) with ordinality as entry(value, ordinality)
        where lower(coalesce(entry.value->>'status', 'available')) = 'available'
          and case
            when coalesce(entry.value->>'productionDate', entry.value->>'production_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              then coalesce(entry.value->>'productionDate', entry.value->>'production_date')::date
            else null
          end is not distinct from v_batch_production
          and nullif(coalesce(
            entry.value->>'exp',
            entry.value->>'expirationDate',
            entry.value->>'expiration_date'
          ), '')::date is not distinct from v_batch_expiration
        limit 1;
      end if;
      if v_batch_index is not null then
        v_batch_quantity := v_batch_quantity + greatest(0, coalesce(
          nullif(coalesce(
            v_batches->v_batch_index->>'qty',
            v_batches->v_batch_index->>'quantity'
          ), '')::integer,
          0
        ));
        v_batches := jsonb_set(
          v_batches,
          array[v_batch_index::text, 'qty'],
          to_jsonb(v_batch_quantity),
          true
        );
      else
        if nullif(v_batch->>'id', '') is null then
          v_batch := jsonb_set(v_batch, '{id}', to_jsonb(v_incoming_id || '-B' || (jsonb_array_length(v_batches) + 1)::text), true);
        end if;
        if coalesce(v_batch->>'qty', v_batch->>'quantity') is null then
          v_batch := jsonb_set(v_batch, '{qty}', to_jsonb(v_batch_quantity), true);
        end if;
        v_batches := v_batches || jsonb_build_array(v_batch);
      end if;
    end loop;

    select coalesce(sum(
      case when lower(coalesce(entry.value->>'status', 'available')) = 'available'
        then greatest(0, coalesce(nullif(coalesce(
          entry.value->>'qty',
          entry.value->>'quantity'
        ), '')::integer, 0))
        else 0 end
    ), 0)::integer into v_total_quantity
    from jsonb_array_elements(v_batches) as entry(value);

    update public.medicines
    set batches = v_batches,
        quantity = v_total_quantity,
        updated_at = now()
    where code = v_medicine.code;
    return jsonb_build_object('canonical_id', v_medicine.code, 'merged', true);
  elsif p_item_type = 'equipment' then
    v_identity := concat_ws(
      '|',
      lower(regexp_replace(btrim(coalesce(p_incoming->>'name', '')), '\s+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(p_incoming->>'category', 'Medical Supplies')), '\s+', ' ', 'g'))
    );
    perform pg_advisory_xact_lock(hashtext('equipment|' || v_identity));

    select * into v_equipment
    from public.equipment
    where deleted_at is null
      and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(coalesce(p_incoming->>'name', '')), '\s+', ' ', 'g'))
      and lower(regexp_replace(btrim(category), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(coalesce(p_incoming->>'category', 'Medical Supplies')), '\s+', ' ', 'g'))
    order by created_at, id
    limit 1
    for update;

    v_merged := found;
    if not v_merged then
      insert into public.equipment (
        id, name, category, quantity, condition, last_maintenance_date,
        status, batches, deleted_at, updated_at
      )
      values (
        v_incoming_id,
        coalesce(p_incoming->>'name', ''),
        coalesce(p_incoming->>'category', 'Medical Supplies'),
        greatest(0, coalesce(nullif(p_incoming->>'quantity', '')::integer, 0)),
        coalesce(p_incoming->>'condition', 'Good'),
        nullif(p_incoming->>'last_maintenance_date', '')::date,
        coalesce(p_incoming->>'status', 'Available'),
        case when jsonb_typeof(p_incoming->'batches') = 'array'
          then p_incoming->'batches' else '[]'::jsonb end,
        nullif(p_incoming->>'deleted_at', '')::timestamptz,
        now()
      )
      returning * into v_equipment;
      return jsonb_build_object('canonical_id', v_equipment.id, 'merged', false);
    end if;

    v_batches := case
      when jsonb_typeof(v_equipment.batches) = 'array' then v_equipment.batches
      else '[]'::jsonb
    end;
    if jsonb_array_length(v_batches) = 0 and v_equipment.quantity > 0 then
      v_batches := jsonb_build_array(jsonb_build_object(
        'id', v_equipment.id || '-LEGACY',
        'qty', v_equipment.quantity
      ));
    end if;
    v_incoming_batches := case
      when jsonb_typeof(p_incoming->'batches') = 'array' then p_incoming->'batches'
      else '[]'::jsonb
    end;
    if jsonb_array_length(v_incoming_batches) = 0
      and coalesce(nullif(p_incoming->>'quantity', '')::integer, 0) > 0 then
      v_incoming_batches := jsonb_build_array(jsonb_build_object(
        'id', v_incoming_id || '-B1',
        'qty', (p_incoming->>'quantity')::integer
      ));
    end if;

    for v_batch in select value from jsonb_array_elements(v_incoming_batches)
    loop
      v_batch_expiration := nullif(coalesce(
        v_batch->>'exp',
        v_batch->>'expirationDate',
        v_batch->>'expiration_date'
      ), '')::date;
      v_batch_number := lower(btrim(coalesce(
        v_batch->>'batchNumber',
        v_batch->>'batch_number',
        ''
      )));
      v_batch_quantity := greatest(0, coalesce(
        nullif(coalesce(v_batch->>'qty', v_batch->>'quantity'), '')::integer,
        0
      ));
      v_batch_index := null;
      select (entry.ordinality - 1)::integer into v_batch_index
      from jsonb_array_elements(v_batches) with ordinality as entry(value, ordinality)
      where lower(btrim(coalesce(
          entry.value->>'batchNumber',
          entry.value->>'batch_number',
          ''
        ))) = v_batch_number
        and nullif(coalesce(
          entry.value->>'exp',
          entry.value->>'expirationDate',
          entry.value->>'expiration_date'
        ), '')::date is not distinct from v_batch_expiration
      limit 1;
      if v_batch_index is not null then
        v_batch_quantity := v_batch_quantity + greatest(0, coalesce(
          nullif(coalesce(
            v_batches->v_batch_index->>'qty',
            v_batches->v_batch_index->>'quantity'
          ), '')::integer,
          0
        ));
        v_batches := jsonb_set(
          v_batches,
          array[v_batch_index::text, 'qty'],
          to_jsonb(v_batch_quantity),
          true
        );
      else
        if nullif(v_batch->>'id', '') is null then
          v_batch := jsonb_set(v_batch, '{id}', to_jsonb(v_incoming_id || '-B' || (jsonb_array_length(v_batches) + 1)::text), true);
        end if;
        if coalesce(v_batch->>'qty', v_batch->>'quantity') is null then
          v_batch := jsonb_set(v_batch, '{qty}', to_jsonb(v_batch_quantity), true);
        end if;
        v_batches := v_batches || jsonb_build_array(v_batch);
      end if;
    end loop;

    update public.equipment
    set batches = v_batches,
        quantity = v_equipment.quantity + greatest(
          0,
          coalesce(nullif(p_incoming->>'quantity', '')::integer, 0)
        ),
        updated_at = now()
    where id = v_equipment.id;
    return jsonb_build_object('canonical_id', v_equipment.id, 'merged', true);
  else
    raise exception 'Unsupported inventory item type: %', p_item_type;
  end if;
end;
$$;

revoke all on function public.merge_inventory_item(text, jsonb) from public, anon, authenticated;
grant execute on function public.merge_inventory_item(text, jsonb) to service_role;

do $$
declare
  v_medicine_code text;
begin
  for v_medicine_code in
    select code from public.medicines
  loop
    perform public.refresh_medicine_batch_snapshot(v_medicine_code);
  end loop;
end;
$$;

create or replace function public.void_expiring_medicine_batches()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_voided integer := 0;
  v_previous integer;
begin
  perform pg_advisory_xact_lock(hashtext('medicine-expiration-void'));
  for v_batch in
    select *
    from public.medicine_batches
    where status = 'Available'
      and expiration_date is not null
      and expiration_date - (current_timestamp at time zone 'Asia/Manila')::date = 3
      and quantity > 0
    for update
  loop
    v_previous := v_batch.quantity;
    update public.medicine_batches
    set quantity = 0,
        voided_quantity = v_previous,
        status = 'Voided',
        voided_at = now(),
        updated_at = now()
    where id = v_batch.id;

    perform public.refresh_medicine_batch_snapshot(v_batch.medicine_code);

    insert into public.audit_logs (
      user_name, username, role, action, event_details, module, status, created_at
    )
    values (
      'System Automation', 'system_automation', 'System',
      'Automatic Medicine Voiding',
      format(
        'Medicine batch %s for medicine %s was voided three days before expiration. Batch identifier: %s. Previous quantity: %s. Updated quantity: 0. Voided quantity: %s. Expiration date: %s. Reason: exactly three days remaining before expiration.',
        v_batch.id,
        coalesce((select name from public.medicines where code = v_batch.medicine_code), v_batch.medicine_code),
        v_batch.id,
        v_previous,
        v_previous,
        v_batch.expiration_date
      ),
      'Medicines', 'Warning', now()
    );
    v_voided := v_voided + 1;
  end loop;
  return v_voided;
end;
$$;

drop function if exists public.deduct_medicine_fefo(text, integer, text);

create or replace function public.deduct_medicine_fefo(
  p_medicine_code text,
  p_medicine_name text,
  p_quantity integer,
  p_visit_id text,
  p_user_id text,
  p_username text,
  p_user_name text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining integer := p_quantity;
  v_batch record;
  v_available integer;
  v_deducted integer;
  v_medicine record;
  v_total_before integer;
  v_total_after integer;
  v_batch_before integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Medicine quantity must be a positive whole number.';
  end if;
  perform public.void_expiring_medicine_batches();
  select * into v_medicine
  from public.medicines
  where code = p_medicine_code and deleted_at is null
  for update;
  if not found then raise exception 'The selected medicine is unavailable.'; end if;
  if v_medicine.name is distinct from p_medicine_name then
    raise exception 'The selected medicine does not match the inventory record.';
  end if;
  if exists (
    select 1 from public.medicine_batch_deductions
    where visit_id = p_visit_id
      and medicine_code = p_medicine_code
      and reversed_at is null
  ) then
    return jsonb_build_object('status', 'already_deducted', 'visitId', p_visit_id);
  end if;
  v_total_before := coalesce(v_medicine.quantity, 0);
  select coalesce(sum(quantity), 0)::integer into v_available
  from public.medicine_batches
  where medicine_code = p_medicine_code
    and status = 'Available'
    and quantity > 0
    and (
      expiration_date is null or
      expiration_date - (current_timestamp at time zone 'Asia/Manila')::date > 3
    );
  if v_available < p_quantity then
    raise exception 'Insufficient stock for %: % available, % requested.',
      v_medicine.name, v_available, p_quantity using errcode = 'P0001';
  end if;
  for v_batch in
    select *
    from public.medicine_batches
    where medicine_code = p_medicine_code
      and status = 'Available'
      and quantity > 0
      and (expiration_date is null or expiration_date > (current_timestamp at time zone 'Asia/Manila')::date)
      and (expiration_date is null or expiration_date - (current_timestamp at time zone 'Asia/Manila')::date > 3)
    order by expiration_date asc nulls last
    for update
  loop
    exit when v_remaining <= 0;
    v_batch_before := v_batch.quantity;
    v_deducted := least(v_batch.quantity, v_remaining);
    update public.medicine_batches
    set quantity = quantity - v_deducted, updated_at = now()
    where id = v_batch.id;
    insert into public.medicine_batch_deductions (
      visit_id, batch_id, medicine_code, quantity
    ) values (p_visit_id, v_batch.id, p_medicine_code, v_deducted)
    on conflict (visit_id, batch_id) do update
    set quantity = excluded.quantity,
        medicine_code = excluded.medicine_code,
        reversed_at = null;
    insert into public.audit_logs (
      user_id, user_name, username, role, action, event_details, module, status, created_at
    )
    values (
      p_user_id,
      coalesce(nullif(btrim(p_user_name), ''), v_medicine.name),
      nullif(btrim(p_username), ''),
      coalesce(nullif(btrim(p_role), ''), 'Unknown'),
      'FEFO Inventory Deduction',
      format(
        'Medicine %s; batch identifier: %s; quantity deducted: %s; previous batch quantity: %s; updated batch quantity: %s; expiration date: %s; reason: Treatment Given FEFO deduction for visit %s.',
        v_medicine.name, v_batch.id, v_deducted, v_batch_before,
        v_batch_before - v_deducted, v_batch.expiration_date, p_visit_id
      ),
      'Medicines', 'Success', now()
    );
    v_remaining := v_remaining - v_deducted;
  end loop;
  if v_remaining > 0 then
    raise exception 'Insufficient medicine stock for %: % requested, % available.', v_medicine.name, p_quantity, p_quantity - v_remaining;
  end if;
  perform public.refresh_medicine_batch_snapshot(p_medicine_code);
  select quantity into v_total_after
  from public.medicines
  where code = p_medicine_code;
  return jsonb_build_object(
    'status', 'deducted',
    'medicineCode', p_medicine_code,
    'quantity', p_quantity,
    'previousQuantity', v_total_before,
    'updatedQuantity', v_total_after
  );
end;
$$;

revoke all on function public.void_expiring_medicine_batches() from public, anon, authenticated;
grant execute on function public.void_expiring_medicine_batches() to service_role;
revoke all on function public.deduct_medicine_fefo(text, text, integer, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.deduct_medicine_fefo(text, text, integer, text, text, text, text, text) to service_role;