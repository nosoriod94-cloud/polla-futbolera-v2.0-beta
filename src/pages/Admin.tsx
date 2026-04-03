import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePolla } from '@/hooks/usePollas'
import { useParticipants, useUpdateParticipantStatus, useLimitRequest, useRequestParticipantLimit } from '@/hooks/useParticipants'
import { useJornadas, useMatches, useCreateJornada, useCreateMatch, useUpdateMatch, useDeleteMatch, useUpdateJornada } from '@/hooks/useMatches'
import { useAllPredictionsForExport } from '@/hooks/usePredictions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, Plus, Download, Lock, Unlock, CheckCircle, XCircle, Clock,
  Pencil, Trash2, Copy, Users, AlertTriangle, Upload, Check, X, RefreshCw,
} from 'lucide-react'
import type { MatchResult } from '@/lib/database.types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Timezone helpers (Bogotá = UTC-5, sin cambio de horario) ───────────────

/** Convierte un valor de datetime-local en hora Bogotá a ISO UTC string */
function bogotaInputToUTC(localValue: string): string {
  // localValue: "YYYY-MM-DDTHH:mm" interpretado como UTC-5
  const d = new Date(localValue + ':00-05:00')
  if (isNaN(d.getTime())) throw new Error(`Fecha inválida: ${localValue}`)
  return d.toISOString()
}

/** Convierte un ISO UTC string al valor datetime-local en hora Bogotá.
 *  Usa getUTC* sobre el timestamp desplazado para evitar que date-fns
 *  o el browser apliquen una segunda corrección de timezone. */
