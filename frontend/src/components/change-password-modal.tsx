"use client"

import { FormEvent, useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { buildApiUrl } from "@/lib/utils"

type ChangePasswordModalProps = {
    token: string
    onSuccess: () => void
}

export function ChangePasswordModal({ token, onSuccess }: ChangePasswordModalProps) {
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const passwordsMatch = newPassword === confirmPassword
    const isValid = newPassword.length >= 8 && passwordsMatch

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!isValid) {
            setError("Las contraseñas no coinciden o son muy cortas (mínimo 8 caracteres)")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(buildApiUrl("/api/password/change"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    newPassword,
                }),
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({ message: "Error cambiando contraseña" }))
                throw new Error(body?.message || "Error cambiando contraseña")
            }

            onSuccess()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo cambiar la contraseña"
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-3">
                        <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold">Cambiar contraseña</h2>
                        <p className="text-sm text-muted-foreground">Es tu primer inicio de sesión</p>
                    </div>
                </div>

                <p className="mb-6 text-sm text-muted-foreground">
                    Por seguridad, debes establecer una nueva contraseña antes de continuar. Elige una que sea segura y fácil de recordar.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="new-password">Nueva contraseña</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                placeholder="Mínimo 8 caracteres"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {newPassword && newPassword.length < 8 && (
                            <p className="text-xs text-destructive">La contraseña debe tener al menos 8 caracteres</p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                        <div className="relative">
                            <Input
                                id="confirm-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repite la contraseña"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {confirmPassword && !passwordsMatch && (
                            <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={!isValid || loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Actualizando…
                            </>
                        ) : (
                            "Cambiar contraseña"
                        )}
                    </Button>
                </form>

                <div className="mt-6 space-y-2 rounded-lg bg-muted/50 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Consejos para una contraseña segura:</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                        <li>✓ Al menos 8 caracteres</li>
                        <li>✓ Combina mayúsculas y minúsculas</li>
                        <li>✓ Incluye números y símbolos</li>
                        <li>✓ Evita palabras comunes o datos personales</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
