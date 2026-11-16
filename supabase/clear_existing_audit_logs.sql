-- One-time cleanup: run this once after deploying the audit-log schema.
-- Do not add this statement to schema.sql; future audit entries must be retained.
begin;

truncate table public.audit_logs;

update public.clinic_state
set state = jsonb_set(coalesce(state, '{}'::jsonb), '{auditLogs}', '[]'::jsonb, true),
    updated_at = now()
where state ? 'auditLogs';

commit;