function utcToBogotaInput(utcStr: string): string {
  try {
    const d = new Date(utcStr)
    if (isNaN(d.getTime())) return ''
    // Desplazamos -5h y leemos en UTC para obtener la hora local de Colombia
    const col = new Date(d.getTime() - 5 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${col.getUTCFullYear()}-${pad(col.getUTCMonth() + 1)}-${pad(col.getUTCDate())}T${pad(col.getUTCHours())}:${pad(col.getUTCMinutes())}`
  } catch {
    return ''
  }
}

/** Formatea un ISO UTC string como hora Colombia legible.
 *  Usa getUTC* (no date-fns format) para evitar que el browser
 *  aplique su propia timezone encima del desplazamiento ya calculado. */
function formatBogota(utcStr: string): string {
  try {
    const d = new Date(utcStr)
    if (isNaN(d.getTime())) return '—'
    const col = new Date(d.getTime() - 5 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${col.getUTCDate()} ${months[col.getUTCMonth()]} ${col.getUTCFullYear()}, ${pad(col.getUTCHours())}:${pad(col.getUTCMinutes())} Col`
  } catch {
    return '—'
  }
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

interface CsvRow {
  jornada: string
  equipo_a: string
  equipo_b: string
  fecha: string   // dd/mm/yyyy
  hora: string    // HH:mm (Bogotá)
  estadio: string
  // validated
  fechaUTC?: string
  error?: string
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (lines.length < 2) return []
  // Skip header row
  const dataLines = lines.slice(1)
  return dataLines.map(line => {
    const cols = line.split(',').map(c => c.trim())
    return {
      jornada: cols[0] ?? '',
      equipo_a: cols[1] ?? '',
      equipo_b: cols[2] ?? '',
      fecha: cols[3] ?? '',
      hora: cols[4] ?? '',
      estadio: cols[5] ?? '',
    }
  })
}

function validateAndEnrichRows(rows: CsvRow[], jornadaNames: string[]): CsvRow[] {
  return rows.map(row => {
    if (!row.jornada) return { ...row, error: 'Falta jornada' }
    if (!jornadaNames.includes(row.jornada)) return { ...row, error: `Jornada "${row.jornada}" no existe` }
    if (!row.equipo_a || !row.equipo_b) return { ...row, error: 'Faltan equipos' }
    if (!row.fecha.match(/^\d{2}\/\d{2}\/\d{4}$/)) return { ...row, error: 'Fecha inválida (usa dd/mm/yyyy)' }
    if (!row.hora.match(/^\d{2}:\d{2}$/)) return { ...row, error: 'Hora inválida (usa HH:mm)' }
    const [dd, mm, yyyy] = row.fecha.split('/')
    const isoLocal = `${yyyy}-${mm}-${dd}T${row.hora}`
    try {
      const utcDate = new Date(isoLocal + ':00-05:00')
      if (isNaN(utcDate.getTime())) return { ...row, error: 'Fecha u hora inválida' }
      return { ...row, fechaUTC: utcDate.toISOString() }
    } catch {
      return { ...row, error: 'Error al parsear fecha/hora' }
    }
  })
}

function downloadTemplate() {
  const header = 'jornada,equipo_a,equipo_b,fecha,hora_bogota,estadio'
  const example = 'Jornada 1,Colombia,Brasil,15/06/2026,20:00,MetLife Stadium'
  const example2 = 'Jornada 1,Argentina,México,16/06/2026,17:00,'
  const notes = [
    '# INSTRUCCIONES:',
    '# - jornada: debe coincidir exactamente con el nombre de la jornada creada en la polla',
    '# - fecha: formato dd/mm/yyyy (ej: 15/06/2026)',
    '# - hora_bogota: hora en Colombia UTC-5, formato HH:mm (ej: 20:00)',
    '# - estadio: opcional, puedes dejarlo vacío',
    '# - No borres la fila de encabezados (primera fila sin #)',
    '#',
  ].join('\n')
  const csv = `${notes}\n${header}\n${example}\n${example2}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_partidos.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Result labels ────────────────────────────────────────────────────────────

const resultLabels: Record<string, string> = {
  A_wins: 'Gana A',
  draw: 'Empate',
  B_wins: 'Gana B',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Admin() {
  const { pollaId } = useParams<{ pollaId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: polla, isLoading: loadingPolla } = usePolla(pollaId)
  const { data: participants = [], isFetching: fetchingParticipants, refetch: refetchParticipants } = useParticipants(pollaId)
  const { data: limitRequest } = useLimitRequest(pollaId)
  const requestLimit = useRequestParticipantLimit()
  const { data: jornadas = [] } = useJornadas(pollaId)
  const { data: matches = [] } = useMatches(pollaId)
  const { data: predictionsExport } = useAllPredictionsForExport(pollaId)

  const updateStatus = useUpdateParticipantStatus()
  const createJornada = useCreateJornada()
  const createMatch = useCreateMatch()
  const updateMatch = useUpdateMatch()
  const deleteMatch = useDeleteMatch()
  const updateJornada = useUpdateJornada()

  // Jornada form
  const [jornadaNombre, setJornadaNombre] = useState('')
  const [jornadaPuntos, setJornadaPuntos] = useState(3)
  const [jornadaOpen, setJornadaOpen] = useState(false)

  // Inline jornada puntos edit
  const [editingJornadaId, setEditingJornadaId] = useState<string | null>(null)
  const [editingJornadaPuntos, setEditingJornadaPuntos] = useState(3)

  // Match form
  const [matchJornadaId, setMatchJornadaId] = useState('')
  const [matchEquipoA, setMatchEquipoA] = useState('')
  const [matchEquipoB, setMatchEquipoB] = useState('')
  const [matchFechaHora, setMatchFechaHora] = useState('')  // Bogotá datetime-local value
  const [matchEstadio, setMatchEstadio] = useState('')
  const [matchOpen, setMatchOpen] = useState(false)

  // Edit match
  const [editMatch, setEditMatch] = useState<typeof matches[0] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editFechaHoraBogota, setEditFechaHoraBogota] = useState('')

  // Participant limit
  const [limitOpen, setLimitOpen] = useState(false)
  const authorizedCount = participants.filter(p => p.status === 'authorized').length
  const approvedLimit = limitRequest?.status === 'approved' ? limitRequest.requested_limit : 50

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)

  // Not admin → redirect
  if (!loadingPolla && polla && polla.admin_user_id !== user?.id) {
    navigate('/')
    return null
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleCreateJornada(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createJornada.mutateAsync({
        pollaId: pollaId!,
        nombre: jornadaNombre,
        orden: jornadas.length + 1,
        puntosPorAcierto: jornadaPuntos,
      })
      toast({ title: 'Jornada creada' })
      setJornadaOpen(false)
      setJornadaNombre('')
      setJornadaPuntos(3)
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function handleSaveJornadaPuntos(jornadaId: string) {
    try {
      await updateJornada.mutateAsync({ jornadaId, pollaId: pollaId!, puntosPorAcierto: editingJornadaPuntos })
      toast({ title: 'Puntos actualizados' })
      setEditingJornadaId(null)
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault()
    try {
      const fechaUTC = bogotaInputToUTC(matchFechaHora)
      await createMatch.mutateAsync({
        pollaId: pollaId!,
        jornadaId: matchJornadaId,
        equipoA: matchEquipoA,
        equipoB: matchEquipoB,
        fechaHora: fechaUTC,
        estadio: matchEstadio || undefined,
      })
      toast({ title: 'Partido creado' })
      setMatchOpen(false)
      setMatchEquipoA('')
      setMatchEquipoB('')
      setMatchFechaHora('')
      setMatchEstadio('')
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function handleUpdateMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!editMatch) return
    try {
      const fechaUTC = bogotaInputToUTC(editFechaHoraBogota)
      await updateMatch.mutateAsync({
        matchId: editMatch.id,
        pollaId: pollaId!,
        updates: {
          equipo_a: editMatch.equipo_a,
          equipo_b: editMatch.equipo_b,
          fecha_hora: fechaUTC,
          estadio: editMatch.estadio ?? undefined,
          resultado: editMatch.resultado,
        },
      })
      toast({ title: 'Partido actualizado' })
      setEditOpen(false)
      setEditMatch(null)
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function toggleUnlock(match: typeof matches[0]) {
    try {
      await updateMatch.mutateAsync({
        matchId: match.id,
        pollaId: pollaId!,
        updates: { is_unlocked: !match.is_unlocked },
      })
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm('¿Eliminar este partido?')) return
    try {
      await deleteMatch.mutateAsync({ matchId, pollaId: pollaId! })
      toast({ title: 'Partido eliminado' })
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      const jornadaNames = jornadas.map(j => j.nombre)
      const validated = validateAndEnrichRows(parsed, jornadaNames)
      setCsvRows(validated)
      setCsvOpen(true)
    }
    reader.readAsText(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  async function handleCSVImport() {
    const validRows = csvRows.filter(r => !r.error && r.fechaUTC)
    if (validRows.length === 0) return
    setCsvImporting(true)
    let created = 0
    let failed = 0
    for (const row of validRows) {
      const jornada = jornadas.find(j => j.nombre === row.jornada)
      if (!jornada) { failed++; continue }
      try {
        await createMatch.mutateAsync({
          pollaId: pollaId!,
          jornadaId: jornada.id,
          equipoA: row.equipo_a,
          equipoB: row.equipo_b,
          fechaHora: row.fechaUTC!,
          estadio: row.estadio || undefined,
        })
        created++
      } catch {
        failed++
      }
    }
    setCsvImporting(false)
    setCsvOpen(false)
    setCsvRows([])
    toast({
      title: `Importación completa`,
      description: `${created} partido(s) creados${failed > 0 ? `, ${failed} con error` : ''}.`,
    })
  }

  function downloadCSV(jornadaId?: string) {
    if (!predictionsExport) return
    const rows = predictionsExport.filter(p => {
      if (!jornadaId) return true
      const m = p.matches as unknown as { jornadas: { id?: string } } | null
      return m?.jornadas
    })

    const headers = ['Jornada', 'Partido', 'Participante', 'Predicción', 'Resultado', 'Acertó', 'Es default', 'Fecha envío']
    const lines = rows.map(p => {
      const m = p.matches as unknown as {
        equipo_a: string; equipo_b: string; fecha_hora: string; resultado: string | null
        jornadas: { nombre: string }
      } | null
      const pp = p.polla_participants as unknown as { apodo: string } | null
      const acerto = m?.resultado && p.pick === m.resultado ? 'Sí' : (m?.resultado ? 'No' : '-')
      return [
        m?.jornadas?.nombre ?? '',
        m ? `${m.equipo_a} vs ${m.equipo_b}` : '',
        pp?.apodo ?? '',
        resultLabels[p.pick] ?? p.pick,
        m?.resultado ? (resultLabels[m.resultado] ?? m.resultado) : 'Sin resultado',
        acerto,
        p.is_default ? 'Sí' : 'No',
        p.submitted_at ? format(new Date(p.submitted_at), 'dd/MM/yyyy HH:mm') : '',
      ].join(',')
    })

    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `predicciones_${polla?.nombre ?? 'polla'}_${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyPollaId() {
    const code = polla?.invite_code ?? pollaId!
    navigator.clipboard.writeText(code)
    toast({ title: '¡Código copiado!', description: 'Compártelo con los participantes para que se unan.' })
  }

  async function handleRequestLimit() {
    try {
      await requestLimit.mutateAsync({
        pollaId: pollaId!,
        currentLimit: approvedLimit,
        requestedLimit: approvedLimit + 25,
      })
      toast({ title: 'Solicitud enviada', description: 'El administrador del sistema revisará tu solicitud.' })
      setLimitOpen(false)
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingPolla) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>
  }

  const validCsvCount = csvRows.filter(r => !r.error).length

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{polla?.nombre}</h1>
          <p className="text-xs text-muted-foreground">Panel de administración</p>
        </div>
      </div>

      {/* Código de invitación */}
      <Card className="bg-emerald-950/40 border-emerald-800/50">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-emerald-400 font-medium mb-2">Código de invitación para participantes</p>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-mono font-bold tracking-widest text-white flex-1 text-center bg-slate-900 rounded px-3 py-1.5">
              {polla?.invite_code ?? '—'}
            </code>
            <Button size="sm" onClick={copyPollaId} className="shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white">
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="participantes">
        <TabsList className="w-full">
          <TabsTrigger value="participantes" className="flex-1 text-xs">Participantes</TabsTrigger>
          <TabsTrigger value="partidos" className="flex-1 text-xs">Partidos</TabsTrigger>
          <TabsTrigger value="exportar" className="flex-1 text-xs">Exportar</TabsTrigger>
        </TabsList>

        {/* ===== PARTICIPANTES ===== */}
        <TabsContent value="participantes" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <Button
              size="sm" variant="ghost"
              className="text-xs text-muted-foreground -ml-2"
              onClick={() => refetchParticipants()}
              disabled={fetchingParticipants}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${fetchingParticipants ? 'animate-spin' : ''}`} />
              {fetchingParticipants ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                <strong className={authorizedCount >= approvedLimit ? 'text-red-600' : authorizedCount >= approvedLimit - 2 ? 'text-orange-600' : 'text-foreground'}>
                  {authorizedCount}
                </strong>
                {' / '}{approvedLimit} participantes autorizados
              </span>
            </div>
            {authorizedCount >= approvedLimit && limitRequest?.status !== 'pending' && limitRequest?.status !== 'approved' && (
              <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50">
                    <Plus className="h-3 w-3 mr-1" /> Más cupos
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Solicitar más participantes</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <p className="text-sm text-muted-foreground">
                      Tu polla ha alcanzado el límite de <strong>{approvedLimit} participantes</strong>.
                      Puedes solicitar ampliar el cupo en 25 participantes adicionales.
                    </p>
                    <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                      <p className="font-medium">Solicitud de expansión</p>
                      <p className="text-xs mt-1">
                        Límite actual: {approvedLimit} → Nuevo límite solicitado: {approvedLimit + 25}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El administrador del sistema revisará tu solicitud. Te informaremos cuando sea aprobada.
                    </p>
                    <Button className="w-full" onClick={handleRequestLimit} disabled={requestLimit.isPending}>
                      {requestLimit.isPending ? 'Enviando...' : 'Enviar solicitud'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {limitRequest?.status === 'pending' && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                <Clock className="inline h-3 w-3 mr-1" />Solicitud pendiente
              </span>
            )}
            {limitRequest?.status === 'approved' && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                <CheckCircle className="inline h-3 w-3 mr-1" />Límite ampliado
              </span>
            )}
          </div>

          {authorizedCount >= approvedLimit - 2 && authorizedCount < approvedLimit && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">Pronto llegarás al límite de {approvedLimit} participantes.</p>
            </div>
          )}

          {participants.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nadie se ha unido todavía. Comparte el código de invitación.
              </CardContent>
            </Card>
          ) : (
            participants.map(p => (
                <Card key={p.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.apodo}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.status === 'pending' ? 'Solicitud pendiente' : p.status === 'blocked' ? 'Bloqueado' : 'Autorizado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.status === 'pending' && (
                          <>
                            <Button
                              size="sm" variant="ghost"
                              className="text-green-700 hover:text-green-800 hover:bg-green-50 h-8 px-2"
                              onClick={() => updateStatus.mutate({ participantId: p.id, pollaId: pollaId!, status: 'authorized' })}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Aprobar
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="text-red-700 hover:text-red-800 hover:bg-red-50 h-8 px-2"
                              onClick={() => updateStatus.mutate({ participantId: p.id, pollaId: pollaId!, status: 'blocked' })}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Rechazar
                            </Button>
                          </>
                        )}
                        {p.status === 'authorized' && (
                          <Button
                            size="sm" variant="ghost"
                            className="text-red-700 hover:bg-red-50 h-8 px-2"
                            onClick={() => updateStatus.mutate({ participantId: p.id, pollaId: pollaId!, status: 'blocked' })}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Bloquear
                          </Button>
                        )}
                        {p.status === 'blocked' && (
                          <Button
                            size="sm" variant="ghost"
                            className="text-green-700 hover:bg-green-50 h-8 px-2"
                            onClick={() => updateStatus.mutate({ participantId: p.id, pollaId: pollaId!, status: 'authorized' })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Autorizar
                          </Button>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            p.status === 'authorized' ? 'border-green-300 text-green-700' :
                            p.status === 'blocked' ? 'border-red-300 text-red-700' :
                            'border-yellow-300 text-yellow-700'
                          }
                        >
                          {p.status === 'pending' ? <Clock className="h-3 w-3" /> :
                           p.status === 'authorized' ? <CheckCircle className="h-3 w-3" /> :
                           <XCircle className="h-3 w-3" />}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ))
          )}
        </TabsContent>

        {/* ===== PARTIDOS ===== */}
        <TabsContent value="partidos" className="space-y-4 mt-4">
          {/* Botones crear */}
          <div className="flex gap-2 flex-wrap">
            <Dialog open={jornadaOpen} onOpenChange={setJornadaOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1">
                  <Plus className="h-4 w-4 mr-1" /> Nueva jornada
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear jornada</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateJornada} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      placeholder="Jornada 1, Octavos de final..."
                      value={jornadaNombre}
                      onChange={e => setJornadaNombre(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Puntos por acierto</Label>
                    <Input
                      type="number" min={1} max={50}
                      value={jornadaPuntos}
                      onChange={e => setJornadaPuntos(Number(e.target.value))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Puntos que gana un participante por cada predicción correcta en esta fase.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={createJornada.isPending}>
                    Crear jornada
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={matchOpen} onOpenChange={setMatchOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-1 bg-blue-700 hover:bg-blue-800" disabled={jornadas.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo partido
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear partido</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateMatch} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Jornada</Label>
                    <Select value={matchJornadaId} onValueChange={setMatchJornadaId} required>
                      <SelectTrigger><SelectValue placeholder="Selecciona jornada" /></SelectTrigger>
                      <SelectContent>
                        {jornadas.map(j => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.nombre} <span className="text-muted-foreground text-xs">({j.puntos_por_acierto} pts)</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Equipo A</Label>
                      <Input placeholder="Colombia" value={matchEquipoA} onChange={e => setMatchEquipoA(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Equipo B</Label>
                      <Input placeholder="Brasil" value={matchEquipoB} onChange={e => setMatchEquipoB(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha y hora <span className="text-xs font-normal text-primary">(Hora Colombia — Bogotá, UTC-5)</span></Label>
                    <Input
                      type="datetime-local"
                      value={matchFechaHora}
                      onChange={e => setMatchFechaHora(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Introduce la hora tal como aparece en la programación oficial del torneo en Colombia.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Estadio (opcional)</Label>
                    <Input placeholder="MetLife Stadium" value={matchEstadio} onChange={e => setMatchEstadio(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMatch.isPending}>
                    Crear partido
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* CSV import */}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5 mr-1" /> Descargar plantilla CSV
            </Button>
            <Button
              size="sm" variant="ghost"
              className="text-xs text-muted-foreground"
              disabled={jornadas.length === 0}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Importar desde CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCSVFile}
            />
          </div>

          {jornadas.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Crea primero una jornada para agregar partidos.
              </CardContent>
            </Card>
          ) : (
            jornadas.map(jornada => {
              const jornadaMatches = matches.filter(m => m.jornada_id === jornada.id)
              const isEditingThis = editingJornadaId === jornada.id
              return (
                <div key={jornada.id} className="space-y-2">
                  {/* Jornada header con edición inline de puntos */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{jornada.nombre}</h3>
                    {isEditingThis ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min={1} max={50}
                          value={editingJornadaPuntos}
                          onChange={e => setEditingJornadaPuntos(Number(e.target.value))}
                          className="h-6 w-16 text-xs px-1.5"
                        />
                        <span className="text-xs text-muted-foreground">pts</span>
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 text-green-600 hover:text-green-700"
                          onClick={() => handleSaveJornadaPuntos(jornada.id)}
                          disabled={updateJornada.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => setEditingJornadaId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 group"
                        onClick={() => { setEditingJornadaId(jornada.id); setEditingJornadaPuntos(jornada.puntos_por_acierto) }}
                        title="Editar puntos por acierto"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {jornada.puntos_por_acierto} pts/acierto
                        </Badge>
                        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>

                  {jornadaMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-2">Sin partidos en esta jornada.</p>
                  ) : (
                    jornadaMatches.map(match => {
                      const isPast = new Date(match.fecha_hora) <= new Date(Date.now() - 60_000)
                      return (
                        <Card key={match.id} className="text-sm">
                          <CardContent className="py-3 px-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{match.equipo_a} <span className="text-muted-foreground">vs</span> {match.equipo_b}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => {
                                    setEditMatch(match)
                                    setEditFechaHoraBogota(utcToBogotaInput(match.fecha_hora))
                                    setEditOpen(true)
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteMatch(match.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatBogota(match.fecha_hora)}</span>
                              {match.estadio && <span>{match.estadio}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm" variant={match.is_unlocked ? 'default' : 'outline'}
                                className={`h-7 text-xs ${match.is_unlocked ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                disabled={isPast}
                                onClick={() => toggleUnlock(match)}
                              >
                                {match.is_unlocked
                                  ? <><Unlock className="h-3 w-3 mr-1" />Abierto</>
                                  : <><Lock className="h-3 w-3 mr-1" />Cerrado</>}
                              </Button>
                              {match.resultado && (
                                <Badge variant="outline" className="text-xs">
                                  Resultado: {resultLabels[match.resultado]}
                                </Badge>
                              )}
                              {isPast && !match.resultado && (
                                <span className="text-xs text-orange-600">Partido pasado — falta resultado</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              )
            })
          )}
        </TabsContent>

        {/* ===== EXPORTAR ===== */}
        <TabsContent value="exportar" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descargar predicciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full" variant="outline"
                onClick={() => downloadCSV()}
                disabled={!predictionsExport || predictionsExport.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Todas las predicciones (CSV)
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Por jornada:</p>
                {jornadas.map(j => (
                  <Button key={j.id} className="w-full" variant="outline" size="sm" onClick={() => downloadCSV(j.id)}>
                    <Download className="h-3.5 w-3.5 mr-2" />
                    {j.nombre}
                  </Button>
                ))}
                {jornadas.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay jornadas creadas.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit match dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar partido</DialogTitle></DialogHeader>
          {editMatch && (
            <form onSubmit={handleUpdateMatch} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Equipo A</Label>
                  <Input
                    value={editMatch.equipo_a}
                    onChange={e => setEditMatch({ ...editMatch, equipo_a: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equipo B</Label>
                  <Input
                    value={editMatch.equipo_b}
                    onChange={e => setEditMatch({ ...editMatch, equipo_b: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora <span className="text-xs font-normal text-primary">(Hora Colombia — Bogotá, UTC-5)</span></Label>
                <Input
                  type="datetime-local"
                  value={editFechaHoraBogota}
                  onChange={e => setEditFechaHoraBogota(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Estadio</Label>
                <Input
                  value={editMatch.estadio ?? ''}
                  onChange={e => setEditMatch({ ...editMatch, estadio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select
                  value={editMatch.resultado ?? ''}
                  onValueChange={v => setEditMatch({ ...editMatch, resultado: (v || null) as MatchResult })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin resultado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin resultado</SelectItem>
                    <SelectItem value="A_wins">Gana {editMatch.equipo_a}</SelectItem>
                    <SelectItem value="draw">Empate</SelectItem>
                    <SelectItem value="B_wins">Gana {editMatch.equipo_b}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={updateMatch.isPending}>
                Guardar cambios
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV preview dialog */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vista previa — Importar partidos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 mt-2">
            {csvRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No se encontraron filas válidas en el archivo.</p>
            ) : (
              csvRows.map((row, i) => (
                <div
                  key={i}
                  className={`text-xs rounded-lg px-3 py-2 border ${row.error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-muted border-border'}`}
                >
                  {row.error ? (
                    <span><strong>Fila {i + 1} — Error:</strong> {row.error} &nbsp;|&nbsp; {row.jornada} | {row.equipo_a} vs {row.equipo_b} | {row.fecha} {row.hora}</span>
                  ) : (
                    <span>
                      <strong className="text-green-400">✓</strong> &nbsp;
                      <strong>{row.jornada}</strong> — {row.equipo_a} vs {row.equipo_b} — {row.fecha} {row.hora} Col{row.estadio ? ` — ${row.estadio}` : ''}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="pt-4 border-t space-y-2">
            {validCsvCount > 0 && csvRows.some(r => r.error) && (
              <p className="text-xs text-yellow-500">
                {csvRows.filter(r => r.error).length} fila(s) con errores serán ignoradas.
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleCSVImport}
              disabled={validCsvCount === 0 || csvImporting}
            >
              {csvImporting ? 'Importando...' : `Importar ${validCsvCount} partido(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
