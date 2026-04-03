import { useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useJornadas, useMatches } from '@/hooks/useMatches'
import { useMyParticipant } from '@/hooks/useParticipants'
import { useMyPredictions, useUpsertPrediction } from '@/hooks/usePredictions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Lock, Clock, CheckCircle2 } from 'lucide-react'
import { format, isPast, addMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Pick } from '@/lib/database.types'

interface PredictionToggleProps {
  matchId: string
  pollaId: string
  participantId: string
  currentPick: Pick | undefined
  equipoA: string
  equipoB: string
  disabled: boolean
}

function PredictionToggle({ matchId, pollaId, participantId, currentPick, equipoA, equipoB, disabled }: PredictionToggleProps) {
  const upsert = useUpsertPrediction()
  const { toast } = useToast()

  async function pick(p: Pick) {
    if (disabled) return
    try {
      await upsert.mutateAsync({ pollaId, matchId, participantId, pick: p })
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const btnBase = 'flex-1 py-2.5 px-1 rounded-xl text-xs font-bold border-2 transition-all text-center cursor-pointer select-none'

  const options: { value: Pick; label: string; active: string; inactive: string }[] = [
    {
      value: 'A_wins',
      label: equipoA,
      active:   'border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105',
      inactive: 'border-border bg-muted text-foreground hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300',
    },
    {
      value: 'draw',
      label: 'Empate',
      active:   'border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105',
      inactive: 'border-border bg-muted text-foreground hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-300',
    },
    {
      value: 'B_wins',
      label: equipoB,
      active:   'border-sky-400 bg-sky-500 text-white shadow-lg shadow-sky-500/30 scale-105',
      inactive: 'border-border bg-muted text-foreground hover:border-sky-400 hover:bg-sky-500/10 hover:text-sky-300',
    },
  ]

  return (
    <div className={cn('flex gap-2 mt-3', disabled && 'opacity-60 pointer-events-none')}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={cn(btnBase, currentPick === opt.value ? opt.active : opt.inactive)}
          onClick={() => pick(opt.value)}
          disabled={disabled || upsert.isPending}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Predicciones() {
  const { pollaId } = useParams<{ pollaId: string }>()
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: participant } = useMyParticipant(pollaId)
  const { data: jornadas = [] } = useJornadas(pollaId)
  const { data: matches = [] } = useMatches(pollaId)
  const { data: myPredictions = {} } = useMyPredictions(pollaId, participant?.id)

  if (!participant) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No estás registrado en esta polla.</p>
      </div>
    )
  }

  if (participant.status === 'pending') {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-400 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-400" />
        </div>
        <h2 className="font-bold text-lg">Solicitud pendiente</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          El admin debe aprobar tu solicitud antes de que puedas hacer predicciones.
        </p>
      </div>
    )
  }

  if (participant.status === 'blocked') {
    return (
      <div className="p-8 text-center text-destructive">
        <p className="font-semibold">Tu acceso a esta polla ha sido bloqueado.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="pt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mis predicciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Jugando como <span className="text-primary font-semibold">{participant.apodo}</span>
          </p>
        </div>
      </div>

      {jornadas.length === 0 && (
        <Card className="border-dashed border-border">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            El admin no ha creado partidos todavía.
          </CardContent>
        </Card>
      )}

      {jornadas.map(jornada => {
        const jornadaMatches = matches.filter(m => m.jornada_id === jornada.id)
        const unlocked = jornadaMatches.filter(m => m.is_unlocked)
        if (unlocked.length === 0) return null

        return (
          <section key={jornada.id} className="space-y-3">
            {/* Jornada header */}
            <div className="flex items-center gap-2 px-1">
              <h2 className="font-bold text-base">{jornada.nombre}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {jornada.puntos_por_acierto} pts por acierto
              </span>
            </div>

            {unlocked.map(match => {
              const kickoff = new Date(match.fecha_hora)
              const cutoff = addMinutes(kickoff, -1)
              const isLocked = isPast(cutoff)
              const myPick = myPredictions[match.id]?.pick
              const isCorrect = myPick && match.resultado && myPick === match.resultado

              return (
                <Card
                  key={match.id}
                  className={cn(
                    'border overflow-hidden transition-all',
                    isLocked
                      ? 'border-border/60 opacity-80'
                      : 'border-border hover:border-primary/40',
                    isCorrect && 'border-emerald-500/50'
                  )}
                >
                  {/* Top color stripe */}
                  <div className={cn(
                    'h-1',
                    isLocked ? 'bg-muted' : 'bg-gradient-to-r from-primary/60 to-secondary/60'
                  )} />

                  <CardContent className="py-3 px-4 space-y-2">
                    {/* Teams + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        {match.equipo_a}
                        <span className="text-muted-foreground font-normal mx-1.5">vs</span>
                        {match.equipo_b}
                      </span>
                      {isLocked ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                          <Lock className="h-3 w-3" /> Cerrado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                          Abierto
                        </span>
                      )}
                    </div>

                    {/* Date/time */}
                    <p className="text-xs text-muted-foreground">
                      {format(kickoff, "d MMM yyyy, HH:mm", { locale: es })}
                      {match.estadio && <> · {match.estadio}</>}
                    </p>

                    {/* Prediction buttons */}
                    <PredictionToggle
                      matchId={match.id}
                      pollaId={pollaId!}
                      participantId={participant.id}
                      currentPick={myPick}
                      equipoA={match.equipo_a}
                      equipoB={match.equipo_b}
                      disabled={isLocked}
                    />

                    {/* Warnings & result */}
                    {isLocked && !myPick && (
                      <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5 mt-1">
                        No predijiste — quedaste con Empate por defecto.
                      </p>
                    )}

                    {myPick && myPredictions[match.id]?.is_default && (
                      <p className="text-xs text-amber-400 mt-1">Empate asignado automáticamente.</p>
                    )}

                    {match.resultado && (
                      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border/60">
                        <span className="text-xs text-muted-foreground">Resultado:</span>
                        <span className="text-xs font-bold text-foreground">
                          {match.resultado === 'A_wins' ? match.equipo_a :
                           match.resultado === 'B_wins' ? match.equipo_b : 'Empate'}
                        </span>
                        {myPick && (
                          <span className={cn(
                            'ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
                            myPick === match.resultado
                              ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                              : 'text-muted-foreground bg-muted'
                          )}>
                            {myPick === match.resultado
                              ? <><CheckCircle2 className="h-3 w-3" /> +{jornada.puntos_por_acierto} pts</>
                              : '0 pts'}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
