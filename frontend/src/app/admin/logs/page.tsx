"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
    AlertTriangle,
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    Info,
    Loader2,
    RefreshCw,
    Terminal,
    Trash2,
    XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"
import { ThemeToggleButton } from "@/components/theme-toggle"

// ── Sólo SUPERADMIN puede ver este módulo ─────────────────────────────────────
const ONLY_SUPERADMIN = new Set(["SUPERADMIN"])

// ── Tipos ─────────────────────────────────────────────────────────────────────
type NivelLog = "INFO" | "WARN" | "ERROR"
type CategoriaLog = "AUTH" | "CHAT" | "LLM" | "DOCUMENTO" | "WEB" | "CANVAS" | "SISTEMA" | "API"

type LogEntry = {
    id: string
    nivel: NivelLog
    categoria: CategoriaLog
    mensaje: string
    detalles?: Record<string, unknown> | null
    usuarioId?: string | null
    ip?: string | null
    duracionMs?: number | null
    fechaCreacion: string
    usuario?: { id: string; email: string; nombre: string; rol: string } | null
}

type Pagination = { total: number; page: number; limit: number; pages: number }

type Resumen = {
    ultimas24h: {
        total: number
        porNivel:     { nivel: string; count: number }[]
        porCategoria: { categoria: string; count: number }[]
    }
    totalErroresHistorico: number
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────
function nivelBadge(nivel: NivelLog) {
    switch (nivel) {
        case "ERROR":
            return "inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
        case "WARN":
            return "inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-700 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
        default:
            return "inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
    }
}

function nivelRowClass(nivel: NivelLog) {
    switch (nivel) {
        case "ERROR": return "bg-red-50/70 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/50"
        case "WARN":  return "bg-yellow-50/50 hover:bg-yellow-50 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40"
        default:      return "hover:bg-muted/40"
    }
}

const CATEGORIA_COLORS: Record<string, string> = {
    AUTH:      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
    CHAT:      "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
    LLM:       "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
    DOCUMENTO: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
    WEB:       "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
    CANVAS:    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    SISTEMA:   "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    API:       "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300",
}

function categoriaBadge(cat: string) {
    const c = CATEGORIA_COLORS[cat] ?? "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    return `inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${c}`
}

function nivelIcon(nivel: NivelLog) {
    if (nivel === "ERROR") return <XCircle className="h-3 w-3" />
    if (nivel === "WARN")  return <AlertTriangle className="h-3 w-3" />
    return <Info className="h-3 w-3" />
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LogsPage() {
    const router = useRouter()
    const { status, isAuthenticated, user, token } = useAuth()

    // Estado de logs
    const [logs, setLogs]           = useState<LogEntry[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [resumen, setResumen]     = useState<Resumen | null>(null)
    const [loading, setLoading]     = useState(false)
    const [errorMsg, setErrorMsg]   = useState<string | null>(null)

    // Filtros
    const [filterNivel, setFilterNivel]         = useState("all")
    const [filterCategoria, setFilterCategoria] = useState("all")
    const [filterDesde, setFilterDesde]         = useState("")
    const [filterHasta, setFilterHasta]         = useState("")
    const [filterBuscar, setFilterBuscar]       = useState("")
    const [page, setPage]                       = useState(1)

    // UI
    const [expandedRow, setExpandedRow]   = useState<string | null>(null)
    const [autoRefresh, setAutoRefresh]   = useState(false)
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
    const [purging, setPurging]           = useState(false)
    const [purgeResult, setPurgeResult]   = useState<string | null>(null)

    const autoRefreshRef = useRef<NodeJS.Timeout | null>(null)

    const canAccess = isAuthenticated && user && ONLY_SUPERADMIN.has(user.rol ?? "")

    // ── Carga de logs ─────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async (silent = false) => {
        if (!token) return
        if (!silent) setLoading(true)
        setErrorMsg(null)

        const params = new URLSearchParams()
        if (filterNivel     && filterNivel !== "all")     params.set("nivel",     filterNivel)
        if (filterCategoria && filterCategoria !== "all") params.set("categoria", filterCategoria)
        if (filterDesde)  params.set("desde",  filterDesde)
        if (filterHasta)  params.set("hasta",  filterHasta)
        if (filterBuscar) params.set("buscar", filterBuscar)
        params.set("page",  String(page))
        params.set("limit", "50")

        try {
            const res = await fetch(buildApiUrl(`/api/logs?${params.toString()}`), {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) throw new Error(data?.error || "Error cargando logs")
            setLogs(data.logs ?? [])
            setPagination(data.pagination ?? null)
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : "Error desconocido")
        } finally {
            if (!silent) setLoading(false)
        }
    }, [token, filterNivel, filterCategoria, filterDesde, filterHasta, filterBuscar, page])

    // ── Carga resumen ─────────────────────────────────────────────────────────
    const fetchResumen = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(buildApiUrl("/api/logs/resumen"), {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            })
            const data = await res.json().catch(() => null)
            if (res.ok) setResumen(data)
        } catch (_) { /* silencioso */ }
    }, [token])

    // Carga inicial
    useEffect(() => {
        if (canAccess) {
            fetchLogs()
            fetchResumen()
        }
    }, [canAccess, fetchLogs, fetchResumen])

    // Auto-refresh cada 30s
    useEffect(() => {
        if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
        if (autoRefresh && canAccess) {
            autoRefreshRef.current = setInterval(() => {
                fetchLogs(true)
                fetchResumen()
            }, 30_000)
        }
        return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
    }, [autoRefresh, canAccess, fetchLogs, fetchResumen])

    // ── Purgar logs ───────────────────────────────────────────────────────────
    const handlePurge = async () => {
        if (!token) return
        setPurging(true)
        setPurgeResult(null)
        try {
            const res = await fetch(buildApiUrl("/api/logs/purgar"), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) throw new Error(data?.error || "Error purgando logs")
            setPurgeResult(`${data.eliminados} registros eliminados correctamente.`)
            fetchLogs()
            fetchResumen()
        } catch (e) {
            setPurgeResult(`Error: ${e instanceof Error ? e.message : "Error desconocido"}`)
        } finally {
            setPurging(false)
        }
    }

    // ── Guards ────────────────────────────────────────────────────────────────
    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center gap-3 bg-background">
                <Terminal className="h-8 w-8 animate-pulse text-primary" />
                <p className="text-sm text-muted-foreground">Verificando permisos…</p>
            </div>
        )
    }

    if (!canAccess) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
                <h1 className="text-xl font-semibold">Acceso restringido a Superadmin</h1>
                <Button onClick={() => router.replace("/admin")}>Volver al panel</Button>
            </div>
        )
    }

    // ── Datos de resumen ──────────────────────────────────────────────────────
    const errores24h  = resumen?.ultimas24h.porNivel.find(p => p.nivel === "ERROR")?.count  ?? 0
    const warnings24h = resumen?.ultimas24h.porNivel.find(p => p.nivel === "WARN")?.count  ?? 0
    const info24h     = resumen?.ultimas24h.porNivel.find(p => p.nivel === "INFO")?.count   ?? 0
    const total24h    = resumen?.ultimas24h.total ?? 0

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10">

                {/* Cabecera */}
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                            <Terminal className="h-4 w-4" />
                            Superadmin · Logs del sistema
                        </div>
                        <h1 className="text-3xl font-semibold leading-tight">Logs del sistema</h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Registro de eventos: inicios de sesión, errores LLM, acciones de administración y eventos del servidor.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggleButton />
                        <Button variant="outline" onClick={() => router.push("/admin")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al panel
                        </Button>
                    </div>
                </header>

                {/* Tarjetas de resumen */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-red-600 dark:text-red-400">Errores (24h)</CardTitle>
                            <XCircle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{errores24h}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Avisos (24h)</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{warnings24h}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Info (24h)</CardTitle>
                            <Info className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{info24h}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Errores histórico</CardTitle>
                            <Terminal className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{resumen?.totalErroresHistorico ?? "—"}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Barra de filtros */}
                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-end gap-3">
                        {/* Nivel */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Nivel</span>
                            <Select value={filterNivel} onValueChange={v => { setFilterNivel(v); setPage(1) }}>
                                <SelectTrigger className="h-9 w-32">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="ERROR">Error</SelectItem>
                                    <SelectItem value="WARN">Aviso</SelectItem>
                                    <SelectItem value="INFO">Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Categoría */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Categoría</span>
                            <Select value={filterCategoria} onValueChange={v => { setFilterCategoria(v); setPage(1) }}>
                                <SelectTrigger className="h-9 w-36">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {["AUTH","CHAT","LLM","DOCUMENTO","WEB","CANVAS","SISTEMA","API"].map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Desde */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Desde</span>
                            <Input
                                type="date"
                                className="h-9 w-38"
                                value={filterDesde}
                                onChange={e => { setFilterDesde(e.target.value); setPage(1) }}
                            />
                        </div>

                        {/* Hasta */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Hasta</span>
                            <Input
                                type="date"
                                className="h-9 w-38"
                                value={filterHasta}
                                onChange={e => { setFilterHasta(e.target.value); setPage(1) }}
                            />
                        </div>

                        {/* Búsqueda */}
                        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                            <span className="text-xs text-muted-foreground">Buscar en mensaje</span>
                            <Input
                                placeholder="Texto libre…"
                                className="h-9"
                                value={filterBuscar}
                                onChange={e => { setFilterBuscar(e.target.value); setPage(1) }}
                            />
                        </div>

                        {/* Acciones */}
                        <div className="flex items-end gap-2 pb-0">
                            <Button variant="outline" size="sm" className="h-9" onClick={() => fetchLogs()} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button
                                variant={autoRefresh ? "default" : "outline"}
                                size="sm"
                                className="h-9 gap-1.5"
                                onClick={() => setAutoRefresh(v => !v)}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
                                Auto 30s
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 text-destructive hover:text-destructive"
                                onClick={() => setPurgeDialogOpen(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Purgar
                            </Button>
                        </div>
                    </div>

                    {errorMsg && (
                        <p className="mt-3 text-sm text-destructive">{errorMsg}</p>
                    )}
                </div>

                {/* Tabla de logs */}
                <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
                    {loading && logs.length === 0 ? (
                        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Cargando logs…</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                            No hay logs que coincidan con los filtros.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        <th className="w-6 px-3 py-3" />
                                        <th className="px-3 py-3 whitespace-nowrap">Fecha</th>
                                        <th className="px-3 py-3">Nivel</th>
                                        <th className="px-3 py-3">Categoría</th>
                                        <th className="px-3 py-3">Mensaje</th>
                                        <th className="px-3 py-3">Usuario</th>
                                        <th className="px-3 py-3 whitespace-nowrap">IP</th>
                                        <th className="px-3 py-3 whitespace-nowrap">ms</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {logs.map(log => (
                                        <>
                                            <tr
                                                key={log.id}
                                                className={`cursor-pointer transition-colors ${nivelRowClass(log.nivel)}`}
                                                onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                            >
                                                {/* Expand icon */}
                                                <td className="px-3 py-2 text-muted-foreground">
                                                    {log.detalles
                                                        ? (expandedRow === log.id
                                                            ? <ChevronDown className="h-3.5 w-3.5" />
                                                            : <ChevronRight className="h-3.5 w-3.5" />)
                                                        : null}
                                                </td>
                                                {/* Fecha */}
                                                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap font-mono">
                                                    {formatDate(log.fechaCreacion)}
                                                </td>
                                                {/* Nivel */}
                                                <td className="px-3 py-2">
                                                    <span className={nivelBadge(log.nivel)}>
                                                        {nivelIcon(log.nivel)}
                                                        {log.nivel}
                                                    </span>
                                                </td>
                                                {/* Categoría */}
                                                <td className="px-3 py-2">
                                                    <span className={categoriaBadge(log.categoria)}>
                                                        {log.categoria}
                                                    </span>
                                                </td>
                                                {/* Mensaje */}
                                                <td className="px-3 py-2 max-w-xs">
                                                    <span className={`font-medium ${log.nivel === "ERROR" ? "text-red-700 dark:text-red-300" : log.nivel === "WARN" ? "text-yellow-700 dark:text-yellow-300" : ""}`}>
                                                        {log.mensaje}
                                                    </span>
                                                </td>
                                                {/* Usuario */}
                                                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                    {log.usuario ? (
                                                        <div>
                                                            <div className="font-medium text-foreground">{log.usuario.nombre}</div>
                                                            <div>{log.usuario.email}</div>
                                                        </div>
                                                    ) : "—"}
                                                </td>
                                                {/* IP */}
                                                <td className="px-3 py-2 text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                    {log.ip ?? "—"}
                                                </td>
                                                {/* Duración */}
                                                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                    {log.duracionMs != null ? `${log.duracionMs}ms` : "—"}
                                                </td>
                                            </tr>

                                            {/* Fila expandible con detalles */}
                                            {expandedRow === log.id && log.detalles && (
                                                <tr key={`${log.id}-details`} className={nivelRowClass(log.nivel)}>
                                                    <td colSpan={8} className="px-6 pb-4 pt-1">
                                                        <pre className={`rounded-lg border p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono ${
                                                            log.nivel === "ERROR"
                                                                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
                                                                : log.nivel === "WARN"
                                                                    ? "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300"
                                                                    : "border-border bg-muted text-foreground"
                                                        }`}>
                                                            {JSON.stringify(log.detalles, null, 2)}
                                                        </pre>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Paginación */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {pagination.total.toLocaleString("es-ES")} entradas · página {pagination.page} de {pagination.pages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}

            </div>

            {/* Diálogo de purga */}
            <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Purgar logs antiguos?</DialogTitle>
                        <DialogDescription>
                            Eliminará logs según la política de retención:<br />
                            <strong>INFO</strong> → &gt; 30 días · <strong>WARN / ERROR</strong> → &gt; 90 días
                        </DialogDescription>
                    </DialogHeader>
                    {purgeResult && (
                        <p className={`text-sm ${purgeResult.startsWith("Error") ? "text-destructive" : "text-primary"}`}>
                            {purgeResult}
                        </p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setPurgeDialogOpen(false); setPurgeResult(null) }}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handlePurge} disabled={purging}>
                            {purging ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Purgando…</>
                            ) : (
                                <><Trash2 className="mr-2 h-4 w-4" />Purgar ahora</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
