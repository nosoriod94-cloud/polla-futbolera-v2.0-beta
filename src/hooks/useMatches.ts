import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MatchResult } from '@/lib/database.types'
import { z } from 'zod'

const JornadaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  orden: z.number().int().min(1).max(100),
  puntosPorAcierto: z.number().int().min(1).max(50),
})

const MatchSchema = z.object({
  equipoA: z.string().min(1).max(100),
  equipoB: z.string().min(1).max(100),
  fechaHora: z.string().datetime({ offset: true }).or(z.string().min(1)),
  estadio: z.string().max(200).optional(),
})

const ResultadoSchema = z.enum(['A_wins', 'draw', 'B_wins'])

export function useJornadas(pollaId: string | undefined) {
  return useQuery({
    queryKey: ['jornadas', pollaId],
    enabled: !!pollaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .eq('polla_id', pollaId!)
        .order('orden', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useMatches(pollaId: string | undefined, jornadaId?: string) {
  return useQuery({
    queryKey: ['matches', pollaId, jornadaId],
    enabled: !!pollaId,
    queryFn: async () => {
      let q = supabase
        .from('matches')
        .select('*')
        .eq('polla_id', pollaId!)
        .order('fecha_hora', { ascending: true })
      if (jornadaId) q = q.eq('jornada_id', jornadaId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useCreateJornada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pollaId,
      nombre,
      orden,
      puntosPorAcierto,
    }: {
      pollaId: string
      nombre: string
      orden: number
      puntosPorAcierto: number
    }) => {
      JornadaSchema.parse({ nombre, orden, puntosPorAcierto })
      const { data, error } = await supabase
        .from('jornadas')
        .insert({ polla_id: pollaId, nombre, orden, puntos_por_acierto: puntosPorAcierto })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['jornadas', pollaId] })
    },
  })
}

export function useCreateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pollaId,
      jornadaId,
      equipoA,
      equipoB,
      fechaHora,
      estadio,
    }: {
      pollaId: string
      jornadaId: string
      equipoA: string
      equipoB: string
      fechaHora: string
      estadio?: string
    }) => {
      MatchSchema.parse({ equipoA, equipoB, fechaHora, estadio })
      const { data, error } = await supabase
        .from('matches')
        .insert({
          polla_id: pollaId,
          jornada_id: jornadaId,
          equipo_a: equipoA,
          equipo_b: equipoB,
          fecha_hora: fechaHora,
          estadio: estadio || null,
          is_unlocked: true, // abierto por defecto; se cierra solo 1 min antes
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['matches', pollaId] })
    },
  })
}

export function useUpdateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      matchId,
      pollaId,
      updates,
    }: {
      matchId: string
      pollaId: string
      updates: {
        equipo_a?: string
        equipo_b?: string
        fecha_hora?: string
        estadio?: string
        is_unlocked?: boolean
        resultado?: MatchResult
      }
    }) => {
      if (updates.resultado !== undefined && updates.resultado !== null) {
        ResultadoSchema.parse(updates.resultado)
      }
      if (updates.equipo_a !== undefined) z.string().min(1).max(100).parse(updates.equipo_a)
      if (updates.equipo_b !== undefined) z.string().min(1).max(100).parse(updates.equipo_b)
      const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', matchId)
      if (error) throw error
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['matches', pollaId] })
    },
  })
}

export function useDeleteMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ matchId, pollaId }: { matchId: string; pollaId: string }) => {
      const { error } = await supabase.from('matches').delete().eq('id', matchId)
      if (error) throw error
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['matches', pollaId] })
    },
  })
}

export function useUpdateJornada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      jornadaId,
      pollaId,
      puntosPorAcierto,
    }: {
      jornadaId: string
      pollaId: string
      puntosPorAcierto: number
    }) => {
      z.number().int().min(1).max(50).parse(puntosPorAcierto)
      const { error } = await supabase
        .from('jornadas')
        .update({ puntos_por_acierto: puntosPorAcierto })
        .eq('id', jornadaId)
      if (error) throw error
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['jornadas', pollaId] })
    },
  })
}
