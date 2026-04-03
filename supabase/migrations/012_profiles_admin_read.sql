-- ============================================================
-- Migración 012: Permitir al admin leer perfiles de sus participantes
-- ============================================================
-- La política original de profiles solo permite leer el perfil propio.
-- Esto hace que el join profiles(nombre_completo) en useParticipants
-- retorne null (o falle) para las filas de otros participantes,
-- impidiendo que aparezcan en el panel del admin.
-- ============================================================

-- Función security definer para evitar recursión cross-table
-- (profiles → polla_participants → pollas → ...)
create or replace function is_polla_admin_of_user(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from polla_participants pp
    join pollas pol on pol.id = pp.polla_id
    where pp.user_id = p_user_id
      and pol.admin_user_id = auth.uid()
  );
$$;

grant execute on function is_polla_admin_of_user(uuid) to authenticated;

-- Nueva política: el admin de una polla puede leer los perfiles
-- de los participantes de sus pollas
create policy "profiles: select polla admin" on profiles
  for select using (
    is_polla_admin_of_user(user_id)
  );
