import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Shield } from 'lucide-react'

const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL

export default function SuperAdminLogin() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Si ya está logueado como superadmin, redirigir directo
  if (user && SUPERADMIN_EMAIL && user.email === SUPERADMIN_EMAIL) {
    navigate('/superadmin', { replace: true })
    return null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (email.trim().toLowerCase() !== SUPERADMIN_EMAIL) {
      toast({
        title: 'Acceso denegado',
        description: 'Este panel es exclusivo del administrador del sistema.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)

    if (error) {
      toast({ title: 'Contraseña incorrecta', description: error.message, variant: 'destructive' })
      return
    }

    navigate('/superadmin', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/30 mb-4">
            <Shield className="h-8 w-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Panel del sistema</h1>
          <p className="text-purple-300 text-sm mt-1">Acceso restringido</p>
        </div>

        <Card className="border-purple-800/50 bg-slate-900/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Ingresar</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Solo el administrador del sistema puede acceder aquí.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Correo</Label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  required
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
                className="w-full bg-purple-700 hover:bg-purple-600 text-white"
                disabled={loading}
              >
                {loading ? 'Verificando...' : 'Ingresar al panel'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
