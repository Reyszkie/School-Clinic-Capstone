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
  role text not null check (role in ('Head Nurse & Administrator', 'Head Nurse', 'Staff Nurse')),
  username text not null unique,
  password_hash text,
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  -- Legacy fields remain nullable for existing rows; the clinic UI/API no longer use them.
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

create or replace function public.save_clinical_visit_with_inventory(
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
  v_deduction record;
  v_quantity integer;
  v_stock integer;
  v_item_id text;
  v_item_name text;
  v_has_deductions boolean;
begin
  v_visit := jsonb_populate_record(null::public.clinical_visits, p_visit);
  if v_visit.id is null or v_visit.patient_id is null then
    raise exception 'A visit ID and patient ID are required.';
  end if;
  if nullif(btrim(v_visit.complaint), '') is null then
    raise exception 'A reason for the clinic visit is required.';
  end if;
  if nullif(btrim(v_visit.outcome), '') is null then
    raise exception 'A clinic disposition outcome is required.';
  end if;
  if v_visit.guardian_contacted is not null
    and v_visit.guardian_contacted not in ('Yes', 'No', 'Not Applicable') then
    raise exception 'Parent / Guardian Contacted must be Yes, No, or Not Applicable.';
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
            update public.medicines
            set quantity = quantity + v_deduction.quantity
            where code = v_deduction.item_id;
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

  if v_visit.medicine_code is not null then
    v_quantity := v_visit.medicine_quantity;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Medication quantity must be a positive whole number.';
    end if;
    update public.medicines
    set quantity = quantity - v_quantity
    where code = v_visit.medicine_code
      and name = v_visit.medicine_name
      and quantity >= v_quantity
      and deleted_at is null
      and (expiration_date is null or expiration_date >= current_date)
    returning quantity + v_quantity into v_stock;
    if not found then
      select quantity into v_stock from public.medicines where code = v_visit.medicine_code;
      raise exception 'Insufficient stock for %: % available, % requested.',
        coalesce(v_visit.medicine_name, v_visit.medicine_code), coalesce(v_stock, 0), v_quantity
        using errcode = 'P0001';
    end if;
    insert into public.clinical_visit_inventory_deductions (visit_id, item_type, item_id, quantity)
    values (v_visit.id, 'medicine', v_visit.medicine_code, v_quantity);
  end if;

  if v_visit.supply_item_id is not null then
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
  if nullif(btrim(v_visit.complaint), '') is null or nullif(btrim(v_visit.outcome), '') is null then
    raise exception 'A reason for the clinic visit and an outcome are required.';
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

create or replace function public.save_new_patient_with_initial_visit(
  p_patient jsonb,
  p_visit jsonb,
  p_patient_allergies text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient public.patients;
  v_visit public.clinical_visits;
begin
  v_patient := jsonb_populate_record(null::public.patients, p_patient);
  v_visit := jsonb_populate_record(null::public.clinical_visits, p_visit);
  if v_patient.id is null or v_visit.id is null or v_visit.patient_id is null then
    raise exception 'A patient ID and an initial visit linked to that patient are required.';
  end if;
  if v_patient.id <> v_visit.patient_id then
    raise exception 'The initial visit must reference the patient being created.';
  end if;
  if nullif(btrim(v_patient.last_name), '') is null
    or nullif(btrim(v_patient.first_name), '') is null
    or nullif(btrim(coalesce(v_patient.institutional_category, v_patient.course)), '') is null
    or nullif(btrim(coalesce(v_patient.personnel_type, v_patient.year_level)), '') is null then
    raise exception 'Name, institutional category, and year level or personnel type are required.';
  end if;
  if v_patient.guardian_contact is null or v_patient.guardian_contact !~ '^[0-9]{11}$' then
    raise exception 'Parent / Guardian Contact must contain exactly 11 digits.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_patient.id, 0));
  if exists (select 1 from public.patients where id = v_patient.id) then
    if exists (
      select 1
      from public.clinical_visits
      where id = v_visit.id and patient_id = v_patient.id
    ) then
      return;
    end if;
    raise exception 'A patient with this ID already exists.' using errcode = '23505';
  end if;

  v_patient.allergies := coalesce(nullif(p_patient_allergies, ''), v_patient.allergies, 'Not Yet Assessed');
  v_patient.deleted_at := null;
  v_patient.deleted_by := null;
  v_patient.created_at := coalesce(v_patient.created_at, now());
  v_patient.updated_at := now();
  insert into public.patients select (v_patient).*;

  perform public.save_clinical_visit_with_inventory(p_visit, p_patient_allergies);
end;
$$;

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
    if v_visit.status = 'Deleted' then return; end if;
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
    if v_visit.status <> 'Deleted' then return; end if;
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

revoke all on function public.save_clinical_visit_with_inventory(jsonb, text) from public;
grant execute on function public.save_clinical_visit_with_inventory(jsonb, text) to service_role;
revoke all on function public.update_clinical_visit_with_inventory(jsonb, text) from public;
grant execute on function public.update_clinical_visit_with_inventory(jsonb, text) to service_role;
revoke all on function public.save_new_patient_with_initial_visit(jsonb, jsonb, text) from public;
grant execute on function public.save_new_patient_with_initial_visit(jsonb, jsonb, text) to service_role;
revoke all on function public.set_clinical_visit_inventory_status(text, boolean, boolean) from public;
grant execute on function public.set_clinical_visit_inventory_status(text, boolean, boolean) to service_role;

-- Upgrade existing databases so deleting a patient also deletes that patient's visits.
alter table public.clinical_visits
  drop constraint if exists clinical_visits_patient_id_fkey;
alter table public.clinical_visits
  add constraint clinical_visits_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  user_id text references public.clinic_users(id) on delete set null,
  user_name text not null,
  role text not null default 'Unknown',
  action text not null,
  module text not null,
  status text not null default 'Success' check (status in ('Success', 'Warning', 'Error')),
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists role text not null default 'Unknown';
drop trigger if exists audit_logs_prevent_mutation on public.audit_logs;
update public.audit_logs as logs
set role = users.role
from public.clinic_users as users
where logs.user_id = users.id and logs.role = 'Unknown';

alter table public.audit_logs enable row level security;

-- Audit writes use the server-side secret key; do not expose direct anon/authenticated access.
drop policy if exists "audit_logs_all_access" on public.audit_logs;

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
create index if not exists medicines_expiration_idx
  on public.medicines (expiration_date);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

-- RLS is enabled without client policies; access flows through the authenticated server API.
alter table public.clinic_users enable row level security;

-- Local test account for the clinic login endpoint.
-- Change or remove this account before production use.
insert into public.clinic_users (
  id, name, last_name, first_name, role, username, password_hash, status
)
values (
  'NRS-TEST', 'Test Nurse', 'Nurse', 'Test', 'Staff Nurse', 'testnurse', extensions.crypt('test12345', extensions.gen_salt('bf')), 'Active'
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
  case when user_row->>'role' in ('Head Nurse & Administrator', 'Head Nurse', 'Staff Nurse') then user_row->>'role' else 'Staff Nurse' end,
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
    and role = 'Head Nurse'
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