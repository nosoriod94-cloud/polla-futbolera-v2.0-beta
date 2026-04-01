import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { z } from 'zod'

const PollaNombreSchema = z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100)

export function useMyPollas() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pollas', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pollas')
        .select('*')
        .eq('admin_user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useMyParticipatingPollas() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pollas_participando', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polla_participants')
        .select('polla_id, status, apodo, pollas(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// Retorna el estado completo de la licencia del usuario actual
export function useLicense() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['license', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licenses')
        .select('pollas_limit, pollas_created, is_active')
        .eq('email_autorizado', user!.email!.toLowerCase())
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        canCreate: data.is_active && data.pollas_created < data.pollas_limit,
        pollasCreated: data.pollas_created,
        pollasLimit: data.pollas_limit,
        isActive: data.is_active,
      }
    },
  })
}

/** @deprecated usa useLicense() */
export function useHasLicense() {
  const license = useLicense()
  return {
    ...license,
    data: license.data?.canCreate ?? false,
  }
}

export function useCreatePolla() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (nombre: string) => {
      PollaNombreSchema.parse(nombre)
      // 1. Crear la polla (invite_code se genera automáticamente via trigger)
      const { data: polla, error: pollaErr } = await supabase
        .from('pollas')
        .insert({ nombre, admin_user_id: user!.id })
        .select()
        .single()
      if (pollaErr) throw pollaErr

      // 2. Marcar la licencia como usada e incrementar contador (via función security definer)
      const { error: useErr } = await supabase
        .rpc('use_license', { p_polla_id: polla.id })
      if (useErr) {
        // Revertir la polla si falla
        await supabase.from('pollas').delete().eq('id', polla.id)
        throw new Error(useErr.message)
      }

      return polla
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pollas', user?.id] })
      qc.invalidateQueries({ queryKey: ['license', user?.email] })
    },
  })
}

export function usePolla(pollaId: string | undefined) {
  return useQuery({
    queryKey: ['polla', pollaId],
    enabled: !!pollaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pollas')
        .select('*')
        .eq('id', pollaId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function usePollaByInviteCode(inviteCode: string | undefined) {
  return useQuery({
    queryKey: ['polla_invite', inviteCode],
    enabled: !!inviteCode && inviteCode.length >= 6,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pollas')
        .select('id, nombre, is_active')
        .eq('invite_code', inviteCode!.trim().toUpperCase())
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// ─────────────────────────────────────────────
// Hooks exclusivos para SuperAdmin
// ─────────────────────────────────────────────

export function useAllPollas() {
  return useQuery({
    queryKey: ['all_pollas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pollas')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// Obtiene todas las licencias vía RPC (sin SELECT directo a la tabla)
export function useAllLicenses() {
  return useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_licenses')
      if (error) throw error
      return data as Array<{
        id: string
        email_autorizado: string
        pollas_limit: number
        pollas_created: number
        is_active: boolean
        otorgada_por: string | null
        created_at: string
      }>
    },
  })
}

export function useGrantLicense() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .rpc('grant_license', { p_superadmin_id: user!.id, p_email: email })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['licenses'] })
    },
  })
}

export function useToggleLicenseActive() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ email, active }: { email: string; active: boolean }) => {
      const { error } = await supabase.rpc('toggle_license_active', {
        p_superadmin_id: user!.id,
        p_email: email,
        p_active: active,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['licenses'] })
    },
  })
}
