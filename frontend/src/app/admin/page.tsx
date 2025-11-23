"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { buildApiUrl } from "@/lib/utils"
const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMINISTRADOR"])

const ROLE_PRIORITY: Record<string, number> = {
    SUPERADMIN: 4,
    ADMINISTRADOR: 3,
    DOCUMENTADOR: 2,
    DOCUMENTADOR_JUNIOR: 2,
    USUARIO: 1,
}

const ROLE_OPTIONS = [
    { value: "SUPERADMIN", label: "Superadmin" },
    { value: "ADMINISTRADOR", label: "Administrador" },
    { value: "DOCUMENTADOR", label: "Documentador" },
    { value: "DOCUMENTADOR_JUNIOR", label: "Documentador Junior" },
    { value: "USUARIO", label: "Usuario" },
]

type ManagedUser = {
    id: string
    email: string
    nombre: string
    apellidos?: string | null
    rol: string
    activo: boolean
    fechaCreacion?: string
    organizacion?: string | null
    cargo?: string | null
}

type UserFormState = {
    nombre: string
    apellidos: string
    email: string
    password: string
    rol: string
    telefono: string
    organizacion: string
    cargo: string
    experiencia: string
    generarPassword: boolean
    enviarEmail: boolean
}

const INITIAL_FORM_STATE: UserFormState = {
    nombre: "",
    apellidos: "",
    email: "",
    password: "",
    rol: "USUARIO",
    telefono: "",
    organizacion: "",
    cargo: "",
    experiencia: "",
    generarPassword: true,
    enviarEmail: true,
}

