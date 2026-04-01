// Edge Function: assign-default-predictions
// Asigna predicción "draw" (Empate) a todos los participantes autorizados
// que no ingresaron predicción antes del cierre del partido.
//
// Configurar pg_cron en Supabase SQL Editor:
//   select cron.schedule(
//     'assign-default-predictions',
//     '* * * * *',
//     $$select assign_default_predictions()$$
//   );
//
// O bien, invocar este Edge Function desde un cron externo (ej. Supabase Cron Jobs).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Solo acepta POST (invocado por cron)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Validar Bearer token para que solo el cron autorizado pueda invocar esta función
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Buscar partidos que cerraron en el último minuto
  // (fecha_hora entre hace 2 minutos y hace 1 minuto)
  const now = new Date()
  const oneMinAgo = new Date(now.getTime() - 60_000).toISOString()
  const twoMinAgo = new Date(now.getTime() - 120_000).toISOString()

  const { data: closedMatches, error: matchErr } = await supabase
    .from('matches')
    .select('id, polla_id')
    .eq('is_unlocked', true)
    .lte('fecha_hora', oneMinAgo)
    .gte('fecha_hora', twoMinAgo)

  if (matchErr) {
    return new Response(JSON.stringify({ error: matchErr.message }), { status: 500 })
  }

  if (!closedMatches || closedMatches.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  let inserted = 0

  for (const match of closedMatches) {
    // Obtener participantes autorizados en esta polla
    const { data: participants, error: pErr } = await supabase
      .from('polla_participants')
      .select('id')
      .eq('polla_id', match.polla_id)
      .eq('status', 'authorized')

    if (pErr || !participants) continue

    // Obtener predicciones ya existentes para este partido
    const { data: existingPreds } = await supabase
      .from('predictions')
      .select('participant_id')
      .eq('match_id', match.id)

    const predictedIds = new Set((existingPreds ?? []).map(p => p.participant_id))

    // Insertar empate para quienes no predijeron
    const defaults = participants
      .filter(p => !predictedIds.has(p.id))
      .map(p => ({
        polla_id: match.polla_id,
        match_id: match.id,
        participant_id: p.id,
        pick: 'draw' as const,
        is_default: true,
      }))

    if (defaults.length > 0) {
      const { error: insertErr } = await supabase
        .from('predictions')
        .insert(defaults)

      if (!insertErr) inserted += defaults.length
    }
  }

  return new Response(
    JSON.stringify({ processed: closedMatches.length, inserted }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
