import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Briefcase } from 'lucide-react'

export default function ClientAdminLogin() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Si ya está logueado, redirigir directo al panel
  if (user) {
    navigate('/client-admin', { replace: true })
    return null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)

    if (error) {
      toast({ title: 'Error al ingresar', description: error.message, variant: 'destructive' })
      return
    }

    navigate('/client-admin', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500/30 mb-4">
            <Briefcase className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Panel Cliente Admin</h1>
          <p className="text-emerald-300 text-sm mt-1">Polla Futbolera</p>
        </div>

        <Card className="border-emerald-800/50 bg-slate-900/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Ingresar</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Accede con el correo asociado a tu licencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Correo electrónico</Label>
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Contraseña</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white"
                disabled={loading}
              >
                {loading ? 'Ingresando...' : 'Ingresar al panel'}
              </Button>
            </form>
            <p className="text-center text-xs text-slate-500 mt-4">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => navigate('/client-admin/register')}
                className="text-emerald-400 hover:underline"
              >
                Regístrate con tu código de licencia
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
