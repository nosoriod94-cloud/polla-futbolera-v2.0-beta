import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useAllLicenses, useGrantLicense, useAllPollas, useToggleLicenseActive } from '@/hooks/usePollas'
import { usePendingLimitRequests, useResolveLimitRequest } from '@/hooks/useParticipants'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Plus, CheckCircle, Shield, LogOut, ToggleLeft, ToggleRight, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL

export default function SuperAdmin() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [clientEmail, setClientEmail] = useState('')
  const [showPollas, setShowPollas] = useState(false)

  const { data: licenses = [], isLoading: loadingLicenses } = useAllLicenses()
  const { data: allPollas = [], isLoading: loadingPollas } = useAllPollas()
  const { data: pendingRequests = [] } = usePendingLimitRequests()
  const grantLicense = useGrantLicense()
  const toggleActive = useToggleLicenseActive()
  const resolveRequest = useResolveLimitRequest()

  // Bloquear si no es superadmin (la protección real está en las RPCs de Supabase)
  if (!user || !SUPERADMIN_EMAIL || user.email !== SUPERADMIN_EMAIL) {
    navigate('/superadmin/login', { replace: true })
    return null
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!clientEmail.trim()) return
    try {
      await grantLicense.mutateAsync(clientEmail.trim().toLowerCase())
      toast({
        title: 'Licencia otorgada',
        description: `${clientEmail.trim()} ya puede crear hasta 3 pollas.`,
      })
      setClientEmail('')
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function handleToggle(email: string, currentActive: boolean) {
    try {
      await toggleActive.mutateAsync({ email, active: !currentActive })
      toast({
        title: currentActive ? 'Cuenta suspendida' : 'Cuenta reactivada',
        description: `${email} ${currentActive ? 'ya no puede acceder' : 'puede acceder nuevamente'}.`,
      })
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  async function handleResolve(requestId: string, status: 'approved' | 'rejected') {
    try {
      await resolveRequest.mutateAsync({ requestId, status })
      toast({
        title: status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada',
        description: status === 'approved' ? 'El admin ya puede agregar más participantes.' : 'La solicitud fue rechazada.',
      })
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const active = licenses.filter(l => l.is_active)
  const suspended = licenses.filter(l => !l.is_active)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" /> Panel del sistema
          </h1>
          <p className="text-xs text-slate-400">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { signOut(); navigate('/superadmin/login') }}
          className="text-slate-400 hover:text-white"
        >
          <LogOut className="h-4 w-4 mr-1" /> Salir
        </Button>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-blue-400">{allPollas.length}</p>
              <p className="text-xs text-slate-400">Pollas</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-green-400">{active.length}</p>
              <p className="text-xs text-slate-400">Activas</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-red-400">{suspended.length}</p>
              <p className="text-xs text-slate-400">Suspen.</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-orange-400">{pendingRequests.length}</p>
              <p className="text-xs text-slate-400">Solicit.</p>
            </CardContent>
          </Card>
        </div>

        {/* Solicitudes de expansión pendientes */}
        {pendingRequests.length > 0 && (
          <section>
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" /> Solicitudes de cupos pendientes
            </h2>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <Card key={req.id} className="bg-slate-900 border-orange-900/60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{req.polla_nombre}</p>
                        <p className="text-xs text-slate-400 truncate">{req.admin_email}</p>
                        <p className="text-xs text-orange-400 mt-0.5">
                          {req.current_limit} → {req.requested_limit} participantes
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-700 hover:bg-green-600 h-8 text-xs"
                        onClick={() => handleResolve(req.id, 'approved')}
                        disabled={resolveRequest.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-red-800 text-red-400 hover:bg-red-950 h-8 text-xs"
                        onClick={() => handleResolve(req.id, 'rejected')}
                        disabled={resolveRequest.isPending}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Otorgar licencia */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-purple-400" /> Otorgar licencia a cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGrant} className="space-y-3">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Correo del cliente</Label>
                <Input
                  type="email"
                  placeholder="cliente@empresa.com"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  required
                />
                <p className="text-xs text-slate-500">
                  El cliente debe registrarse con exactamente este correo. Recibirá 3 pollas.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-600"
                disabled={grantLicense.isPending}
              >
                {grantLicense.isPending ? 'Otorgando...' : 'Otorgar licencia (3 pollas)'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de licencias */}
        <section>
          <h2 className="font-semibold text-white mb-3">Cuentas de clientes</h2>
          {loadingLicenses ? (
            <p className="text-sm text-slate-400 text-center py-4">Cargando...</p>
          ) : licenses.length === 0 ? (
            <Card className="border-dashed border-slate-700 bg-transparent">
              <CardContent className="py-8 text-center text-slate-500 text-sm">
                No hay licencias otorgadas aún.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {licenses.map(l => (
                <Card
                  key={l.id}
                  className={`border ${l.is_active ? 'bg-slate-900 border-slate-800' : 'bg-red-950/20 border-red-900/50'}`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${l.is_active ? 'text-white' : 'text-red-300 line-through'}`}>
                          {l.email_autorizado}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {l.pollas_created}/{l.pollas_limit} pollas · Desde {format(new Date(l.created_at), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!l.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium">
                            Suspendida
                          </span>
                        )}
                        <button
                          onClick={() => handleToggle(l.email_autorizado, l.is_active)}
                          disabled={toggleActive.isPending}
                          className="text-slate-400 hover:text-white transition-colors"
                          title={l.is_active ? 'Suspender cuenta' : 'Reactivar cuenta'}
                        >
                          {l.is_active
                            ? <ToggleRight className="h-7 w-7 text-green-400" />
                            : <ToggleLeft className="h-7 w-7 text-red-400" />
                          }
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Todas las pollas (colapsable) */}
        <section>
          <button
            className="w-full flex items-center justify-between font-semibold text-white mb-2"
            onClick={() => setShowPollas(v => !v)}
          >
            <span>Pollas del sistema ({allPollas.length})</span>
            {showPollas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showPollas && (
            loadingPollas ? (
              <p className="text-sm text-slate-400 text-center py-4">Cargando...</p>
            ) : allPollas.length === 0 ? (
              <Card className="border-dashed border-slate-700 bg-transparent">
                <CardContent className="py-8 text-center text-slate-500 text-sm">
                  No hay pollas creadas aún.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {allPollas.map(polla => (
                  <Card key={polla.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-white">{polla.nombre}</p>
                          <p className="text-xs text-slate-500">
                            Código: <code className="font-mono text-slate-400">{polla.invite_code ?? '—'}</code>
                            {' · '}{format(new Date(polla.created_at), "d MMM yyyy", { locale: es })}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${polla.is_active ? 'bg-green-900/50 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                          {polla.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  )
}
