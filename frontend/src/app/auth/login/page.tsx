"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2, LogIn, UserPlus, KeyRound, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"

export default function LoginPage() {
    const router = useRouter()
    const { login, status, isAuthenticated } = useAuth()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Registro
    const [registerOpen, setRegisterOpen] = useState(false)
    const [regNombre, setRegNombre] = useState("")
    const [regApellidos, setRegApellidos] = useState("")
    const [regEmail, setRegEmail] = useState("")
    const [regTelefono, setRegTelefono] = useState("")
    const [regOrganizacion, setRegOrganizacion] = useState("")
    const [regCargo, setRegCargo] = useState("")
    const [regLoading, setRegLoading] = useState(false)
    const [regError, setRegError] = useState<string | null>(null)
    const [regSuccess, setRegSuccess] = useState(false)

    // Recuperar contraseña
    const [forgotOpen, setForgotOpen] = useState(false)
    const [forgotEmail, setForgotEmail] = useState("")
    const [forgotLoading, setForgotLoading] = useState(false)
    const [forgotError, setForgotError] = useState<string | null>(null)
    const [forgotSuccess, setForgotSuccess] = useState(false)

    useEffect(() => {
        if (isAuthenticated) {
            router.replace("/")
        }
    }, [isAuthenticated, router])

    // ── Login ──────────────────────────────────────
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSubmitting(true)
        setError(null)

        const result = await login({ email, password })

        if (!result.success) {
            setError(result.error || "Credenciales inválidas")
            setIsSubmitting(false)
            return
        }

        setIsSubmitting(false)
        router.replace("/")
    }

    // ── Registro ───────────────────────────────────
    const handleRegister = async (e: FormEvent) => {
        e.preventDefault()
        setRegLoading(true)
        setRegError(null)

        try {
            const res = await fetch(buildApiUrl("/api/auth/register"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: regNombre.trim(),
                    apellidos: regApellidos.trim(),
                    email: regEmail.trim().toLowerCase(),
                    telefono: regTelefono.trim() || undefined,
                    organizacion: regOrganizacion.trim() || undefined,
                    cargo: regCargo.trim() || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setRegError(data.message || "Error al crear la cuenta")
            } else {
                setRegSuccess(true)
            }
        } catch {
            setRegError("Error de conexión. Inténtalo de nuevo.")
        } finally {
            setRegLoading(false)
        }
    }

    const resetRegisterForm = () => {
        setRegNombre("")
        setRegApellidos("")
        setRegEmail("")
        setRegTelefono("")
        setRegOrganizacion("")
        setRegCargo("")
        setRegError(null)
        setRegSuccess(false)
    }

    // ── Recuperar contraseña ──────────────────────
    const handleForgotPassword = async (e: FormEvent) => {
        e.preventDefault()
        setForgotLoading(true)
        setForgotError(null)

        try {
            const res = await fetch(buildApiUrl("/api/auth/forgot-password"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
            })

            const data = await res.json()

            if (!res.ok) {
                setForgotError(data.message || "Error al procesar la solicitud")
            } else {
                setForgotSuccess(true)
            }
        } catch {
            setForgotError("Error de conexión. Inténtalo de nuevo.")
        } finally {
            setForgotLoading(false)
        }
    }

    const resetForgotForm = () => {
        setForgotEmail("")
        setForgotError(null)
        setForgotSuccess(false)
    }

    const isLoading = isSubmitting || status === "loading"

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
            {/* ── Logotipo RPJ ── */}
            <div className="mb-6 flex flex-col items-center gap-3">
                <Image
                    src="/LogotipoRPJ.png"
                    alt="Logotipo Red Pastoral Juvenil"
                    width={220}
                    height={80}
                    priority
                    className="h-auto w-[220px]"
                />
                <p className="text-center text-lg font-medium text-foreground">
                    Asistente de IA de Pastoral Juvenil RPJ
                </p>
            </div>

            {/* ── Tarjeta de login ── */}
            <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-background p-8 shadow-lg">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">Accede a tu cuenta</h1>
                    <p className="text-sm text-muted-foreground">
                        Introduce tus credenciales para continuar
                    </p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="nombre@ejemplo.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                Verificando...
                            </>
                        ) : (
                            <>
                                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                                Iniciar sesión
                            </>
                        )}
                    </Button>
                </form>

                {/* ── Links dentro de la tarjeta ── */}
                <div className="flex items-center justify-between text-sm">
                    <button
                        type="button"
                        onClick={() => { resetForgotForm(); setForgotOpen(true) }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ¿Olvidaste tu contraseña?
                    </button>
                    <button
                        type="button"
                        onClick={() => { resetRegisterForm(); setRegisterOpen(true) }}
                        className="font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        Crea tu cuenta
                    </button>
                </div>
            </div>

            {/* ── Contacto fuera de la tarjeta ── */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
                Contacto:{" "}
                <a
                    href="mailto:redpj@rpj.es"
                    className="underline hover:text-foreground transition-colors"
                >
                    redpj@rpj.es
                </a>
            </p>

            {/* ══════════════════════════════════════
                  Diálogo de Registro
               ══════════════════════════════════════ */}
            <Dialog open={registerOpen} onOpenChange={(open) => { setRegisterOpen(open); if (!open) resetRegisterForm() }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            Crea tu cuenta en ia.rpj.es
                        </DialogTitle>
                        <DialogDescription>
                            Rellena los datos y recibirás tu contraseña por correo electrónico.
                        </DialogDescription>
                    </DialogHeader>

                    {regSuccess ? (
                        <div className="space-y-4 py-4 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                                <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">¡Cuenta creada!</p>
                                <p className="text-sm text-muted-foreground">
                                    Revisa tu correo electrónico para obtener tu contraseña de acceso.
                                </p>
                            </div>
                            <Button variant="outline" className="mt-2" onClick={() => setRegisterOpen(false)}>
                                Cerrar
                            </Button>
                        </div>
                    ) : (
                        <form className="space-y-4 pt-2" onSubmit={handleRegister}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="reg-nombre">Nombre *</Label>
                                    <Input
                                        id="reg-nombre"
                                        value={regNombre}
                                        onChange={(e) => setRegNombre(e.target.value)}
                                        required
                                        placeholder="Tu nombre"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-apellidos">Apellidos *</Label>
                                    <Input
                                        id="reg-apellidos"
                                        value={regApellidos}
                                        onChange={(e) => setRegApellidos(e.target.value)}
                                        required
                                        placeholder="Tus apellidos"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reg-email">Correo electrónico *</Label>
                                <Input
                                    id="reg-email"
                                    type="email"
                                    value={regEmail}
                                    onChange={(e) => setRegEmail(e.target.value)}
                                    required
                                    placeholder="nombre@ejemplo.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reg-telefono">Teléfono</Label>
                                <Input
                                    id="reg-telefono"
                                    type="tel"
                                    value={regTelefono}
                                    onChange={(e) => setRegTelefono(e.target.value)}
                                    placeholder="Opcional"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="reg-organizacion">Organización</Label>
                                    <Input
                                        id="reg-organizacion"
                                        value={regOrganizacion}
                                        onChange={(e) => setRegOrganizacion(e.target.value)}
                                        placeholder="Opcional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-cargo">Cargo</Label>
                                    <Input
                                        id="reg-cargo"
                                        value={regCargo}
                                        onChange={(e) => setRegCargo(e.target.value)}
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            {regError && (
                                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {regError}
                                </p>
                            )}

                            <Button type="submit" className="w-full" disabled={regLoading}>
                                {regLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creando cuenta...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Crear cuenta
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════
                  Diálogo de Recuperar contraseña
               ══════════════════════════════════════ */}
            <Dialog open={forgotOpen} onOpenChange={(open) => { setForgotOpen(open); if (!open) resetForgotForm() }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5" />
                            Recuperar contraseña
                        </DialogTitle>
                        <DialogDescription>
                            Introduce tu correo y recibirás una nueva contraseña temporal.
                        </DialogDescription>
                    </DialogHeader>

                    {forgotSuccess ? (
                        <div className="space-y-4 py-4 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">Correo enviado</p>
                                <p className="text-sm text-muted-foreground">
                                    Si el correo está registrado, recibirás un email con tu nueva contraseña.
                                </p>
                            </div>
                            <Button variant="outline" className="mt-2" onClick={() => setForgotOpen(false)}>
                                Cerrar
                            </Button>
                        </div>
                    ) : (
                        <form className="space-y-4 pt-2" onSubmit={handleForgotPassword}>
                            <div className="space-y-2">
                                <Label htmlFor="forgot-email">Correo electrónico</Label>
                                <Input
                                    id="forgot-email"
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    required
                                    placeholder="nombre@ejemplo.com"
                                />
                            </div>

                            {forgotError && (
                                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {forgotError}
                                </p>
                            )}

                            <Button type="submit" className="w-full" disabled={forgotLoading}>
                                {forgotLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <KeyRound className="mr-2 h-4 w-4" />
                                        Enviar nueva contraseña
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
