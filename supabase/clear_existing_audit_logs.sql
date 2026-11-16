-- One-time cleanup: keep October-November 2026 audit events and remove others.
-- Run once after deploying the audit-log schema; do not add this to schema.sql.
begin;

alter table public.audit_logs disable trigger audit_logs_prevent_mutation;

delete from public.audit_logs
where created_at < '2026-10-01 00:00:00+08'::timestamptz
   or created_at >= '2026-12-01 00:00:00+08'::timestamptz;

alter table public.audit_logs enable trigger audit_logs_prevent_mutation;

update public.clinic_state as snapshots
set state = jsonb_set(
      coalesce(snapshots.state, '{}'::jsonb),
      '{auditLogs}',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', logs.id,
            'date', to_char(logs.created_at at time zone 'Asia/Manila', 'YYYY-MM-DD'),
            'time', to_char(logs.created_at at time zone 'Asia/Manila', 'HH12:MI:SS AM'),
            'user', logs.user_name,
            'username', coalesce(logs.username, logs.user_name),
            'userId', logs.user_id,
            'role', logs.role,
            'action', logs.action,
            'eventDetails', logs.event_details,
            'lockoutDurationMinutes', logs.lockout_duration_minutes,
            'module', logs.module,
            'status', logs.status,
            'timestamp', logs.created_at
          )
          order by logs.created_at desc, logs.id desc
        )
        from public.audit_logs as logs
      ), '[]'::jsonb),
      true
    ),
    updated_at = now()
where snapshots.state ? 'auditLogs';

commit;