export default function AdminPage() {
    const router = useRouter()
    const { status, isAuthenticated, user, token } = useAuth()

    const [users, setUsers] = useState<ManagedUser[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [creatingUser, setCreatingUser] = useState(false)
    const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [formState, setFormState] = useState<UserFormState>(INITIAL_FORM_STATE)

    const canAccess = useMemo(
        () => Boolean(isAuthenticated && user && ALLOWED_ROLES.has(user.rol ?? "")),
        [isAuthenticated, user],
    )

    const currentPriority = useMemo(() => (user?.rol ? ROLE_PRIORITY[user.rol] ?? 0 : 0), [user?.rol])

    const availableRoleOptions = useMemo(
        () => ROLE_OPTIONS.filter((option) => currentPriority >= (ROLE_PRIORITY[option.value] ?? 0)),
        [currentPriority],
    )

    const fetchUsers = useCallback(async () => {
        if (!token) {
            return
        }

        setLoadingUsers(true)
        setError(null)

        try {
            const response = await fetch(buildApiUrl("/api/auth/users"), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            })

            const data = await response.json().catch(() => null)

            if (!response.ok) {
                const message = data?.message || "No se pudieron cargar los usuarios"
                throw new Error(message)
            }

            setUsers(Array.isArray(data?.users) ? data.users : [])
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudieron cargar los usuarios"
            setError(message)
        } finally {
            setLoadingUsers(false)
        }
    }, [token])

    useEffect(() => {
        if (status === "loading") return
        if (!canAccess) {
            router.replace("/")
        }
    }, [canAccess, router, status])

    useEffect(() => {
        if (!canAccess || !token) {
            return
        }

        fetchUsers()
    }, [canAccess, fetchUsers, token])

    useEffect(() => {
        if (!feedback) return

        const timer = setTimeout(() => setFeedback(null), 3200)
        return () => clearTimeout(timer)
    }, [feedback])

    const handleFormChange = (field: keyof UserFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { value } = event.target
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!token) return

        if (!formState.nombre.trim() || !formState.email.trim()) {
            setError("Nombre y email son obligatorios")
            return
        }

        // Si no se genera contraseña automática, es obligatoria
        if (!formState.generarPassword && !formState.password.trim()) {
            setError("Debes proporcionar una contraseña o activar la generación automática")
            return
        }

        setCreatingUser(true)
        setError(null)

        const payload: any = {
            nombre: formState.nombre.trim(),
            apellidos: formState.apellidos.trim() || null,
            email: formState.email.trim(),
            rol: formState.rol,
            telefono: formState.telefono.trim() || null,
            organizacion: formState.organizacion.trim() || null,
            cargo: formState.cargo.trim() || null,
            experiencia: formState.experiencia.trim() ? Number.parseInt(formState.experiencia, 10) : null,
            enviarEmail: formState.enviarEmail,
        }

        // Solo enviar password si no se genera automáticamente
        if (!formState.generarPassword && formState.password) {
            payload.password = formState.password
        }

        try {
            const response = await fetch(buildApiUrl("/api/auth/users"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })

            const body = await response.json().catch(() => ({ message: "Error creando usuario" }))

            if (!response.ok) {
                throw new Error(body?.message || "Error creando usuario")
            }

            // Mostrar mensaje especial si se envió email
            if (body.emailSent) {
                setFeedback("Usuario creado correctamente. Se ha enviado un email con las credenciales.")
            } else if (body.temporaryPassword) {
                setFeedback(`Usuario creado. Contraseña temporal: ${body.temporaryPassword} (guárdala, no se volverá a mostrar)`)
            } else {
                setFeedback("Usuario creado correctamente")
            }

            setFormState(INITIAL_FORM_STATE)
            fetchUsers()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo crear el usuario"
            setError(message)
        } finally {
            setCreatingUser(false)
        }
    }

    const handleRoleChange = async (userId: string, currentRole: string, newRole: string) => {
        if (!token || currentRole === newRole) return
        setUpdatingRoleId(userId)
        setError(null)

        try {
            const response = await fetch(buildApiUrl(`/api/auth/users/${userId}/role`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rol: newRole }),
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({ message: "Error actualizando rol" }))
                throw new Error(body?.message || "Error actualizando rol")
            }

            setFeedback("Rol actualizado correctamente")
            fetchUsers()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo actualizar el rol"
            setError(message)
        } finally {
            setUpdatingRoleId(null)
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!token) return
        setDeletingUserId(userId)
        setError(null)

        try {
            const response = await fetch(buildApiUrl(`/api/auth/users/${userId}`), {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({ message: "Error eliminando usuario" }))
                throw new Error(body?.message || "Error eliminando usuario")
            }

            setFeedback("Usuario eliminado correctamente")
            fetchUsers()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo eliminar el usuario"
            setError(message)
        } finally {
            setDeletingUserId(null)
        }
    }

    if (status === "loading") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
                <ShieldCheck className="h-8 w-8 animate-pulse text-primary" />
                <p className="text-sm text-muted-foreground">Verificando permisos…</p>
            </div>
        )
    }

    if (!canAccess) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
                <div className="space-y-2">
                    <h1 className="text-xl font-semibold">No tienes permisos de administrador</h1>
                    <p className="text-sm text-muted-foreground">
                        Solicita acceso a un administrador para gestionar esta sección.
                    </p>
                </div>
                <Button onClick={() => router.replace("/")}>Volver al panel principal</Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                            Panel de administración
                        </div>
                        <h1 className="text-3xl font-semibold leading-tight">Gestión de usuarios</h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Crea perfiles para nuevos animadores, asigna roles y retira accesos cuando sea necesario. Todos los cambios se aplican de forma inmediata.
                        </p>
                        {feedback && <p className="text-sm text-primary" role="status">{feedback}</p>}
                        {error && <p className="text-sm text-destructive" role="status">{error}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggleButton />
                        <Button variant="outline" onClick={() => router.push("/")}>
                            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                            Volver al chat
                        </Button>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                        <header className="flex items-center gap-3">
                            <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
                            <h2 className="text-lg font-semibold">Nuevo usuario</h2>
                        </header>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Completa los datos principales. Podrás editar información adicional más adelante desde el perfil de cada usuario.
                        </p>

                        <form className="mt-5 space-y-4" onSubmit={handleCreateUser}>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-nombre">Nombre *</Label>
                                <Input id="admin-nombre" value={formState.nombre} onChange={handleFormChange("nombre")} required placeholder="Nombre" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-apellidos">Apellidos</Label>
                                <Input id="admin-apellidos" value={formState.apellidos} onChange={handleFormChange("apellidos")} placeholder="Apellidos" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-email">Email *</Label>
                                <Input id="admin-email" type="email" value={formState.email} onChange={handleFormChange("email")} required autoComplete="email" placeholder="nombre@dominio.com" />
                            </div>
                            
                            <div className="grid gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="admin-generar-password"
                                        type="checkbox"
                                        checked={formState.generarPassword}
                                        onChange={(e) => setFormState(prev => ({ ...prev, generarPassword: e.target.checked }))}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor="admin-generar-password" className="text-sm font-medium cursor-pointer">
                                        Generar contraseña automática
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="admin-enviar-email"
                                        type="checkbox"
                                        checked={formState.enviarEmail}
                                        onChange={(e) => setFormState(prev => ({ ...prev, enviarEmail: e.target.checked }))}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor="admin-enviar-email" className="text-sm font-medium cursor-pointer">
                                        Enviar email con credenciales
                                    </Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {formState.generarPassword 
                                        ? "Se generará una contraseña segura que el usuario deberá cambiar en su primer login."
                                        : "Deberás especificar una contraseña temporal manualmente."}
                                </p>
                            </div>
                            
                            {!formState.generarPassword && (
                                <div className="grid gap-2">
                                    <Label htmlFor="admin-password">Contraseña temporal *</Label>
                                    <Input 
                                        id="admin-password" 
                                        type="password" 
                                        value={formState.password} 
                                        onChange={handleFormChange("password")} 
                                        required={!formState.generarPassword}
                                        placeholder="Mínimo 8 caracteres" 
                                    />
                                </div>
                            )}
                            
                            <div className="grid gap-2">
                                <Label htmlFor="admin-telefono">Teléfono</Label>
                                <Input id="admin-telefono" value={formState.telefono} onChange={handleFormChange("telefono")} placeholder="Teléfono de contacto" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-organizacion">Organización</Label>
                                <Input id="admin-organizacion" value={formState.organizacion} onChange={handleFormChange("organizacion")} placeholder="Nombre de la organización" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-cargo">Cargo</Label>
                                <Input id="admin-cargo" value={formState.cargo} onChange={handleFormChange("cargo")} placeholder="Ej. Coordinador de grupo" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-experiencia">Experiencia (años)</Label>
                                <Input id="admin-experiencia" type="number" min="0" value={formState.experiencia} onChange={handleFormChange("experiencia")} placeholder="0" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="admin-rol">Rol</Label>
                                <Select
                                    value={formState.rol}
                                    onValueChange={(value) => {
                                        setFormState((prev) => ({ ...prev, rol: value }))
                                    }}
                                >
                                    <SelectTrigger id="admin-rol">
                                        <SelectValue placeholder="Seleccionar rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoleOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full" disabled={creatingUser}>
                                {creatingUser ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                        Creando usuario…
                                    </>
                                ) : (
                                    "Crear usuario"
                                )}
                            </Button>
                        </form>
                    </section>

                    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                        <header className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h2 className="text-lg font-semibold">Usuarios registrados</h2>
                            </div>
                            <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={loadingUsers}>
                                {loadingUsers ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                        Actualizando…
                                    </>
                                ) : (
                                    "Actualizar"
                                )}
                            </Button>
                        </header>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Gestiona los accesos existentes. Solo puedes modificar usuarios con un rol inferior al tuyo.
                        </p>

                        <div className="mt-5 overflow-hidden rounded-xl border border-border/70">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted/60">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <th className="px-4 py-3">Usuario</th>
                                        <th className="px-4 py-3">Rol</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/70 bg-background/80">
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                No hay usuarios registrados todavía.
                                            </td>
                                        </tr>
                                    )}
                                    {users.map((managedUser) => {
                                        const targetPriority = ROLE_PRIORITY[managedUser.rol] ?? 0
                                        const canManageUser = currentPriority > targetPriority && user?.id !== managedUser.id

                                        return (
                                            <tr key={managedUser.id} className="text-sm">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{managedUser.nombre}</span>
                                                        <span className="text-xs text-muted-foreground">{managedUser.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Select
                                                        value={managedUser.rol}
                                                        onValueChange={(value) => handleRoleChange(managedUser.id, managedUser.rol, value)}
                                                        disabled={!canManageUser || updatingRoleId === managedUser.id}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {availableRoleOptions.map((option) => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={managedUser.activo ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700"}>
                                                        {managedUser.activo ? "Activo" : "Inactivo"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(managedUser.id)}
                                                            disabled={!canManageUser || deletingUserId === managedUser.id}
                                                        >
                                                            {deletingUserId === managedUser.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <>
                                                                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                                                    Eliminar
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
