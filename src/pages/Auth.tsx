import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form
  const [regNombre, setRegNombre] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(loginEmail, loginPassword)
    setLoading(false)
    if (error) {
      toast({ title: 'Error al ingresar', description: error.message, variant: 'destructive' })
    } else {
      navigate('/')
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (regNombre.trim().length < 2) {
      toast({ title: 'Ingresa tu nombre completo', variant: 'destructive' })
      return
    }
    if (regPassword.length < 8) {
      toast({ title: 'Contraseña muy corta', description: 'Debe tener al menos 8 caracteres.', variant: 'destructive' })
      return
    }
    if (!/(?=.*[A-Z])/.test(regPassword) || !/(?=.*[0-9])/.test(regPassword)) {
      toast({ title: 'Contraseña débil', description: 'Debe incluir al menos una mayúscula y un número.', variant: 'destructive' })
      return
    }
    if (regPassword !== regPasswordConfirm) {
      toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await signUp(regEmail, regPassword, regNombre.trim())
    setLoading(false)
    if (error) {
      toast({ title: 'Error al registrarse', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Cuenta creada', description: 'Revisa tu correo para confirmar tu cuenta.' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-red-700 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">⚽</div>
          <h1 className="text-3xl font-bold text-white">Polla Mundialista</h1>
          <p className="text-blue-200 mt-1">FIFA 2026</p>
        </div>

        <Card className="shadow-2xl">
          <Tabs defaultValue="login">
            <CardHeader>
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Ingresar</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">Registrarse</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Correo electrónico</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="tu@correo.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={loading}>
                    {loading ? 'Ingresando...' : 'Ingresar'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-nombre">Nombre completo</Label>
                    <Input
                      id="reg-nombre"
                      type="text"
                      placeholder="Juan Pérez"
                      value={regNombre}
                      onChange={e => setRegNombre(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Correo electrónico</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="tu@correo.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Contraseña</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres, 1 mayúscula y 1 número"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password-confirm">Confirmar contraseña</Label>
                    <Input
                      id="reg-password-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={regPasswordConfirm}
                      onChange={e => setRegPasswordConfirm(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
                    {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
