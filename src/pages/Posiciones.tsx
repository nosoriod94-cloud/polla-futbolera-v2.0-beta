import { useParams } from 'react-router-dom'
import { useStandings } from '@/hooks/useStandings'
import { useMyParticipant } from '@/hooks/useParticipants'
import { cn } from '@/lib/utils'
import { Trophy, Star } from 'lucide-react'

const medalColors = [
  'bg-amber-400/20 border-amber-400 text-amber-300',   // 🥇
  'bg-slate-400/20 border-slate-400 text-slate-300',   // 🥈
  'bg-orange-400/20 border-orange-400 text-orange-300', // 🥉
]
const medals = ['🥇', '🥈', '🥉']

export default function Posiciones() {
  const { pollaId } = useParams<{ pollaId: string }>()
  const { data: standings = [], isLoading } = useStandings(pollaId)
  const { data: myParticipant } = useMyParticipant(pollaId)

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Cargando tabla...</div>
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="pt-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Posiciones</h1>
          <p className="text-xs text-muted-foreground">Actualiza cada 30 s</p>
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground text-sm">
          Aún no hay puntos registrados.
        </div>
      ) : (
        <div className="space-y-2">
          {standings.map((row, idx) => {
            const isMe = row.user_id === myParticipant?.user_id
            const isTop3 = idx < 3

            return (
              <div
                key={row.participant_id}
                className={cn(
                  'rounded-xl border-2 px-4 py-3 flex items-center gap-3 transition-all',
                  isMe
                    ? 'border-sky-400 bg-sky-500/10 shadow-md shadow-sky-500/10'
                    : isTop3
                    ? medalColors[idx]
                    : 'border-border bg-card',
                )}
              >
                {/* Rank */}
                <div className="w-9 shrink-0 text-center">
                  {isTop3
                    ? <span className="text-2xl leading-none">{medals[idx]}</span>
                    : <span className="text-base font-bold text-muted-foreground">#{idx + 1}</span>
                  }
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm truncate">{row.apodo}</span>
                    {isMe && (
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-sky-400 bg-sky-500/15 border border-sky-400/30 px-1.5 py-0.5 rounded-full shrink-0">
                        <Star className="h-3 w-3 fill-sky-400" /> Tú
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.aciertos}/{row.total_predicciones} aciertos
                    {row.predicciones_default > 0 && ` · ${row.predicciones_default} por defecto`}
                  </p>
                </div>

                {/* Points */}
                <div className="shrink-0 text-right">
                  <span className={cn(
                    'text-2xl font-extrabold leading-none',
                    isMe ? 'text-sky-400' : isTop3 ? 'text-foreground' : 'text-primary'
                  )}>
                    {row.puntos_totales}
                  </span>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
