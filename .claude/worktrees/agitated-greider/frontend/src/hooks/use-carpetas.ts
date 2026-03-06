"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { buildApiUrl } from "@/lib/utils"

// ── Tipos ──────────────────────────────────────────────

export type CarpetaConversacion = {
    id: string
    titulo: string | null
    fechaActualizacion: string | null
    intencionPrincipal: string | null
}

export type CarpetaCompartidaUsuario = {
    id: string
    nombre: string | null
    email: string
}

export type CarpetaCompartida = {
    id: string
    usuarioId: string
    permisos: "lectura" | "escritura"
    usuario: CarpetaCompartidaUsuario
}

export type CarpetaNotificacion = {
    id: string
    tipo: string
    mensaje: string
    leida: boolean
    fechaCreacion: string
}

export type Carpeta = {
    id: string
    nombre: string
    icono: string
    color: string
    usuarioId: string
    fechaCreacion: string
    fechaActualizacion: string
    conversaciones: CarpetaConversacion[]
    compartidas: CarpetaCompartida[]
    esCompartida: boolean
    permisos?: "lectura" | "escritura"
    usuario?: CarpetaCompartidaUsuario // Para carpetas compartidas: el propietario
    _count?: { notificaciones: number }
}

export type UsuarioPro = {
    id: string
    nombre: string | null
    email: string
}

// ── Hook ───────────────────────────────────────────────

export function useCarpetas(token: string | null, isPro: boolean) {
    const [carpetasPropias, setCarpetasPropias] = useState<Carpeta[]>([])
    const [carpetasCompartidas, setCarpetasCompartidas] = useState<Carpeta[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fetchedRef = useRef(false)

    const headers = useCallback(() => ({
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }), [token])

    // ── Cargar carpetas ──
    const fetchCarpetas = useCallback(async () => {
        if (!token) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(buildApiUrl("/api/carpetas"), { headers: headers() })
            if (!res.ok) throw new Error("Error al cargar carpetas")
            const data = await res.json()
            setCarpetasPropias(data.propias ?? [])
            setCarpetasCompartidas(data.compartidas ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setLoading(false)
        }
    }, [token, headers])

    // Carga inicial
    useEffect(() => {
        if (token && !fetchedRef.current) {
            fetchedRef.current = true
            void fetchCarpetas()
        }
    }, [token, fetchCarpetas])

    // ── Crear carpeta ──
    const crearCarpeta = useCallback(async (nombre: string, icono: string, color: string): Promise<Carpeta | null> => {
        if (!token) return null
        try {
            const res = await fetch(buildApiUrl("/api/carpetas"), {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ nombre, icono, color }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Error al crear carpeta")
            }
            const carpeta = await res.json()
            // Recargar para obtener datos completos
            await fetchCarpetas()
            return carpeta
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return null
        }
    }, [token, headers, fetchCarpetas])

    // ── Actualizar carpeta ──
    const actualizarCarpeta = useCallback(async (id: string, data: { nombre?: string; icono?: string; color?: string }): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${id}`), {
                method: "PATCH",
                headers: headers(),
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Error al actualizar")
            }
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Eliminar carpeta ──
    const eliminarCarpeta = useCallback(async (id: string): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${id}`), {
                method: "DELETE",
                headers: headers(),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Error al eliminar")
            }
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Añadir conversación a carpeta ──
    const addConversacion = useCallback(async (carpetaId: string, conversacionId: string): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${carpetaId}/conversaciones`), {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ conversacionId }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Error al añadir conversación")
            }
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Quitar conversación de carpeta ──
    const removeConversacion = useCallback(async (carpetaId: string, conversacionId: string): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${carpetaId}/conversaciones/${conversacionId}`), {
                method: "DELETE",
                headers: headers(),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Error al quitar conversación")
            }
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Compartir carpeta ──
    const compartirCarpeta = useCallback(async (carpetaId: string, email: string, permisos: "lectura" | "escritura"): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${carpetaId}/compartir`), {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ email, permisos }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Error al compartir")
            }
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Dejar de compartir ──
    const dejarDeCompartir = useCallback(async (carpetaId: string, userId: string): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${carpetaId}/compartir/${userId}`), {
                method: "DELETE",
                headers: headers(),
            })
            if (!res.ok) throw new Error("Error")
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Marcar notificaciones como leídas ──
    const marcarNotificacionesLeidas = useCallback(async (carpetaId: string): Promise<boolean> => {
        if (!token) return false
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/${carpetaId}/notificaciones/leer`), {
                method: "POST",
                headers: headers(),
            })
            if (!res.ok) throw new Error("Error")
            await fetchCarpetas()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error")
            return false
        }
    }, [token, headers, fetchCarpetas])

    // ── Buscar usuarios Pro ──
    const buscarUsuariosPro = useCallback(async (query: string): Promise<UsuarioPro[]> => {
        if (!token || query.trim().length < 2) return []
        try {
            const res = await fetch(buildApiUrl(`/api/carpetas/usuarios/pro?q=${encodeURIComponent(query)}`), {
                headers: headers(),
            })
            if (!res.ok) return []
            return await res.json()
        } catch {
            return []
        }
    }, [token, headers])

    // Todas las carpetas (propias + compartidas)
    const todasLasCarpetas = [...carpetasPropias, ...carpetasCompartidas]

    return {
        carpetasPropias,
        carpetasCompartidas,
        todasLasCarpetas,
        loading,
        error,
        fetchCarpetas,
        crearCarpeta,
        actualizarCarpeta,
        eliminarCarpeta,
        addConversacion,
        removeConversacion,
        compartirCarpeta,
        dejarDeCompartir,
        marcarNotificacionesLeidas,
        buscarUsuariosPro,
    }
}
