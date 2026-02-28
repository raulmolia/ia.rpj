"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, ArrowLeft, Loader2, MoreHorizontal, Pencil, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react"

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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { Checkbox } from "@/components/ui/checkbox"
import { buildApiUrl } from "@/lib/utils"

const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMINISTRADOR"])

// Roles que siempre tienen acceso PRO (herramientas)
const PRO_ROLES = new Set(["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR", "DOCUMENTADOR_JUNIOR"])

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
    telefono?: string | null
    experiencia?: number | null
    tipoSuscripcion?: string | null
    totalMensajes?: number
    totalSesiones?: number
}

const SUBSCRIPTION_OPTIONS = [
    { value: "FREE", label: "Free" },
    { value: "PRO", label: "Pro" },
]

const STATUS_OPTIONS = [
    { value: "true", label: "Activo" },
    { value: "false", label: "Inactivo" },
]

type UserFormState = {
    nombre: string
    apellidos: string
    email: string
    password: string
    rol: string
    tipoSuscripcion: string
    telefono: string
    organizacion: string
    cargo: string
    experiencia: string
    generarPassword: boolean
    enviarEmail: boolean
}

type EditUserFormState = {
    nombre: string
    apellidos: string
    email: string
    rol: string
    tipoSuscripcion: string
    activo: string
    telefono: string
    organizacion: string
    cargo: string
    experiencia: string
}

const INITIAL_FORM_STATE: UserFormState = {
    nombre: "",
    apellidos: "",
    email: "",
    password: "",
    rol: "USUARIO",
    tipoSuscripcion: "FREE",
    telefono: "",
    organizacion: "",
    cargo: "",
    experiencia: "",
    generarPassword: true,
    enviarEmail: true,
}

// Función para determinar el badge de suscripción efectivo
function getEffectiveSubscription(rol: string, tipoSuscripcion?: string | null): { label: string; isPro: boolean } {
    // Los roles especiales siempre son PRO
    if (PRO_ROLES.has(rol)) {
        return { label: "Pro", isPro: true }
    }
    // Para usuarios normales, depende de su tipoSuscripcion
    return tipoSuscripcion === "PRO" 
        ? { label: "Pro", isPro: true } 
        : { label: "Free", isPro: false }
}

