"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    BarChart3,
    Brain,
    Database,
    FileText,
    Loader2,
    MessageSquare,
    RefreshCw,
    Users,
    Wrench,
    Activity,
    TrendingUp,
    ThumbsUp,
    ThumbsDown,
} from "lucide-react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"
import { ThemeToggleButton } from "@/components/theme-toggle"

const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMINISTRADOR"])

// Colores del tema: blanco, negro, gris, verde #94c120
const COLORS = {
    green: "#94c120",
    greenLight: "#b5d94d",
    greenDark: "#6f9116",
    black: "#1a1a1a",
    gray: "#6b7280",
    grayLight: "#d1d5db",
    grayMedium: "#9ca3af",
    white: "#ffffff",
}

const PIE_COLORS = [COLORS.green, COLORS.black, COLORS.gray, COLORS.grayLight, COLORS.greenLight, COLORS.greenDark]

// ===== Types =====
type ResumenData = {
    usuarios: { total: number; activos: number }
    conversaciones: number
    mensajes: number
    documentos: number
    fuentesWeb: number
    tokens: { entrada: number; salida: number; total: number }
    chromaDocumentos: number
}

type UsuariosData = {
    porRol: { rol: string; total: number }[]
    porSuscripcion: { tipo: string; total: number }[]
    registrosPorMes: { mes: string; total: number }[]
    estado: { activos: number; inactivos: number }
    topUsuarios: { nombre: string; email: string; rol: string; conversaciones: number; mensajes: number }[]
}

type InteraccionesData = {
    periodos: { hoy: number; semana: number; mes: number; ano: number; total: number }
    porDia: { dia: string; total: number }[]
    porUsuario: { nombre: string; email: string; mensajes: number }[]
    porHora: { hora: number; total: number }[]
}

type ConversacionesData = {
    total: number
    porUsuario: { nombre: string; email: string; total: number }[]
    porIntencion: { intencion: string; total: number }[]
    porMes: { mes: string; total: number }[]
    mediaMensajesPorConversacion: string
}

type ModelosIAData = {
    modelos: { modelo: string; total: number; tokensEntrada: number; tokensSalida: number; duracionMediaMs: number }[]
    usoPorDia: { dia: string; total: number; tokensEntrada: number; tokensSalida: number }[]
    tokensTotal: { entrada: number; salida: number; total: number }
    duracionMediaMs: number
}

type BaseDatosData = {
    tablas: { tabla: string; registros: number; tamanoKB: number; indicesKB: number; totalKB: number; motor: string; colacion: string; ultimaActualizacion: string | null }[]
    resumen: { tamanoMB: number; registrosTotales: number; totalTablas: number }
}

type ChromaDBData = {
    chromaDisponible: boolean
    colecciones: { nombre: string; documentos: number }[]
    totalDocumentosVectoriales: number
    documentos: { total: number; tamanoTotalMB: number; porEstado: { estado: string; total: number }[] }
    fuentesWeb: { porEstado: { estado: string; total: number }[] }
}

type IntencionesData = {
    porIntencion: { intencion: string; total: number; tokensEntrada: number; tokensSalida: number; duracionMediaMs: number }[]
    porMes: { mes: string; intencion: string; total: number }[]
}

type HerramientasData = {
    canvas: { total: number; porcentaje: number; porUsuario: { nombre: string; email: string; total: number }[]; porMes: { mes: string; total: number }[] }
    documentos: { porMes: { mes: string; total: number }[] }
}

type FeedbackData = {
    total: number
    positivos: number
    negativos: number
    porcentajePositivo: number
    feedbackPorIntencion: { intencion: string; positivos: number; negativos: number; total: number }[]
    recientes: { id: string; tipo: string; intencion: string | null; fechaCreacion: string; usuario: { nombre: string; apellidos: string; email: string } | null; mensaje: { content: string } | null }[]
}

// ===== Helper components =====
function StatCard({ title, value, description, icon: Icon }: { title: string; value: string | number; description?: string; icon: React.ElementType }) {
    return (
        <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</CardTitle>
                <Icon className="h-4 w-4 text-[#94c120]" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString('es-ES') : value}</div>
                {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
            </CardContent>
        </Card>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
    )
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString('es-ES')
}

function formatMs(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
    return `${ms}ms`
}

