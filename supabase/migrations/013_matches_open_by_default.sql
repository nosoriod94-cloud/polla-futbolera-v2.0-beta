-- ============================================================
-- Migración 013: Partidos abiertos por defecto
-- ============================================================
-- Los partidos ahora se crean con is_unlocked = true (abiertos).
-- El bloqueo manual es opcional; el cierre automático ocurre
-- 1 minuto antes del inicio (enforced en el policy de predictions).
-- ============================================================

-- Cambiar el default de la columna
ALTER TABLE matches ALTER COLUMN is_unlocked SET DEFAULT true;

-- Abrir todos los partidos futuros que quedaron cerrados (legacy)
UPDATE matches
SET is_unlocked = true
WHERE is_unlocked = false
  AND fecha_hora > now() + interval '1 minute';
