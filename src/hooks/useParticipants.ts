import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { ParticipantStatus } from '@/lib/database.types'
import { z } from 'zod'

const ApodoSchema = z.string()
  .min(2, 'El apodo debe tener al menos 2 caracteres')
  .max(50, 'El apodo no puede superar 50 caracteres')
  .regex(/^[a-zA-Z0-9 ÁÉÍÓÚáéíóúÑñüÜ._'-]+$/, 'El apodo contiene caracteres no permitidos')

// Verifica en tiempo real si un apodo está disponible en una polla.
// Usa debounce externo; llama al RPC check_apodo_available.
export function useApodoAvailable(pollaId: string | undefined, apodo: string) {
  return useQuery({
    queryKey: ['apodo_available', pollaId, apodo.toLowerCase().trim()],
    enabled: !!pollaId && apodo.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_apodo_available', {
        p_polla_id: pollaId!,
        p_apodo: apodo.trim(),
      })
      if (error) throw error
      return data as boolean // true = disponible
    },
    staleTime: 0,
  })
}

// Para uso del Admin: incluye profiles(nombre_completo) para identificar al usuario.
// Se suscribe a cambios en tiempo real para que el panel se actualice automáticamente.
export function useParticipants(pollaId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!pollaId) return
    const channel = supabase
      .channel(`participants:${pollaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polla_participants',
          filter: `polla_id=eq.${pollaId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['participants', pollaId] })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [pollaId, qc])

  return useQuery({
    queryKey: ['participants', pollaId],
    enabled: !!pollaId,
    staleTime: 0,                // siempre considerar datos obsoletos
    refetchOnMount: 'always',    // refetch cada vez que el componente monta
    refetchInterval: 15_000,     // polling cada 15s como fallback
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polla_participants')
        .select('*, profiles(nombre_completo)')
        .eq('polla_id', pollaId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// Para uso público (Transparencia, Posiciones): sin user_id ni email
export function useParticipantsSafe(pollaId: string | undefined) {
  return useQuery({
    queryKey: ['participants_safe', pollaId],
    enabled: !!pollaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polla_participants')
        .select('id, polla_id, apodo, status')
        .eq('polla_id', pollaId!)
        .eq('status', 'authorized')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useMyParticipant(pollaId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my_participant', pollaId, user?.id],
    enabled: !!pollaId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polla_participants')
        .select('*')
        .eq('polla_id', pollaId!)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useJoinPolla() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ pollaId, apodo }: { pollaId: string; apodo: string }) => {
      ApodoSchema.parse(apodo)
      const { data, error } = await supabase
        .from('polla_participants')
        .insert({ polla_id: pollaId, user_id: user!.id, apodo, status: 'pending' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['participants', pollaId] })
      qc.invalidateQueries({ queryKey: ['my_participant', pollaId, user?.id] })
    },
  })
}

export function useUpdateParticipantStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      participantId,
      pollaId,
      status,
    }: {
      participantId: string
      pollaId: string
      status: ParticipantStatus
    }) => {
      const { error } = await supabase
        .from('polla_participants')
        .update({ status })
        .eq('id', participantId)
      if (error) throw error
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['participants', pollaId] })
      qc.invalidateQueries({ queryKey: ['participants_safe', pollaId] })
    },
  })
}

// Admin solicita ampliar el límite de participantes de una polla
export function useRequestParticipantLimit() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({
      pollaId,
      currentLimit,
      requestedLimit,
    }: {
      pollaId: string
      currentLimit: number
      requestedLimit: number
    }) => {
      const { data, error } = await supabase
        .from('participant_limit_requests')
        .insert({
          polla_id: pollaId,
          admin_id: user!.id,
          current_limit: currentLimit,
          requested_limit: requestedLimit,
          status: 'pending',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { pollaId }) => {
      qc.invalidateQueries({ queryKey: ['limit_requests', pollaId] })
    },
  })
}

// Obtiene el estado de la solicitud de expansión de una polla
export function useLimitRequest(pollaId: string | undefined) {
  return useQuery({
    queryKey: ['limit_requests', pollaId],
    enabled: !!pollaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_limit_requests')
        .select('*')
        .eq('polla_id', pollaId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// SuperAdmin: resuelve una solicitud (aprueba o rechaza)
export function useResolveLimitRequest() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({
      requestId,
      status,
      notes,
    }: {
      requestId: string
      status: 'approved' | 'rejected'
      notes?: string
    }) => {
      const { error } = await supabase.rpc('resolve_limit_request', {
        p_superadmin_id: user!.id,
        p_request_id: requestId,
        p_status: status,
        p_notes: notes ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending_limit_requests'] })
    },
  })
}

// SuperAdmin: obtiene todas las solicitudes pendientes
export function usePendingLimitRequests() {
  return useQuery({
    queryKey: ['pending_limit_requests'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_limit_requests')
      if (error) throw error
      return data as Array<{
        id: string
        polla_id: string
        polla_nombre: string
        admin_id: string
        admin_email: string
        current_limit: number
        requested_limit: number
        status: string
        notes: string | null
        created_at: string
      }>
    },
  })
}