// ===== Intent name mapping =====
const INTENT_LABELS: Record<string, string> = {
    DINAMICA: "Dinámicas",
    EUCARISTIA: "Eucaristía",
    CELEBRACION_PALABRA: "Celebración de la Palabra",
    ORACION_PERSONAL: "Oración Personal",
    ORACION_GRUPAL: "Oración Grupal",
    ORACION: "Oración",
    CELEBRACION: "Celebración",
    PROGRAMACION: "Programación",
    OTROS: "Consulta General",
    "Sin intención": "Sin intención",
}

function getIntentLabel(key: string): string {
    return INTENT_LABELS[key] || key
}

// ===== Main Page =====
export default function EstadisticasPage() {
    const router = useRouter()
    const { status, isAuthenticated, user, token } = useAuth()

    const [activeTab, setActiveTab] = useState("resumen")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Data states
    const [resumen, setResumen] = useState<ResumenData | null>(null)
    const [usuarios, setUsuarios] = useState<UsuariosData | null>(null)
    const [interacciones, setInteracciones] = useState<InteraccionesData | null>(null)
    const [conversaciones, setConversaciones] = useState<ConversacionesData | null>(null)
    const [modelosIA, setModelosIA] = useState<ModelosIAData | null>(null)
    const [baseDatos, setBaseDatos] = useState<BaseDatosData | null>(null)
    const [chromaDB, setChromaDB] = useState<ChromaDBData | null>(null)
    const [intenciones, setIntenciones] = useState<IntencionesData | null>(null)
    const [herramientas, setHerramientas] = useState<HerramientasData | null>(null)
    const [feedback, setFeedback] = useState<FeedbackData | null>(null)

    const canAccess = useMemo(
        () => Boolean(isAuthenticated && user && ALLOWED_ROLES.has(user.rol ?? "")),
        [isAuthenticated, user],
    )

    const fetchData = useCallback(async (endpoint: string) => {
        if (!token) return null
        try {
            const res = await fetch(buildApiUrl(`/api/stats/${endpoint}`), {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            })
            if (!res.ok) throw new Error(`Error ${res.status}`)
            return await res.json()
        } catch (err) {
            console.error(`Error obteniendo /stats/${endpoint}:`, err)
            return null
        }
    }, [token])

    const loadTab = useCallback(async (tab: string) => {
        setLoading(true)
        setError(null)
        try {
            switch (tab) {
                case "resumen": {
                    const data = await fetchData("resumen")
                    if (data) setResumen(data)
                    break
                }
                case "usuarios": {
                    const data = await fetchData("usuarios")
                    if (data) setUsuarios(data)
                    break
                }
                case "interacciones": {
                    const data = await fetchData("interacciones")
                    if (data) setInteracciones(data)
                    break
                }
                case "conversaciones": {
                    const data = await fetchData("conversaciones")
                    if (data) setConversaciones(data)
                    break
                }
                case "modelos-ia": {
                    const data = await fetchData("modelos-ia")
                    if (data) setModelosIA(data)
                    break
                }
                case "base-datos": {
                    const data = await fetchData("base-datos")
                    if (data) setBaseDatos(data)
                    break
                }
                case "chromadb": {
                    const data = await fetchData("chromadb")
                    if (data) setChromaDB(data)
                    break
                }
                case "intenciones": {
                    const data = await fetchData("intenciones")
                    if (data) setIntenciones(data)
                    break
                }
                case "herramientas": {
                    const data = await fetchData("herramientas")
                    if (data) setHerramientas(data)
                    break
                }
                case "feedback": {
                    const data = await fetchData("feedback")
                    if (data) setFeedback(data)
                    break
                }
            }
        } catch (err) {
            setError("Error cargando estadísticas")
        } finally {
            setLoading(false)
        }
    }, [fetchData])

    // Load data when tab changes
    useEffect(() => {
        if (canAccess && token) {
            loadTab(activeTab)
        }
    }, [activeTab, canAccess, token, loadTab])

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/")
        }
    }, [status, router])

    if (status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-[#94c120]" />
            </div>
        )
    }

    if (!canAccess) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-gray-950">
                <p className="text-gray-500">No tienes permisos para acceder a esta sección.</p>
                <Button variant="outline" onClick={() => router.push("/")}>Volver al inicio</Button>
            </div>
        )
    }

    const handleTabChange = (tab: string) => {
        setActiveTab(tab)
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 md:px-6 py-3">
                <div className="flex items-center justify-between max-w-[1600px] mx-auto">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-6 w-6 text-[#94c120]" />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Estadísticas</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadTab(activeTab)}
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </Button>
                        <ThemeToggleButton />
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-[1600px] mx-auto p-4 md:p-6">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 dark:bg-gray-900 p-1 mb-6">
                        <TabsTrigger value="resumen" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <Activity className="h-3.5 w-3.5" /> Resumen
                        </TabsTrigger>
                        <TabsTrigger value="usuarios" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <Users className="h-3.5 w-3.5" /> Usuarios
                        </TabsTrigger>
                        <TabsTrigger value="interacciones" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <MessageSquare className="h-3.5 w-3.5" /> Interacciones
                        </TabsTrigger>
                        <TabsTrigger value="conversaciones" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <MessageSquare className="h-3.5 w-3.5" /> Conversaciones
                        </TabsTrigger>
                        <TabsTrigger value="modelos-ia" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <Brain className="h-3.5 w-3.5" /> Modelos IA
                        </TabsTrigger>
                        <TabsTrigger value="intenciones" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <TrendingUp className="h-3.5 w-3.5" /> Intenciones
                        </TabsTrigger>
                        <TabsTrigger value="base-datos" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <Database className="h-3.5 w-3.5" /> MariaDB
                        </TabsTrigger>
                        <TabsTrigger value="chromadb" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <Database className="h-3.5 w-3.5" /> ChromaDB
                        </TabsTrigger>
                        <TabsTrigger value="herramientas" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <Wrench className="h-3.5 w-3.5" /> Herramientas
                        </TabsTrigger>
                        <TabsTrigger value="feedback" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-[#94c120] data-[state=active]:text-white">
                            <ThumbsUp className="h-3.5 w-3.5" /> Feedback
                        </TabsTrigger>
                    </TabsList>

                    {/* ===== TAB: RESUMEN ===== */}
                    <TabsContent value="resumen">
                        {loading && !resumen ? <LoadingSkeleton /> : resumen ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard title="Usuarios totales" value={resumen.usuarios.total} description={`${resumen.usuarios.activos} activos`} icon={Users} />
                                    <StatCard title="Conversaciones" value={resumen.conversaciones} icon={MessageSquare} />
                                    <StatCard title="Mensajes totales" value={resumen.mensajes} icon={MessageSquare} />
                                    <StatCard title="Documentos" value={resumen.documentos} description={`${resumen.fuentesWeb} fuentes web`} icon={FileText} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard title="Tokens entrada" value={formatNumber(resumen.tokens.entrada)} icon={Brain} />
                                    <StatCard title="Tokens salida" value={formatNumber(resumen.tokens.salida)} icon={Brain} />
                                    <StatCard title="Tokens totales" value={formatNumber(resumen.tokens.total)} icon={Brain} />
                                    <StatCard title="Docs ChromaDB" value={resumen.chromaDocumentos >= 0 ? resumen.chromaDocumentos : 'N/D'} icon={Database} />
                                </div>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: USUARIOS ===== */}
                    <TabsContent value="usuarios">
                        {loading && !usuarios ? <LoadingSkeleton /> : usuarios ? (
                            <div className="space-y-6">
                                {/* Cards estado */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard title="Activos" value={usuarios.estado.activos} icon={Users} />
                                    <StatCard title="Inactivos" value={usuarios.estado.inactivos} icon={Users} />
                                    <StatCard title="Total roles" value={usuarios.porRol.length} icon={Users} />
                                    <StatCard title="Total suscripciones" value={usuarios.porSuscripcion.length} icon={Users} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Usuarios por rol - Pie */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Usuarios por rol</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={Object.fromEntries(usuarios.porRol.map((r, i) => [r.rol, { label: r.rol, color: PIE_COLORS[i % PIE_COLORS.length] }]))} className="h-[250px]">
                                                <PieChart>
                                                    <Pie data={usuarios.porRol} dataKey="total" nameKey="rol" cx="50%" cy="50%" outerRadius={80} label={({ rol, total }) => `${rol} (${total})`}>
                                                        {usuarios.porRol.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                    </Pie>
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                </PieChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Registros por mes - Bar */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Registros por mes</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{ total: { label: "Registros", color: COLORS.green } }} className="h-[250px]">
                                                <BarChart data={usuarios.registrosPorMes}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="total" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Top usuarios tabla */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Top 10 usuarios más activos</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Rol</TableHead>
                                                    <TableHead className="text-right">Conversaciones</TableHead>
                                                    <TableHead className="text-right">Mensajes</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {usuarios.topUsuarios.map((u, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium">{u.nombre}</TableCell>
                                                        <TableCell className="text-gray-500">{u.email}</TableCell>
                                                        <TableCell>
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#94c120]/10 text-[#94c120]">
                                                                {u.rol}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">{u.conversaciones}</TableCell>
                                                        <TableCell className="text-right">{u.mensajes}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: INTERACCIONES ===== */}
                    <TabsContent value="interacciones">
                        {loading && !interacciones ? <LoadingSkeleton /> : interacciones ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    <StatCard title="Hoy" value={interacciones.periodos.hoy} icon={MessageSquare} />
                                    <StatCard title="Esta semana" value={interacciones.periodos.semana} icon={MessageSquare} />
                                    <StatCard title="Este mes" value={interacciones.periodos.mes} icon={MessageSquare} />
                                    <StatCard title="Este año" value={interacciones.periodos.ano} icon={MessageSquare} />
                                    <StatCard title="Total" value={interacciones.periodos.total} icon={MessageSquare} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Mensajes por día - Line */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Mensajes últimos 30 días</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{ total: { label: "Mensajes", color: COLORS.green } }} className="h-[250px]">
                                                <LineChart data={interacciones.porDia}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Line type="monotone" dataKey="total" stroke={COLORS.green} strokeWidth={2} dot={false} />
                                                </LineChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Distribución por hora - Bar */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Distribución por hora del día</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{ total: { label: "Mensajes", color: COLORS.green } }} className="h-[250px]">
                                                <BarChart data={interacciones.porHora}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                    <XAxis dataKey="hora" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="total" fill={COLORS.green} radius={[2, 2, 0, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Top usuarios este mes */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Top 10 usuarios este mes</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead className="text-right">Mensajes</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {interacciones.porUsuario.map((u, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium">{u.nombre}</TableCell>
                                                        <TableCell className="text-gray-500">{u.email}</TableCell>
                                                        <TableCell className="text-right font-semibold">{u.mensajes}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: CONVERSACIONES ===== */}
                    <TabsContent value="conversaciones">
                        {loading && !conversaciones ? <LoadingSkeleton /> : conversaciones ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <StatCard title="Total conversaciones" value={conversaciones.total} icon={MessageSquare} />
                                    <StatCard title="Media mensajes/chat" value={conversaciones.mediaMensajesPorConversacion} icon={MessageSquare} />
                                    <StatCard title="Intenciones distintas" value={conversaciones.porIntencion.length} icon={TrendingUp} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Conversaciones por intención - Pie */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Por intención</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={Object.fromEntries(conversaciones.porIntencion.map((c, i) => [c.intencion, { label: getIntentLabel(c.intencion), color: PIE_COLORS[i % PIE_COLORS.length] }]))} className="h-[280px]">
                                                <PieChart>
                                                    <Pie data={conversaciones.porIntencion.map(c => ({ ...c, intencion: getIntentLabel(c.intencion) }))} dataKey="total" nameKey="intencion" cx="50%" cy="50%" outerRadius={90} label={({ intencion, total }) => `${intencion} (${total})`}>
                                                        {conversaciones.porIntencion.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                    </Pie>
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                </PieChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Conversaciones por mes - Bar */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Conversaciones por mes</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{ total: { label: "Conversaciones", color: COLORS.green } }} className="h-[280px]">
                                                <BarChart data={conversaciones.porMes}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="total" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Top usuarios por conversaciones */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Usuarios con más conversaciones</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead className="text-right">Conversaciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {conversaciones.porUsuario.map((u, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium">{u.nombre}</TableCell>
                                                        <TableCell className="text-gray-500">{u.email}</TableCell>
                                                        <TableCell className="text-right font-semibold">{u.total}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: MODELOS IA ===== */}
                    <TabsContent value="modelos-ia">
                        {loading && !modelosIA ? <LoadingSkeleton /> : modelosIA ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard title="Tokens entrada" value={formatNumber(modelosIA.tokensTotal.entrada)} icon={Brain} />
                                    <StatCard title="Tokens salida" value={formatNumber(modelosIA.tokensTotal.salida)} icon={Brain} />
                                    <StatCard title="Tokens totales" value={formatNumber(modelosIA.tokensTotal.total)} icon={Brain} />
                                    <StatCard title="Tiempo medio respuesta" value={formatMs(modelosIA.duracionMediaMs)} icon={Activity} />
                                </div>

                                {/* Tabla de modelos */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Uso por modelo</CardTitle>
                                        <CardDescription>Detalle de uso de cada modelo de IA</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Modelo</TableHead>
                                                    <TableHead className="text-right">Peticiones</TableHead>
                                                    <TableHead className="text-right">Tokens entrada</TableHead>
                                                    <TableHead className="text-right">Tokens salida</TableHead>
                                                    <TableHead className="text-right">Duración media</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {modelosIA.modelos.map((m, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium text-sm">
                                                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
                                                                {m.modelo}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">{m.total.toLocaleString('es-ES')}</TableCell>
                                                        <TableCell className="text-right">{formatNumber(m.tokensEntrada)}</TableCell>
                                                        <TableCell className="text-right">{formatNumber(m.tokensSalida)}</TableCell>
                                                        <TableCell className="text-right">{formatMs(m.duracionMediaMs)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                {/* Uso por día - Line */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Uso diario de IA (últimos 30 días)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ChartContainer config={{
                                            total: { label: "Peticiones", color: COLORS.green },
                                            tokensEntrada: { label: "Tokens entrada", color: COLORS.gray },
                                        }} className="h-[300px]">
                                            <LineChart data={modelosIA.usoPorDia}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <ChartTooltip content={<ChartTooltipContent />} />
                                                <Line type="monotone" dataKey="total" stroke={COLORS.green} strokeWidth={2} name="Peticiones" dot={false} />
                                            </LineChart>
                                        </ChartContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: INTENCIONES ===== */}
                    <TabsContent value="intenciones">
                        {loading && !intenciones ? <LoadingSkeleton /> : intenciones ? (
                            <div className="space-y-6">
                                {/* Tabla detallada intenciones */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Uso por tipo de intención</CardTitle>
                                        <CardDescription>Estadísticas de cada tipo de consulta al asistente</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Intención</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                    <TableHead className="text-right">Tokens entrada</TableHead>
                                                    <TableHead className="text-right">Tokens salida</TableHead>
                                                    <TableHead className="text-right">Duración media</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {intenciones.porIntencion.map((intent, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#94c120]/10 text-[#94c120]">
                                                                {getIntentLabel(intent.intencion)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">{intent.total.toLocaleString('es-ES')}</TableCell>
                                                        <TableCell className="text-right">{formatNumber(intent.tokensEntrada)}</TableCell>
                                                        <TableCell className="text-right">{formatNumber(intent.tokensSalida)}</TableCell>
                                                        <TableCell className="text-right">{formatMs(intent.duracionMediaMs)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                {/* Gráfico barras por intención */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Distribución por intención</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ChartContainer config={Object.fromEntries(intenciones.porIntencion.map((r, i) => [r.intencion, { label: getIntentLabel(r.intencion), color: PIE_COLORS[i % PIE_COLORS.length] }]))} className="h-[300px]">
                                            <BarChart data={intenciones.porIntencion.map(i => ({ ...i, label: getIntentLabel(i.intencion) }))}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <ChartTooltip content={<ChartTooltipContent />} />
                                                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                                    {intenciones.porIntencion.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                </Bar>
                                            </BarChart>
                                        </ChartContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: MARIADB ===== */}
                    <TabsContent value="base-datos">
                        {loading && !baseDatos ? <LoadingSkeleton /> : baseDatos ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <StatCard title="Total tablas" value={baseDatos.resumen.totalTablas} icon={Database} />
                                    <StatCard title="Registros totales" value={baseDatos.resumen.registrosTotales} icon={Database} />
                                    <StatCard title="Tamaño total" value={`${baseDatos.resumen.tamanoMB} MB`} icon={Database} />
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Detalles de tablas MariaDB</CardTitle>
                                        <CardDescription>Información detallada de cada tabla de la base de datos</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Tabla</TableHead>
                                                        <TableHead className="text-right">Registros</TableHead>
                                                        <TableHead className="text-right">Datos (KB)</TableHead>
                                                        <TableHead className="text-right">Índices (KB)</TableHead>
                                                        <TableHead className="text-right">Total (KB)</TableHead>
                                                        <TableHead>Motor</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {baseDatos.tablas.map((t, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell className="font-mono text-sm font-medium">{t.tabla}</TableCell>
                                                            <TableCell className="text-right">{t.registros.toLocaleString('es-ES')}</TableCell>
                                                            <TableCell className="text-right">{t.tamanoKB.toLocaleString('es-ES')}</TableCell>
                                                            <TableCell className="text-right">{t.indicesKB.toLocaleString('es-ES')}</TableCell>
                                                            <TableCell className="text-right font-semibold">{t.totalKB.toLocaleString('es-ES')}</TableCell>
                                                            <TableCell>
                                                                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                                    {t.motor}
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Gráfico de tamaño por tabla */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Tamaño por tabla</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ChartContainer config={{ totalKB: { label: "Tamaño (KB)", color: COLORS.green } }} className="h-[300px]">
                                            <BarChart data={baseDatos.tablas} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                                <YAxis dataKey="tabla" type="category" tick={{ fontSize: 10 }} width={150} />
                                                <ChartTooltip content={<ChartTooltipContent />} />
                                                <Bar dataKey="totalKB" fill={COLORS.green} radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ChartContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: CHROMADB ===== */}
                    <TabsContent value="chromadb">
                        {loading && !chromaDB ? <LoadingSkeleton /> : chromaDB ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard
                                        title="Estado ChromaDB"
                                        value={chromaDB.chromaDisponible ? "Conectado" : "No disponible"}
                                        icon={Database}
                                    />
                                    <StatCard title="Colecciones" value={chromaDB.colecciones.length} icon={Database} />
                                    <StatCard title="Docs vectoriales" value={chromaDB.totalDocumentosVectoriales} icon={FileText} />
                                    <StatCard title="Docs MariaDB" value={chromaDB.documentos.total} description={`${chromaDB.documentos.tamanoTotalMB} MB`} icon={FileText} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Colecciones */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Colecciones ChromaDB</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Colección</TableHead>
                                                        <TableHead className="text-right">Documentos</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {chromaDB.colecciones.map((c, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell className="font-mono text-sm">{c.nombre}</TableCell>
                                                            <TableCell className="text-right font-semibold">
                                                                {c.documentos >= 0 ? c.documentos : 'Error'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>

                                    {/* Estado de procesamiento */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Estado de procesamiento</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div>
                                                <h4 className="text-sm font-medium mb-3">Documentos</h4>
                                                {chromaDB.documentos.porEstado.map((d, i) => (
                                                    <div key={i} className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">{d.estado}</span>
                                                        <span className="font-semibold text-sm">{d.total}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <Separator />
                                            <div>
                                                <h4 className="text-sm font-medium mb-3">Fuentes web</h4>
                                                {chromaDB.fuentesWeb.porEstado.map((f, i) => (
                                                    <div key={i} className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">{f.estado}</span>
                                                        <span className="font-semibold text-sm">{f.total}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: HERRAMIENTAS ===== */}
                    <TabsContent value="herramientas">
                        {loading && !herramientas ? <LoadingSkeleton /> : herramientas ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <StatCard title="Usos de Canvas" value={herramientas.canvas.total} icon={Wrench} />
                                    <StatCard title="% respuestas con Canvas" value={`${herramientas.canvas.porcentaje}%`} icon={Wrench} />
                                    <StatCard title="Docs subidos (6 meses)" value={herramientas.documentos.porMes.reduce((a, b) => a + b.total, 0)} icon={FileText} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Canvas por mes - Bar */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Uso de Canvas por mes</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{ total: { label: "Canvas", color: COLORS.green } }} className="h-[250px]">
                                                <BarChart data={herramientas.canvas.porMes}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="total" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Documentos subidos por mes */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Documentos subidos por mes</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={{ total: { label: "Documentos", color: COLORS.black } }} className="h-[250px]">
                                                <BarChart data={herramientas.documentos.porMes}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grayLight} />
                                                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="total" fill={COLORS.black} radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Canvas por usuario */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Top usuarios con Canvas</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead className="text-right">Usos Canvas</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {herramientas.canvas.porUsuario.map((u, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium">{u.nombre}</TableCell>
                                                        <TableCell className="text-gray-500">{u.email}</TableCell>
                                                        <TableCell className="text-right font-semibold">{u.total}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>

                    {/* ===== TAB: FEEDBACK ===== */}
                    <TabsContent value="feedback">
                        {loading ? <LoadingSkeleton /> : feedback ? (
                            <div className="space-y-6">
                                {/* Tarjetas resumen */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <StatCard title="Total feedback" value={feedback.total} icon={MessageSquare} />
                                    <StatCard title="Positivos" value={feedback.positivos} description={`${feedback.porcentajePositivo}% del total`} icon={ThumbsUp} />
                                    <StatCard title="Negativos" value={feedback.negativos} icon={ThumbsDown} />
                                    <Card className="border-gray-200 dark:border-gray-700">
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Satisfacción</CardTitle>
                                            <ThumbsUp className="h-4 w-4 text-[#94c120]" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{feedback.porcentajePositivo}%</div>
                                            <Progress value={feedback.porcentajePositivo} className="mt-2 h-2" />
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Feedback por intención */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Feedback por intención</CardTitle>
                                            <CardDescription>Distribución de valoraciones por tipo de contenido</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {feedback.feedbackPorIntencion.length > 0 ? (
                                                <ChartContainer config={{ positivos: { label: "Positivos", color: COLORS.green }, negativos: { label: "Negativos", color: COLORS.gray } } satisfies ChartConfig} className="h-[300px] w-full">
                                                    <BarChart data={feedback.feedbackPorIntencion.map(i => ({ ...i, intencion: getIntentLabel(i.intencion) }))}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="intencion" tick={{ fontSize: 11 }} />
                                                        <YAxis />
                                                        <ChartTooltip content={<ChartTooltipContent />} />
                                                        <Bar dataKey="positivos" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                                                        <Bar dataKey="negativos" fill={COLORS.gray} radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ChartContainer>
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-8">Aún no hay datos de feedback.</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Distribución positivo/negativo */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Distribución general</CardTitle>
                                            <CardDescription>Proporción de valoraciones positivas y negativas</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex items-center justify-center">
                                            {feedback.total > 0 ? (
                                                <ChartContainer config={{ positivos: { label: "Positivos", color: COLORS.green }, negativos: { label: "Negativos", color: COLORS.gray } } satisfies ChartConfig} className="h-[300px] w-full">
                                                    <PieChart>
                                                        <Pie
                                                            data={[
                                                                { name: "Positivos", value: feedback.positivos },
                                                                { name: "Negativos", value: feedback.negativos },
                                                            ]}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={100}
                                                            dataKey="value"
                                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                        >
                                                            <Cell fill={COLORS.green} />
                                                            <Cell fill={COLORS.gray} />
                                                        </Pie>
                                                        <ChartTooltip content={<ChartTooltipContent />} />
                                                    </PieChart>
                                                </ChartContainer>
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-8">Aún no hay datos de feedback.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Feedback reciente */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Feedback reciente</CardTitle>
                                        <CardDescription>Últimas valoraciones de los usuarios</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[80px]">Tipo</TableHead>
                                                    <TableHead>Usuario</TableHead>
                                                    <TableHead>Intención</TableHead>
                                                    <TableHead>Extracto del mensaje</TableHead>
                                                    <TableHead className="text-right">Fecha</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {feedback.recientes.map((f) => (
                                                    <TableRow key={f.id}>
                                                        <TableCell>
                                                            {f.tipo === "POSITIVO" ? (
                                                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                                                    <ThumbsUp className="h-3.5 w-3.5" /> Bien
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                                                    <ThumbsDown className="h-3.5 w-3.5" /> Mal
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {f.usuario ? `${f.usuario.nombre} ${f.usuario.apellidos}`.trim() : "—"}
                                                        </TableCell>
                                                        <TableCell>{f.intencion ? getIntentLabel(f.intencion) : "—"}</TableCell>
                                                        <TableCell className="text-gray-500 text-xs max-w-[300px] truncate">
                                                            {f.mensaje?.content || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-gray-500">
                                                            {new Date(f.fechaCreacion).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}
