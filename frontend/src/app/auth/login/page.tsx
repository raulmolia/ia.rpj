"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"

export default function LoginPage() {
    const router = useRouter()
    const { login, status, isAuthenticated } = useAuth()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isAuthenticated) {
            router.replace("/")
        }
    }, [isAuthenticated, router])

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

    const isLoading = isSubmitting || status === "loading"

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
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

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <Link href="#" className="hover:text-foreground">
                        ¿Olvidaste tu contraseña?
                    </Link>
                    <span className="text-xs">Contacto: soporte@rpjia.com</span>
                </div>
            </div>
        </div>
    )
}
