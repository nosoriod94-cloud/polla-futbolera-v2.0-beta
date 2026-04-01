-- Migration 005: Audit log para acciones críticas de administradores
-- Registra quién hizo qué y cuándo en operaciones sensibles

-- Tabla de auditoría
create table if not exists audit_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,          -- 'match', 'participant', 'polla', 'license', etc.
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz default now() not null
);

-- Solo el sistema puede insertar; nadie puede modificar ni borrar
alter table audit_log enable row level security;

create policy "audit_log: solo lectura para superadmin via RPC"
  on audit_log for select
  using (false);  -- El acceso será únicamente via funciones security definer

-- Índices para consultas rápidas
create index if not exists idx_audit_log_user_id    on audit_log(user_id);
create index if not exists idx_audit_log_entity     on audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_created_at on audit_log(created_at desc);


-- ─────────────────────────────────────────────────────────────
-- Trigger: registrar cambio de resultado en un partido
-- ─────────────────────────────────────────────────────────────
create or replace function log_match_result_update()
returns trigger language plpgsql security definer as $$
begin
  if old.resultado is distinct from new.resultado then
    insert into audit_log (user_id, action, entity_type, entity_id, details)
    values (
      auth.uid(),
      'update_match_result',
      'match',
      new.id,
      jsonb_build_object(
        'polla_id',        new.polla_id,
        'equipo_a',        new.equipo_a,
        'equipo_b',        new.equipo_b,
        'resultado_antes', old.resultado,
        'resultado_nuevo', new.resultado
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_match_result on matches;
create trigger trg_log_match_result
  after update on matches
  for each row execute function log_match_result_update();


-- ─────────────────────────────────────────────────────────────
-- Trigger: registrar cambio de estado de participante
-- ─────────────────────────────────────────────────────────────
create or replace function log_participant_status_update()
returns trigger language plpgsql security definer as $$
begin
  if old.status is distinct from new.status then
    insert into audit_log (user_id, action, entity_type, entity_id, details)
    values (
      auth.uid(),
      'update_participant_status',
      'participant',
      new.id,
      jsonb_build_object(
        'polla_id',      new.polla_id,
        'apodo',         new.apodo,
        'status_antes',  old.status,
        'status_nuevo',  new.status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_participant_status on polla_participants;
create trigger trg_log_participant_status
  after update on polla_participants
  for each row execute function log_participant_status_update();


-- ─────────────────────────────────────────────────────────────
-- Función para que el superadmin consulte el audit log
-- ─────────────────────────────────────────────────────────────
create or replace function get_audit_log(p_superadmin_id uuid, p_limit int default 200)
returns table (
  id          uuid,
  user_id     uuid,
  action      text,
  entity_type text,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz
)
language plpgsql security definer as $$
begin
  -- Validar que quien llama es el superadmin
  if auth.uid() != p_superadmin_id then
    raise exception 'No autorizado';
  end if;
  if not exists (
    select 1 from auth.users
    where id = p_superadmin_id and email = current_setting('app.superadmin_email', true)
  ) then
    -- Fallback: verificar contra el email hardcodeado en la DB
    if not exists (
      select 1 from auth.users
      where id = p_superadmin_id and email = 'hola@pollafutbolera.online'
    ) then
      raise exception 'No autorizado';
    end if;
  end if;

  return query
    select al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.details, al.created_at
    from audit_log al
    order by al.created_at desc
    limit p_limit;
end;
$$;
