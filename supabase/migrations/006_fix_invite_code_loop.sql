-- Migration 006: Limitar reintentos en generate_invite_code para evitar loop infinito
-- El loop original no tenía límite de iteraciones, exponiéndose a un DoS indirecto.

create or replace function generate_invite_code()
returns text language plpgsql as $$
declare
  chars       text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result      text := '';
  i           int;
  attempt     int := 0;
  max_attempts int := 10;
begin
  loop
    -- Límite de seguridad: máximo 10 intentos
    attempt := attempt + 1;
    if attempt > max_attempts then
      raise exception 'No se pudo generar un invite_code único tras % intentos', max_attempts;
    end if;

    result := '';
    for i in 1..8 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;

    exit when not exists (select 1 from pollas where invite_code = result);
  end loop;

  return result;
end;
$$;