export default function AdminPage() {
    const router = useRouter()
    const { status, isAuthenticated, user, token } = useAuth()

    const [users, setUsers] = useState<ManagedUser[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [creatingUser, setCreatingUser] = useState(false)
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [formState, setFormState] = useState<UserFormState>(INITIAL_FORM_STATE)
    
    // Estado para el diálogo de nuevo usuario
    const [createDialogOpen, setCreateDialogOpen] = useState(false)

    // Paginación
    const [itemsPerPage, setItemsPerPage] = useState<number>(25)
    const [currentPage, setCurrentPage] = useState<number>(1)

    // Estado para el diálogo de edición
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
    const [editFormState, setEditFormState] = useState<EditUserFormState | null>(null)
    
    // Estado para el diálogo de confirmación de eliminación
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null)

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

    // Paginación
    const totalPages = Math.ceil(users.length / itemsPerPage)
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return users.slice(startIndex, startIndex + itemsPerPage)
    }, [users, currentPage, itemsPerPage])

    // Reset paginación cuando cambian los usuarios
    useEffect(() => {
        setCurrentPage(1)
    }, [users.length])

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
            tipoSuscripcion: formState.tipoSuscripcion,
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
            setCreateDialogOpen(false)
            fetchUsers()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo crear el usuario"
            setError(message)
        } finally {
            setCreatingUser(false)
        }
    }

    // Abrir diálogo de edición
    const openEditDialog = (managedUser: ManagedUser) => {
        setEditingUser(managedUser)
        setEditFormState({
            nombre: managedUser.nombre || "",
            apellidos: managedUser.apellidos || "",
            email: managedUser.email || "",
            rol: managedUser.rol || "USUARIO",
            tipoSuscripcion: managedUser.tipoSuscripcion || "FREE",
            activo: managedUser.activo ? "true" : "false",
            telefono: managedUser.telefono || "",
            organizacion: managedUser.organizacion || "",
            cargo: managedUser.cargo || "",
            experiencia: managedUser.experiencia?.toString() || "",
        })
        setEditDialogOpen(true)
    }

    // Guardar cambios del usuario editado
    const handleSaveEdit = async () => {
        if (!token || !editingUser || !editFormState) return

        setUpdatingUserId(editingUser.id)
        setError(null)

        try {
            const response = await fetch(buildApiUrl(`/api/auth/users/${editingUser.id}`), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    nombre: editFormState.nombre.trim(),
                    apellidos: editFormState.apellidos.trim() || null,
                    email: editFormState.email.trim(),
                    rol: editFormState.rol,
                    tipoSuscripcion: editFormState.tipoSuscripcion,
                    activo: editFormState.activo === "true",
                    telefono: editFormState.telefono.trim() || null,
                    organizacion: editFormState.organizacion.trim() || null,
                    cargo: editFormState.cargo.trim() || null,
                    experiencia: editFormState.experiencia.trim() ? Number.parseInt(editFormState.experiencia, 10) : null,
                }),
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({ message: "Error actualizando usuario" }))
                throw new Error(body?.message || "Error actualizando usuario")
            }

            setFeedback("Usuario actualizado correctamente")
            setEditDialogOpen(false)
            setEditingUser(null)
            setEditFormState(null)
            fetchUsers()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo actualizar el usuario"
            setError(message)
        } finally {
            setUpdatingUserId(null)
        }
    }

    // Abrir diálogo de confirmación de eliminación
    const openDeleteDialog = (managedUser: ManagedUser) => {
        setUserToDelete(managedUser)
        setDeleteDialogOpen(true)
    }

    // Confirmar eliminación
    const handleConfirmDelete = async () => {
        if (!token || !userToDelete) return

        setDeletingUserId(userToDelete.id)
        setError(null)

        try {
            const response = await fetch(buildApiUrl(`/api/auth/users/${userToDelete.id}`), {
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
            setDeleteDialogOpen(false)
            setUserToDelete(null)
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
                        <Button variant="outline" onClick={() => { setFormState(INITIAL_FORM_STATE); setCreateDialogOpen(true) }}>
                            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                            Nuevo usuario
                        </Button>
                        {user?.rol === "SUPERADMIN" && (
                            <Button variant="outline" onClick={() => router.push("/admin/logs")}>
                                <Activity className="mr-2 h-4 w-4" aria-hidden="true" />
                                Logs del sistema
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => router.push("/")}>
                            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                            Volver al chat
                        </Button>
                    </div>
                </header>

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
                                        <th className="px-4 py-3">Fecha alta</th>
                                        <th className="px-4 py-3 text-center">Iteraciones</th>
                                        <th className="px-4 py-3 text-center">Sesiones</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/70 bg-background/80">
                                    {paginatedUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                No hay usuarios registrados todavía.
                                            </td>
                                        </tr>
                                    )}
                                    {paginatedUsers.map((managedUser) => {
                                        const targetPriority = ROLE_PRIORITY[managedUser.rol] ?? 0
                                        const canManageUser = currentPriority > targetPriority && user?.id !== managedUser.id
                                        const subscription = getEffectiveSubscription(managedUser.rol, managedUser.tipoSuscripcion)

                                        return (
                                            <tr key={managedUser.id} className="text-sm">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{managedUser.nombre}</span>
                                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                subscription.isPro
                                                                    ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-300'
                                                                    : 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300'
                                                            }`}>
                                                                {subscription.label}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">{managedUser.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm">{ROLE_OPTIONS.find(r => r.value === managedUser.rol)?.label || managedUser.rol}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={managedUser.activo ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300"}>
                                                        {managedUser.activo ? "Activo" : "Inactivo"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {managedUser.fechaCreacion ? new Date(managedUser.fechaCreacion).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm">
                                                    {managedUser.totalMensajes ?? 0}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm">
                                                    {managedUser.totalSesiones ?? 0}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    disabled={!canManageUser}
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Abrir menú</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => openEditDialog(managedUser)}>
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem 
                                                                    onClick={() => openDeleteDialog(managedUser)}
                                                                    className="text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Eliminar
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {users.length > 0 && (
                            <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Mostrar</span>
                                    <Select
                                        value={itemsPerPage.toString()}
                                        onValueChange={(value) => {
                                            setItemsPerPage(Number(value))
                                            setCurrentPage(1)
                                        }}
                                    >
                                        <SelectTrigger className="w-[80px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span className="text-sm text-muted-foreground">
                                        de {users.length} usuarios
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                    >
                                        Primera
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-muted-foreground px-2">
                                        Página {currentPage} de {totalPages || 1}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage >= totalPages}
                                    >
                                        Siguiente
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage >= totalPages}
                                    >
                                        Última
                                    </Button>
                                </div>
                            </div>
                        )}
                    </section>
            </div>

            {/* Diálogo de creación de nuevo usuario */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nuevo usuario</DialogTitle>
                        <DialogDescription>
                            Crea un nuevo perfil de usuario. Los campos marcados con * son obligatorios.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleCreateUser} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="create-nombre">Nombre *</Label>
                            <Input 
                                id="create-nombre" 
                                value={formState.nombre} 
                                onChange={handleFormChange("nombre")}
                                placeholder="Nombre del usuario" 
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-apellidos">Apellidos</Label>
                            <Input 
                                id="create-apellidos" 
                                value={formState.apellidos} 
                                onChange={handleFormChange("apellidos")}
                                placeholder="Apellidos" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-email">Email *</Label>
                            <Input 
                                id="create-email" 
                                type="email"
                                value={formState.email} 
                                onChange={handleFormChange("email")}
                                placeholder="nombre@dominio.com" 
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-telefono">Teléfono</Label>
                            <Input 
                                id="create-telefono" 
                                value={formState.telefono} 
                                onChange={handleFormChange("telefono")}
                                placeholder="Teléfono de contacto" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-organizacion">Organización</Label>
                            <Input 
                                id="create-organizacion" 
                                value={formState.organizacion} 
                                onChange={handleFormChange("organizacion")}
                                placeholder="Nombre de la organización" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-cargo">Cargo</Label>
                            <Input 
                                id="create-cargo" 
                                value={formState.cargo} 
                                onChange={handleFormChange("cargo")}
                                placeholder="Ej. Coordinador de grupo" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-experiencia">Experiencia (años)</Label>
                            <Input 
                                id="create-experiencia" 
                                type="number"
                                min="0"
                                value={formState.experiencia} 
                                onChange={handleFormChange("experiencia")}
                                placeholder="0" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="create-rol">Rol</Label>
                            <Select
                                value={formState.rol}
                                onValueChange={(value) => setFormState(prev => ({ ...prev, rol: value }))}
                            >
                                <SelectTrigger id="create-rol">
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
                        <div className="grid gap-2">
                            <Label htmlFor="create-suscripcion">Tipo de suscripción</Label>
                            <Select
                                value={formState.tipoSuscripcion}
                                onValueChange={(value) => setFormState(prev => ({ ...prev, tipoSuscripcion: value }))}
                            >
                                <SelectTrigger id="create-suscripcion">
                                    <SelectValue placeholder="Seleccionar suscripción" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUBSCRIPTION_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <span className="flex items-center gap-2">
                                                <span className={`inline-block h-2 w-2 rounded-full ${
                                                    option.value === 'PRO' ? 'bg-red-500' : 'bg-emerald-500'
                                                }`} />
                                                {option.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3 rounded-lg border border-border/70 p-4">
                            <h4 className="text-sm font-medium">Contraseña y notificación</h4>
                            <div className="flex items-center gap-2">
                                <Checkbox 
                                    id="create-generar-password" 
                                    checked={formState.generarPassword}
                                    onCheckedChange={(checked) => setFormState(prev => ({ ...prev, generarPassword: checked === true }))}
                                />
                                <Label htmlFor="create-generar-password" className="text-sm font-normal cursor-pointer">
                                    Generar contraseña automática
                                </Label>
                            </div>
                            {!formState.generarPassword && (
                                <div className="grid gap-2">
                                    <Label htmlFor="create-password">Contraseña *</Label>
                                    <Input 
                                        id="create-password" 
                                        type="password"
                                        value={formState.password} 
                                        onChange={handleFormChange("password")}
                                        placeholder="Contraseña del usuario" 
                                        required={!formState.generarPassword}
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Checkbox 
                                    id="create-enviar-email" 
                                    checked={formState.enviarEmail}
                                    onCheckedChange={(checked) => setFormState(prev => ({ ...prev, enviarEmail: checked === true }))}
                                />
                                <Label htmlFor="create-enviar-email" className="text-sm font-normal cursor-pointer">
                                    Enviar credenciales por email al usuario
                                </Label>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={creatingUser}>
                                {creatingUser ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creando…
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Crear usuario
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Diálogo de edición de usuario */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar usuario</DialogTitle>
                        <DialogDescription>
                            Modifica los datos del usuario. Los cambios se aplicarán de inmediato.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {editFormState && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-nombre">Nombre *</Label>
                                <Input 
                                    id="edit-nombre" 
                                    value={editFormState.nombre} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                                    placeholder="Nombre" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-apellidos">Apellidos</Label>
                                <Input 
                                    id="edit-apellidos" 
                                    value={editFormState.apellidos} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, apellidos: e.target.value } : null)}
                                    placeholder="Apellidos" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-email">Email *</Label>
                                <Input 
                                    id="edit-email" 
                                    type="email"
                                    value={editFormState.email} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, email: e.target.value } : null)}
                                    placeholder="nombre@dominio.com" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-telefono">Teléfono</Label>
                                <Input 
                                    id="edit-telefono" 
                                    value={editFormState.telefono} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, telefono: e.target.value } : null)}
                                    placeholder="Teléfono de contacto" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-organizacion">Organización</Label>
                                <Input 
                                    id="edit-organizacion" 
                                    value={editFormState.organizacion} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, organizacion: e.target.value } : null)}
                                    placeholder="Nombre de la organización" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-cargo">Cargo</Label>
                                <Input 
                                    id="edit-cargo" 
                                    value={editFormState.cargo} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, cargo: e.target.value } : null)}
                                    placeholder="Ej. Coordinador de grupo" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-experiencia">Experiencia (años)</Label>
                                <Input 
                                    id="edit-experiencia" 
                                    type="number"
                                    min="0"
                                    value={editFormState.experiencia} 
                                    onChange={(e) => setEditFormState(prev => prev ? { ...prev, experiencia: e.target.value } : null)}
                                    placeholder="0" 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-rol">Rol</Label>
                                <Select
                                    value={editFormState.rol}
                                    onValueChange={(value) => setEditFormState(prev => prev ? { ...prev, rol: value } : null)}
                                >
                                    <SelectTrigger id="edit-rol">
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
                            <div className="grid gap-2">
                                <Label htmlFor="edit-suscripcion">Tipo de suscripción</Label>
                                <Select
                                    value={editFormState.tipoSuscripcion}
                                    onValueChange={(value) => setEditFormState(prev => prev ? { ...prev, tipoSuscripcion: value } : null)}
                                >
                                    <SelectTrigger id="edit-suscripcion">
                                        <SelectValue placeholder="Seleccionar suscripción" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBSCRIPTION_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                <span className="flex items-center gap-2">
                                                    <span className={`inline-block h-2 w-2 rounded-full ${
                                                        option.value === 'PRO' ? 'bg-red-500' : 'bg-emerald-500'
                                                    }`} />
                                                    {option.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-activo">Estado</Label>
                                <Select
                                    value={editFormState.activo}
                                    onValueChange={(value) => setEditFormState(prev => prev ? { ...prev, activo: value } : null)}
                                >
                                    <SelectTrigger id="edit-activo">
                                        <SelectValue placeholder="Seleccionar estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={updatingUserId !== null}>
                            {updatingUserId ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando…
                                </>
                            ) : (
                                "Guardar cambios"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo de confirmación de eliminación */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Eliminar usuario?</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el usuario{" "}
                            <span className="font-semibold">{userToDelete?.nombre}</span> ({userToDelete?.email}) y todos sus datos asociados.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingUserId !== null}>
                            {deletingUserId ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Eliminando…
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
