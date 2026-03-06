"use client"

import Image from "next/image"
import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useTranslations } from "next-intl"
import {
    Activity,
    Archive,
    BookOpen,
    ChevronsLeft,
    ChevronsRight,
    LogOut,
    ListTodo,
    Mail,
    MessageSquare,
    MoreHorizontal,
    Send,
    Share2,
    Sparkles,
    CalendarClock,
    Trash2,
    AlertTriangle,
    Plus,
    PenSquare,
    PartyPopper,
    FileText,
    Download,
    Info,
    Brain,
    User,
    Settings,
    ChevronRight,
    ChevronDown,
    FileStack,
    UserCog,
    Users,
    Search,
    Paperclip,
    Wrench,
    Tag,
    Mic,
    Square,
    PenLine,
    Pin,
    PinOff,
    Flame,
    BookMarked,
    BarChart3,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    RotateCcw,
    Type,
    Plug,
    X,
    HardDrive,
    Upload,
    Camera,
    FolderOpen,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { cn, buildApiUrl } from "@/lib/utils"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { LanguageSelector } from "@/components/language-selector"
import { UsageStats } from "@/components/usage-stats"
import { downloadAsPDF, downloadAsWord, stripSourcesSection, extractSourcesText } from "@/lib/document-generator"
import { ChangePasswordModal } from "@/components/change-password-modal"
import { ConnectoresPanel } from "@/components/conectores-panel"
import { CanvasDialog } from "@/components/canvas"
import { ShareDialog } from "@/components/share-dialog"
import { useLocale, formatRelativeTime, type Locale } from "@/lib/locale-context"
import { useToast } from "@/hooks/use-toast"

import { GoogleDrivePicker } from "@/components/google-drive-picker"
import { useCarpetas, type Carpeta } from "@/hooks/use-carpetas"
import { CarpetasSidebar } from "@/components/carpetas-sidebar"
import { CarpetaDialog } from "@/components/carpeta-dialog"
import { CarpetaShareDialog } from "@/components/carpeta-share-dialog"

type MessageRole = "usuario" | "asistente"

type ChatMessage = {
    id: string
    role: MessageRole
    content: string
    createdAt?: string
    pending?: boolean
    isWorkContent?: boolean
}

type Chat = {
    id: string
    conversationId: string | null
    title: string
    createdAt: Date
    messages: ChatMessage[]
    archived?: boolean
    pinned?: boolean
    intent?: string | null
    hasLoaded?: boolean
    isLoading?: boolean
    esCompartida?: boolean
    compartidaDesde?: string | null
    compartidaNombre?: string | null
    carpetaId?: string | null
}

type QuickPrompt = {
    label: string
    icon: LucideIcon
    template: string
    intent: string
    tags: string[]
    subOptions?: QuickPromptSubOption[]
}

type QuickPromptSubOption = {
    label: string
    icon: LucideIcon
    template: string
    intent: string
    tags: string[]
}

function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatChatTitle(date: Date, locale: string = 'es'): string {
    // Map locale to Intl locale code
    const localeMap: Record<string, string> = {
        es: 'es-ES',
        en: 'en-GB',
        fr: 'fr-FR',
        it: 'it-IT',
        pt: 'pt-PT',
        hu: 'hu-HU',
        pl: 'pl-PL',
        ca: 'ca-ES',
        gl: 'gl-ES',
        eu: 'eu-ES',
    }
    const intlLocale = localeMap[locale] || 'es-ES'
    const formattedDate = date.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "2-digit" })
    const formattedTime = date.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit", hour12: false })
    return `Chat ${formattedDate} - ${formattedTime}h`
}

function createLocalChat(): Chat {
    const createdAt = new Date()
    return {
        id: createId(),
        conversationId: null,
        createdAt,
        title: formatChatTitle(createdAt),
        messages: [],
        hasLoaded: true,
        intent: null,
    }
}

function toFrontendRole(role: string | null | undefined): MessageRole {
    if (role === "assistant") return "asistente"
    return "usuario"
}

type ProfileFormState = {
    nombre: string
    apellidos: string
    telefono: string
    organizacion: string
    cargo: string
    experiencia: string
    avatarUrl: string
}

export default function ChatHomePage() {
    const router = useRouter()
    const { user, status, isAuthenticated, token, logout, updateProfile, refreshUser } = useAuth()
    const t = useTranslations()
    const { locale, setLocale, locales, localeNames } = useLocale()
    const { toast } = useToast()

    // Estado para feedback de mensajes (mensajeId -> 'POSITIVO' | 'NEGATIVO')
    const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({})
    // Estado para copiar al portapapeles
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

    // Fuente del chat
    const chatFont = user?.fuenteChat || "inter"
    const fontClassMap: Record<string, string> = {
        "inter": "font-sans",
        "dm-sans": "font-[family-name:var(--font-dm-sans)]",
        "lora": "font-[family-name:var(--font-lora)]",
        "lexend": "font-[family-name:var(--font-lexend)]",
    }

    // Sync locale with user's language preference
    useEffect(() => {
        if (user?.idioma && user.idioma !== locale) {
            setLocale(user.idioma as Locale)
        }
    }, [user?.idioma, locale, setLocale])

    const [chats, setChats] = useState<Chat[]>([])
    const [activeChatId, setActiveChatId] = useState<string>("")
    const [inputValue, setInputValue] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isChatsListCollapsed, setIsChatsListCollapsed] = useState(false)
    const [loadingConversations, setLoadingConversations] = useState(false)
    const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false)
    const [chatError, _setChatError] = useState<string | null>(null)
    const setChatError = useCallback((msg: string | null) => {
        _setChatError(msg)
        if (msg) {
            toast({ variant: "destructive", title: "Error", description: msg })
        }
    }, [toast])
    const showLimitDialog = useCallback((message: string) => {
        setLimitDialogMessage(message)
        setLimitDialogOpen(true)
    }, [])
    const [shareFeedback, setShareFeedback] = useState<string | null>(null)
    const [shareDialogOpen, setShareDialogOpen] = useState(false)
    const [shareMessageContent, setShareMessageContent] = useState("")
    const [shareConversationTitle, setShareConversationTitle] = useState("")
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
    const [isArchivedDialogOpen, setIsArchivedDialogOpen] = useState(false)
    const [profileForm, setProfileForm] = useState<ProfileFormState>({
        nombre: "",
        apellidos: "",
        telefono: "",
        organizacion: "",
        cargo: "",
        experiencia: "",
        avatarUrl: "",
    })
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileFeedback, setProfileFeedback] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [chatPendingDeletion, setChatPendingDeletion] = useState<Chat | null>(null)
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
    const [settingsTab, setSettingsTab] = useState<"general" | "conectores">("general")
    const [isDeletingChat, setIsDeletingChat] = useState(false)
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false)
    const [limitDialogOpen, setLimitDialogOpen] = useState(false)
    const [limitDialogMessage, setLimitDialogMessage] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Chat[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [renamingChatId, setRenamingChatId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const activeChatIdRef = useRef<string>("")
    const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
    const quickPrompts = useMemo<QuickPrompt[]>(
        () => [
            {
                label: t("categories.dynamics"),
                icon: Activity,
                template: t("categories.dynamicsTemplate"),
                intent: "DINAMICA",
                tags: ["DINAMICAS"],
            },
            {
                label: t("categories.prayers"),
                icon: BookOpen,
                template: t("categories.prayersTemplate"),
                intent: "ORACION_PERSONAL",
                tags: ["ORACIONES"],
                subOptions: [
                    {
                        label: t("categories.personalPrayer"),
                        icon: User,
                        template: t("categories.personalPrayerTemplate"),
                        intent: "ORACION_PERSONAL",
                        tags: ["ORACIONES"],
                    },
                    {
                        label: t("categories.groupPrayer"),
                        icon: Users,
                        template: t("categories.groupPrayerTemplate"),
                        intent: "ORACION_GRUPAL",
                        tags: ["ORACIONES"],
                    },
                ],
            },
            {
                label: t("categories.celebrations"),
                icon: PartyPopper,
                template: t("categories.celebrationsTemplate"),
                intent: "EUCARISTIA",
                tags: ["CELEBRACIONES"],
                subOptions: [
                    {
                        label: t("categories.eucharist"),
                        icon: Flame,
                        template: t("categories.eucharistTemplate"),
                        intent: "EUCARISTIA",
                        tags: ["CELEBRACIONES"],
                    },
                    {
                        label: t("categories.wordCelebration"),
                        icon: BookMarked,
                        template: t("categories.wordCelebrationTemplate"),
                        intent: "CELEBRACION_PALABRA",
                        tags: ["CELEBRACIONES"],
                    },
                ],
            },
            {
                label: t("categories.programming"),
                icon: CalendarClock,
                template: t("categories.programmingTemplate"),
                intent: "PROGRAMACION",
                tags: ["PROGRAMACIONES"],
            },
            {
                label: t("categories.consultation"),
                icon: FileText,
                template: t("categories.consultationTemplate"),
                intent: "OTROS",
                tags: ["OTROS", "CONTENIDO_MIXTO"],
            },
        ],
        [t],
    )
    const [selectedQuickPrompts, setSelectedQuickPrompts] = useState<string[]>([])
    const [openSubMenuLabel, setOpenSubMenuLabel] = useState<string | null>(null)
    const [selectedSubOption, setSelectedSubOption] = useState<Record<string, QuickPromptSubOption | null>>({})
    const [isThinkingMode, setIsThinkingMode] = useState(false)
    const [isCanvasMode, setIsCanvasMode] = useState(false)
    const [hasActiveGoogleDrive, setHasActiveGoogleDrive] = useState(false)
    const [hasActiveGoogleDocs, setHasActiveGoogleDocs] = useState(false)
    const [googleDriveToolEnabled, setGoogleDriveToolEnabled] = useState(false)
    const [googleDocsToolEnabled, setGoogleDocsToolEnabled] = useState(false)
    const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false)
    const [canvasOpen, setCanvasOpen] = useState(false)
    const [canvasContent, setCanvasContent] = useState("")
    const [canvasMessageId, setCanvasMessageId] = useState<string | null>(null)
    const [attachedFiles, setAttachedFiles] = useState<Array<{
        fileName: string
        mimeType: string
        size: number
        file?: File
        text?: string
        wordCount?: number
    }>>([])
    const [isUploadingFiles, setIsUploadingFiles] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const initialChatCreatedRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)
    const lastPromptRef = useRef<string>("")

    const selectedQuickPromptItems = useMemo(() => {
        const labelSet = new Set(selectedQuickPrompts)
        const items = quickPrompts.filter((prompt) => labelSet.has(prompt.label))
        // Si hay oración seleccionada con sub-tipo, usar el intent/tags/label del sub-tipo
        return items.map(item => {
            if (item.subOptions && selectedSubOption[item.label]) {
                const sub = selectedSubOption[item.label]!
                return { ...item, label: sub.label, icon: sub.icon, intent: sub.intent, tags: sub.tags, _parentLabel: item.label }
            }
            return item
        })
    }, [quickPrompts, selectedQuickPrompts, selectedSubOption])

    const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? null, [chats, activeChatId])
    const sidebarChats = useMemo(() => {
        const visible = chats.filter((chat) => !chat.archived && !chat.carpetaId)
        // Cargar pins desde localStorage
        let pinnedIds: string[] = []
        try {
            const stored = localStorage.getItem("pinnedChats")
            pinnedIds = stored ? JSON.parse(stored) : []
        } catch { /* ignore */ }
        // Separar fijados y no fijados
        const pinned = visible.filter((c) => pinnedIds.includes(c.conversationId ?? c.id))
        const unpinned = visible.filter((c) => !pinnedIds.includes(c.conversationId ?? c.id))
        // Fijados primero (más nuevos arriba), luego el resto
        return [...pinned.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), ...unpinned]
    }, [chats])
    const archivedChats = useMemo(() => chats.filter((chat) => chat.archived), [chats])
    const messageCount = activeChat?.messages.length ?? 0

    const initials = useMemo(() => {
        if (!user) return "TÚ"

        const firstNameInitial = user.nombre?.trim().split(/\s+/)[0]?.charAt(0).toUpperCase()
        const firstSurnameInitial = user.apellidos?.trim().split(/\s+/)[0]?.charAt(0).toUpperCase()

        if (firstNameInitial && firstSurnameInitial) {
            return `${firstNameInitial}${firstSurnameInitial}`
        }

        if (firstNameInitial) {
            return firstNameInitial
        }

        if (user.email) {
            return user.email.charAt(0).toUpperCase()
        }

        return "US"
    }, [user])

    const userRole = user?.rol ?? ""
    const tipoSuscripcion = user?.tipoSuscripcion ?? "FREE"
    const canAccessDocumentation = ["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR"].includes(userRole)
    const canAccessAdministration = ["SUPERADMIN", "ADMINISTRADOR"].includes(userRole)
    const canShowOptions = canAccessDocumentation || canAccessAdministration

    // Determinar si el usuario tiene acceso a herramientas
    // Disponible para todos los usuarios autenticados
    const hasTools = useMemo(() => {
        return true
    }, [])

    // Determinar si el usuario puede usar el modo Deep Think
    // Disponible para todos los usuarios autenticados
    const canUseThinkingMode = useMemo(() => {
        return true
    }, [])

    // ── Carpetas de trabajo (disponible para todos) ──
    const isProUser = useMemo(() => {
        return true
    }, [])

    const carpetasHook = useCarpetas(token ?? null, isProUser)
    const [carpetaDialogOpen, setCarpetaDialogOpen] = useState(false)
    const [carpetaEditing, setCarpetaEditing] = useState<Carpeta | null>(null)
    const [carpetaShareDialogOpen, setCarpetaShareDialogOpen] = useState(false)
    const [carpetaSharing, setCarpetaSharing] = useState<Carpeta | null>(null)
    const [carpetaSaving, setCarpetaSaving] = useState(false)

    const handleCreateFolder = useCallback(() => {
        setCarpetaEditing(null)
        setCarpetaDialogOpen(true)
    }, [])

    const handleEditFolder = useCallback((carpeta: Carpeta) => {
        setCarpetaEditing(carpeta)
        setCarpetaDialogOpen(true)
    }, [])

    const handleShareFolder = useCallback((carpeta: Carpeta) => {
        setCarpetaSharing(carpeta)
        setCarpetaShareDialogOpen(true)
    }, [])

    const handleDeleteFolder = useCallback(async (carpetaId: string) => {
        if (!confirm(t("folders.confirmDelete"))) return
        await carpetasHook.eliminarCarpeta(carpetaId)
    }, [carpetasHook, t])

    const handleSaveFolder = useCallback(async (nombre: string, icono: string, color: string) => {
        setCarpetaSaving(true)
        try {
            if (carpetaEditing) {
                await carpetasHook.actualizarCarpeta(carpetaEditing.id, { nombre, icono, color })
            } else {
                await carpetasHook.crearCarpeta(nombre, icono, color)
            }
            setCarpetaDialogOpen(false)
        } finally {
            setCarpetaSaving(false)
        }
    }, [carpetaEditing, carpetasHook])

    const handleAddChatToFolder = useCallback(async (carpetaId: string, conversacionId: string) => {
        const ok = await carpetasHook.addConversacion(carpetaId, conversacionId)
        if (ok) {
            // Actualizar carpetaId en el estado local para que desaparezca de "Conversaciones"
            setChats((prev) => prev.map((c) => c.conversationId === conversacionId ? { ...c, carpetaId } : c))
        }
    }, [carpetasHook])

    const handleRemoveChatFromFolder = useCallback(async (carpetaId: string, convId: string) => {
        const ok = await carpetasHook.removeConversacion(carpetaId, convId)
        if (ok) {
            // Quitar carpetaId para que reaparezca en "Conversaciones"
            setChats((prev) => prev.map((c) => c.conversationId === convId ? { ...c, carpetaId: null } : c))
        }
    }, [carpetasHook])

    const handleFolderChatSelect = useCallback((conversationId: string) => {
        // Buscar chat por conversationId
        const chat = chats.find(c => c.conversationId === conversationId)
        if (chat) {
            setActiveChatId(chat.id)
        }
    }, [chats])

    const { mustChangePassword, clearPasswordChangeFlag } = useAuth()

    // Resetear el flag de chat inicial cuando el usuario se desautentica
    useEffect(() => {
        if (status === "unauthenticated") {
            initialChatCreatedRef.current = false
            setHasInitialLoadCompleted(false)
            router.replace("/auth/login")
        }
    }, [router, status])

    // Detectar redirección de OAuth de conectores (?connector=google-drive&status=...)
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const connector = params.get("connector")
        const connectorStatus = params.get("status")
        if (!connector) return

        // Limpiar params de la URL sin recarga
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, "", cleanUrl)

        if (connectorStatus === "success") {
            // Abrir configuración en la pestaña Conectores para confirmación visual
            setSettingsTab("conectores")
            setIsSettingsDialogOpen(true)
            if (connector === "google-drive") {
                setHasActiveGoogleDrive(true)
            } else if (connector === "google-docs") {
                setHasActiveGoogleDocs(true)
            }
        }
    }, [])

    // Comprobar si el usuario tiene conectores activos
    useEffect(() => {
        if (!token || !hasTools) return
        fetch(buildApiUrl("/api/conectores"), {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                if (!data?.conectores) return
                const gdrive = data.conectores.find(
                    (c: { tipo: string; estado: string }) => c.tipo === "GOOGLE_DRIVE" && c.estado === "ACTIVO"
                )
                setHasActiveGoogleDrive(!!gdrive)
                const gdocs = data.conectores.find(
                    (c: { tipo: string; estado: string }) => c.tipo === "GOOGLE_DOCS" && c.estado === "ACTIVO"
                )
                setHasActiveGoogleDocs(!!gdocs)
            })
            .catch(() => {})
    }, [token, hasTools])


    useEffect(() => {
        if (!activeChatId) {
            const firstActiveChat = chats.find((chat) => !chat.archived)
            if (firstActiveChat) {
                setActiveChatId(firstActiveChat.id)
            }
        }
    }, [activeChatId, chats])

    useEffect(() => {
        // Solo crear el chat inicial una vez que:
        // 1. El usuario esté autenticado
        // 2. Se haya completado la carga inicial de conversaciones
        // 3. No existan conversaciones previas
        // 4. No se haya creado ya un chat inicial en esta sesión
        if (
            status === "authenticated" &&
            hasInitialLoadCompleted &&
            chats.length === 0 &&
            token &&
            !initialChatCreatedRef.current
        ) {
            initialChatCreatedRef.current = true

            const newChat = createLocalChat()
            setChats([newChat])
            setActiveChatId(newChat.id)

            // Crear la conversación en el backend inmediatamente para generar el saludo
            const createInitialConversation = async () => {
                try {
                    const response = await fetch(buildApiUrl("/api/chat/create"), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            intent: null,
                        }),
                    })

                    if (response.status === 429) {
                        // Límite alcanzado: eliminar el chat local optimista
                        const errorData = await response.json().catch(() => null)
                        setChats((prevChats) => prevChats.filter((c) => c.id !== newChat.id))
                        setActiveChatId("")
                        showLimitDialog(errorData?.message || "Has alcanzado el límite de conversaciones.")
                        return
                    }

                    if (response.ok) {
                        const data = await response.json()

                        setChats((prevChats) =>
                            prevChats.map((chat) =>
                                chat.id === newChat.id
                                    ? {
                                        ...chat,
                                        conversationId: data.conversationId,
                                        intent: data.intent,
                                        messages: data.messages.map((msg: any) => ({
                                            id: msg.id,
                                            role: toFrontendRole(msg.role),
                                            content: msg.content,
                                            createdAt: msg.fechaCreacion,
                                        })),
                                        hasLoaded: true,
                                    }
                                    : chat,
                            ),
                        )
                    }
                } catch (error) {
                    console.error("Error creando conversación inicial:", error)
                }
            }

            void createInitialConversation()
        }
    }, [hasInitialLoadCompleted, status, token])

    useEffect(() => {
        activeChatIdRef.current = activeChatId
    }, [activeChatId])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messageCount, isThinking, activeChatId])


    useEffect(() => {
        if (!shareFeedback) return

        const timeout = setTimeout(() => setShareFeedback(null), 2800)
        return () => clearTimeout(timeout)
    }, [shareFeedback])

    useEffect(() => {
        if (isUserDialogOpen) {
            setProfileForm({
                nombre: user?.nombre ?? "",
                apellidos: user?.apellidos ?? "",
                telefono: user?.telefono ?? "",
                organizacion: user?.organizacion ?? "",
                cargo: user?.cargo ?? "",
                experiencia: typeof user?.experiencia === "number" ? String(user?.experiencia) : "",
                avatarUrl: user?.avatarUrl ?? "",
            })
            setProfileFeedback(null)
        }
    }, [isUserDialogOpen, user])

    useEffect(() => {
        if (!profileFeedback) return

        const timeout = setTimeout(() => setProfileFeedback(null), 3000)
        return () => clearTimeout(timeout)
    }, [profileFeedback])

    const fetchConversations = useCallback(async () => {
        if (!token) return

        setLoadingConversations(true)
        setChatError(null)

        try {
            const response = await fetch(buildApiUrl("/api/chat"), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            })

            if (!response.ok) {
                if (response.status === 401) {
                    logout()
                    return
                }
                const body = await response.json().catch(() => null)
                const message = body?.message || body?.error || "No se pudieron cargar las conversaciones"
                throw new Error(message)
            }

            const data = await response.json()
            const conversations: Array<any> = Array.isArray(data?.conversations) ? data.conversations : []
            let nextChats: Chat[] = []

            setChats((prevChats) => {
                const unsaved = prevChats.filter((chat) => !chat.conversationId)
                const existingMap = new Map(
                    prevChats
                        .filter((chat) => chat.conversationId)
                        .map((chat) => [chat.conversationId as string, chat]),
                )

                const mapped = conversations.map((conversation) => {
                    const createdAt = conversation.fechaCreacion ? new Date(conversation.fechaCreacion) : new Date()
                    const existing = existingMap.get(conversation.id)

                    if (existing) {
                        return {
                            ...existing,
                            conversationId: conversation.id,
                            title: conversation.titulo ?? existing.title,
                            intent: conversation.intencionPrincipal ?? existing.intent,
                            esCompartida: conversation.esCompartida ?? false,
                            compartidaDesde: conversation.compartidaDesde ?? null,
                            compartidaNombre: conversation.compartidaNombre ?? null,
                            carpetaId: conversation.carpetaId ?? null,
                            createdAt,
                        }
                    }

                    return {
                        id: conversation.id,
                        conversationId: conversation.id,
                        title: conversation.titulo ?? formatChatTitle(createdAt),
                        createdAt,
                        messages: [],
                        hasLoaded: false,
                        intent: conversation.intencionPrincipal ?? null,
                        esCompartida: conversation.esCompartida ?? false,
                        compartidaDesde: conversation.compartidaDesde ?? null,
                        compartidaNombre: conversation.compartidaNombre ?? null,
                        carpetaId: conversation.carpetaId ?? null,
                    } satisfies Chat
                })

                nextChats = [...unsaved, ...mapped]
                return nextChats
            })

            // Marcar que la carga inicial se ha completado
            setHasInitialLoadCompleted(true)

            // Si hay conversaciones existentes, marcar que ya no necesitamos crear el chat inicial
            if (conversations.length > 0) {
                initialChatCreatedRef.current = true
            }

            if (!activeChatIdRef.current && nextChats.length > 0) {
                setActiveChatId(nextChats[0]?.id ?? "")
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudieron cargar las conversaciones"
            setChatError(message)
        } finally {
            setLoadingConversations(false)
        }
    }, [token])

    const loadConversationMessages = useCallback(async (conversationId: string) => {
        if (!token || !conversationId) return

        setChats((prevChats) =>
            prevChats.map((chat) =>
                chat.conversationId === conversationId
                    ? { ...chat, isLoading: true }
                    : chat,
            ),
        )

        try {
            const response = await fetch(buildApiUrl(`/api/chat/${conversationId}`), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            })

            if (!response.ok) {
                if (response.status === 401) {
                    logout()
                    return
                }
                const body = await response.json().catch(() => null)
                const message = body?.message || body?.error || "No se pudo cargar la conversación"
                throw new Error(message)
            }

            const data = await response.json()
            const conversation = data?.conversation
            const messages: ChatMessage[] = Array.isArray(data?.messages)
                ? data.messages.map((msg: any) => ({
                    id: msg.id,
                    role: toFrontendRole(msg.role),
                    content: msg.content,
                    isWorkContent: msg.isWorkContent ?? undefined,
                    createdAt: msg.fechaCreacion,
                }))
                : []

            // Cargar feedback existente del usuario para los mensajes de esta conversación
            if (token) {
                try {
                    const assistantMsgIds = messages.filter(m => m.role === "asistente").map(m => m.id)
                    if (assistantMsgIds.length > 0) {
                        const fbResponse = await fetch(buildApiUrl(`/api/feedback/by-messages`), {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ messageIds: assistantMsgIds }),
                        })
                        if (fbResponse.ok) {
                            const fbData = await fbResponse.json()
                            if (fbData.feedbacks && typeof fbData.feedbacks === "object") {
                                setFeedbackMap(prev => ({ ...prev, ...fbData.feedbacks }))
                            }
                        }
                    }
                } catch { /* feedback load is non-critical */ }
            }

            setChats((prevChats) =>
                prevChats.map((chat) => {
                    if (chat.conversationId !== conversationId) {
                        return chat
                    }

                    return {
                        ...chat,
                        messages: messages.length > 0 ? messages : chat.messages,
                        hasLoaded: true,
                        isLoading: false,
                        intent: conversation?.intencionPrincipal ?? chat.intent ?? null,
                        title: conversation?.titulo ?? chat.title,
                    }
                }),
            )
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo cargar la conversación"
            setChatError(message)
            setChats((prevChats) =>
                prevChats.map((chat) =>
                    chat.conversationId === conversationId
                        ? { ...chat, isLoading: false }
                        : chat,
                ),
            )
        }
    }, [token])

    const submitPrompt = useCallback(async () => {
        if (!inputValue.trim() || isThinking || !activeChat) {
            return
        }

        if (!token) {
            setChatError("No hay sesión activa")
            return
        }

        const prompt = inputValue.trim()
        lastPromptRef.current = prompt
        setInputValue("")
        setChatError(null)

        // Crear AbortController para poder cancelar la petición
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        const chatId = activeChat.id
        let currentConversationId = activeChat.conversationId

        // Determinar intent y tags basados en quickPrompts seleccionados
        let intentToSend = activeChat.intent
        let tagsToSend: string[] = []

        if (selectedQuickPromptItems.length > 0) {
            // Usar el intent del primer prompt seleccionado
            intentToSend = selectedQuickPromptItems[0].intent
            // Recopilar todos los tags de los prompts seleccionados
            tagsToSend = Array.from(
                new Set(selectedQuickPromptItems.flatMap(item => item.tags))
            )
        }

        const userMessage: ChatMessage = {
            id: createId(),
            role: "usuario",
            content: prompt,
            createdAt: new Date().toISOString(),
        }

        setChats((prevChats) =>
            prevChats.map((chat) =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: [...chat.messages, userMessage],
                        intent: intentToSend, // Actualizar intent del chat
                    }
                    : chat,
            ),
        )

        setIsThinking(true)

        try {
            // Subir archivos primero si los hay
            let uploadedFiles = []
            if (attachedFiles.length > 0 && attachedFiles.some(f => f.file)) {
                setIsUploadingFiles(true)

                // Crear el mensaje primero para tener conversationId
                const initialResponse = await fetch(buildApiUrl("/api/chat"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        conversationId: currentConversationId,
                        message: prompt,
                        intent: intentToSend,
                        tags: tagsToSend.length > 0 ? tagsToSend : undefined,
                        useThinkingModel: isThinkingMode,
                    }),
                    signal: abortController.signal,
                })

                const initialData = await initialResponse.json().catch(() => null)

                if (initialResponse.status === 429) {
                    // Límite alcanzado: eliminar el mensaje optimista del usuario
                    setChats((prevChats) =>
                        prevChats.map((chat) =>
                            chat.id === chatId
                                ? { ...chat, messages: chat.messages.filter((m) => m.id !== userMessage.id) }
                                : chat,
                        ),
                    )
                    setIsUploadingFiles(false)
                    showLimitDialog(initialData?.message || "Has alcanzado el límite de mensajes diarios.")
                    setIsThinking(false)
                    return
                }

                if (initialResponse.ok && initialData?.conversationId) {
                    currentConversationId = initialData.conversationId

                    // Actualizar el chat con la conversationId
                    setChats((prevChats) =>
                        prevChats.map((chat) =>
                            chat.id === chatId
                                ? {
                                    ...chat,
                                    conversationId: currentConversationId,
                                    intent: initialData.intent ?? chat.intent ?? null,
                                    title: initialData.title ?? chat.title,
                                    messages: [...chat.messages, {
                                        id: initialData.message?.id || createId(),
                                        role: "asistente",
                                        content: initialData.message?.content || "",
                                        createdAt: new Date().toISOString(),
                                    }],
                                    hasLoaded: true,
                                }
                                : chat,
                        ),
                    )

                    // Ahora subir archivos con el conversationId
                    const formData = new FormData()
                    formData.append('conversationId', currentConversationId || '')

                    attachedFiles.forEach(file => {
                        if (file.file) {
                            formData.append('files', file.file)
                        }
                    })

                    const uploadResponse = await fetch(buildApiUrl("/api/files/upload"), {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                        signal: abortController.signal,
                    })

                    const uploadData = await uploadResponse.json()

                    if (uploadResponse.ok && uploadData.files) {
                        uploadedFiles = uploadData.files
                    }

                    setIsUploadingFiles(false)
                    setAttachedFiles([])

                    if (!currentConversationId) {
                        fetchConversations()
                        // Cargar los mensajes completos de la conversación recién creada
                        // para incluir el saludo inicial de Gemma
                        setTimeout(() => {
                            loadConversationMessages(initialData.conversationId)
                        }, 500)
                    }

                    setIsThinking(false)
                    return
                }

                setIsUploadingFiles(false)
            }

            // Si no hay archivos o ya se procesaron, enviar mensaje normal
            const response = await fetch(buildApiUrl("/api/chat"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    conversationId: currentConversationId,
                    message: prompt,
                    intent: intentToSend,
                    tags: tagsToSend.length > 0 ? tagsToSend : undefined,
                    useThinkingModel: isThinkingMode,
                    canvasMode: isCanvasMode || undefined,
                    useGoogleDriveTools: hasActiveGoogleDrive && googleDriveToolEnabled ? true : false,
                    useGoogleDocsTools: hasActiveGoogleDocs && googleDocsToolEnabled ? true : false,
                }),
                signal: abortController.signal,
            })

            const data = await response.json().catch(() => null)

            if (response.status === 429) {
                // Límite alcanzado: eliminar el mensaje optimista del usuario
                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === chatId
                            ? { ...chat, messages: chat.messages.filter((m) => m.id !== userMessage.id) }
                            : chat,
                    ),
                )
                showLimitDialog(data?.message || "Has alcanzado el límite de mensajes diarios.")
                setIsThinking(false)
                return
            }

            if (!response.ok || !data?.message?.content) {
                const message = data?.message || data?.error || "No se pudo generar la respuesta"
                throw new Error(typeof message === "string" ? message : "No se pudo generar la respuesta")
            }

            const assistantMessage: ChatMessage = {
                id: data.message.id || createId(),
                role: "asistente",
                content: data.message.content,
                isWorkContent: data.message.isWorkContent ?? undefined,
                createdAt: new Date().toISOString(),
            }

            setChats((prevChats) =>
                prevChats.map((chat) =>
                    chat.id === chatId
                        ? {
                            ...chat,
                            conversationId: data.conversationId ?? chat.conversationId,
                            intent: data.intent ?? chat.intent ?? null,
                            title: data.title ?? chat.title,
                            messages: [...chat.messages, assistantMessage],
                            hasLoaded: true,
                        }
                        : chat,
                ),
            )

            if (!currentConversationId && data.conversationId) {
                fetchConversations()
                // Cargar los mensajes completos de la conversación recién creada
                // para incluir el saludo inicial de Gemma
                setTimeout(() => {
                    loadConversationMessages(data.conversationId)
                }, 500)
            }

            // Limpiar archivos adjuntos después de enviar
            setAttachedFiles([])

            // Si modo Canvas está activo, abrir el editor con la respuesta
            if (isCanvasMode && data.message.content) {
                setCanvasContent(stripSourcesSection(data.message.content))
                setCanvasMessageId(assistantMessage.id)
                setCanvasOpen(true)
                setIsCanvasMode(false) // Reset after opening
            }
        } catch (error) {
            // Si fue cancelado por el usuario, restaurar el prompt y eliminar mensaje pendiente
            if (error instanceof DOMException && error.name === "AbortError") {
                setInputValue(lastPromptRef.current)
                // Eliminar el mensaje del usuario que se añadió al chat antes de enviar
                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === chatId
                            ? { ...chat, messages: chat.messages.filter((m) => m.id !== userMessage.id) }
                            : chat,
                    ),
                )
                setIsUploadingFiles(false)
                return
            }
            const message = error instanceof Error ? error.message : "No se pudo generar la respuesta"
            setChatError(message)
        } finally {
            setIsThinking(false)
            abortControllerRef.current = null
        }
    }, [activeChat, fetchConversations, inputValue, isThinking, token, selectedQuickPromptItems, isThinkingMode, isCanvasMode, attachedFiles, isUploadingFiles, loadConversationMessages])

    const handlePromptKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return
        }

        if (event.nativeEvent.isComposing) {
            return
        }

        event.preventDefault()
        void submitPrompt()
    }, [submitPrompt])

    const handleStopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
    }, [])

    const handleQuickPromptToggle = useCallback((prompt: QuickPrompt) => {
        // Si es un prompt con sub-opciones, toggle sub-menú
        if (prompt.subOptions) {
            setOpenSubMenuLabel((prev) => prev === prompt.label ? null : prompt.label)
            return
        }
        setSelectedQuickPrompts((prev) => {
            if (prev.includes(prompt.label)) {
                return prev.filter((label) => label !== prompt.label)
            }
            return [...prev, prompt.label]
        })
    }, [])

    const handleBadgeRemove = useCallback((item: QuickPrompt & { _parentLabel?: string }) => {
        const parentLabel = item._parentLabel || item.label
        if (item.subOptions || item._parentLabel) {
            setSelectedSubOption((prev) => { const next = { ...prev }; delete next[parentLabel]; return next })
            setOpenSubMenuLabel(null)
        }
        setSelectedQuickPrompts((prev) => prev.filter((label) => label !== parentLabel))
    }, [])

    const handleSubOptionSelect = useCallback((parentPrompt: QuickPrompt, subOption: QuickPromptSubOption) => {
        // Si ya está seleccionada esta misma sub-opción, deseleccionar todo
        const currentSub = selectedSubOption[parentPrompt.label]
        if (currentSub?.intent === subOption.intent) {
            setSelectedSubOption((prev) => { const next = { ...prev }; delete next[parentPrompt.label]; return next })
            setOpenSubMenuLabel(null)
            setSelectedQuickPrompts((prev) => prev.filter((label) => label !== parentPrompt.label))
            return
        }
        setSelectedSubOption((prev) => ({ ...prev, [parentPrompt.label]: subOption }))
        setOpenSubMenuLabel(null)
        setSelectedQuickPrompts((prev) => {
            if (!prev.includes(parentPrompt.label)) {
                return [...prev, parentPrompt.label]
            }
            return prev
        })
    }, [selectedSubOption])

    const handleFileSelect = useCallback(async () => {
        if (!token) {
            setChatError("No hay sesión activa")
            return
        }

        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        input.accept = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'

        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement
            const files = target.files
            if (!files || files.length === 0) return

            if (files.length > 5) {
                setChatError("Puedes adjuntar un máximo de 5 archivos")
                return
            }

            // Guardar archivos localmente sin subirlos aún
            // Se subirán cuando el usuario envíe el mensaje
            const filesList: Array<{
                fileName: string
                mimeType: string
                size: number
                file: File
            }> = []

            Array.from(files).forEach(file => {
                filesList.push({
                    fileName: file.name,
                    mimeType: file.type,
                    size: file.size,
                    file: file,
                })
            })

            setAttachedFiles(filesList as any)
        }

        input.click()
    }, [token])

    const handleRemoveFile = useCallback((fileName: string) => {
        setAttachedFiles(prev => prev.filter(file => file.fileName !== fileName))
    }, [])

    const handleDriveFilesSelected = useCallback((files: Array<{ fileName: string; mimeType: string; size: number; text: string; wordCount: number; fromDrive: boolean; driveFileId: string }>) => {
        setAttachedFiles(prev => {
            const existingNames = new Set(prev.map(f => f.fileName))
            const newFiles = files.filter(f => !existingNames.has(f.fileName))
            return [...prev, ...newFiles] as any
        })
        setIsDrivePickerOpen(false)
    }, [])

    const transcribeAudio = useCallback(async (audioBlob: Blob) => {
        if (!token) {
            console.error('❌ No hay token disponible para transcripción')
            setChatError('No hay sesión activa')
            return
        }

        console.log('🎤 Iniciando transcripción de audio...')
        setIsTranscribing(true)

        try {
            const formData = new FormData()
            formData.append('audio', audioBlob, 'recording.webm')
            // Enviar idioma del usuario para mejorar precisión de Whisper
            const userLang = user?.idioma || locale || 'es'
            formData.append('language', userLang)

            console.log(`📤 Enviando audio al servidor... [idioma: ${userLang}]`)
            const response = await fetch(buildApiUrl('/api/files/transcribe'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            })

            console.log(`📥 Respuesta del servidor: ${response.status}`)
            const data = await response.json()

            if (!response.ok) {
                console.error('❌ Error en respuesta:', data)
                throw new Error(data.error || 'Error al transcribir el audio')
            }

            if (data.success && data.text) {
                console.log('✅ Texto transcrito:', data.text)
                // Agregar el texto transcrito al input
                setInputValue(prev => prev + (prev ? ' ' : '') + data.text)
            } else {
                console.warn('⚠️ Respuesta sin texto:', data)
            }
        } catch (error) {
            console.error('❌ Error transcribiendo audio:', error)
            setChatError(error instanceof Error ? error.message : 'Error al transcribir el audio')
        } finally {
            setIsTranscribing(false)
            console.log('🏁 Transcripción finalizada')
        }
    }, [token, user?.idioma, locale])

    const handleStartRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                stream.getTracks().forEach(track => track.stop())

                // Transcribir el audio
                await transcribeAudio(audioBlob)
            }

            mediaRecorder.start()
            setIsRecording(true)
        } catch (error) {
            console.error('Error al iniciar la grabación:', error)
            setChatError('No se pudo acceder al micrófono')
        }
    }, [transcribeAudio])

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }, [isRecording])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        await submitPrompt()
    }

    const handleLogout = async () => {
        await logout()
        router.replace("/auth/login")
    }

    const handleProfileInputChange = (field: keyof ProfileFormState) => (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target
        setProfileForm((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setProfileSaving(true)
        setProfileFeedback(null)

        const experienciaParsed = profileForm.experiencia.trim().length > 0
            ? Number.parseInt(profileForm.experiencia, 10)
            : null

        const experienciaValue = experienciaParsed !== null && Number.isNaN(experienciaParsed) ? null : experienciaParsed

        const payload = {
            nombre: profileForm.nombre.trim() || null,
            apellidos: profileForm.apellidos.trim() || null,
            telefono: profileForm.telefono.trim() || null,
            organizacion: profileForm.organizacion.trim() || null,
            cargo: profileForm.cargo.trim() || null,
            avatarUrl: profileForm.avatarUrl.trim() || null,
            experiencia: experienciaValue,
        }

        const result = await updateProfile(payload)
        setProfileSaving(false)

        if (!result.success) {
            setProfileFeedback(result.error ?? "No se pudo guardar el perfil")
            return
        }

        setProfileFeedback("Perfil actualizado correctamente")
    }

    const avatarInputRef = useRef<HTMLInputElement | null>(null)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || !token) return

        setIsUploadingAvatar(true)
        setProfileFeedback(null)

        try {
            const formData = new FormData()
            formData.append("avatar", file)

            const response = await fetch(buildApiUrl("/api/auth/avatar"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            })

            if (!response.ok) {
                const body = await response.json().catch(() => null)
                throw new Error(body?.message || "Error al subir el avatar")
            }

            const data = await response.json()
            setProfileForm((prev) => ({ ...prev, avatarUrl: data.avatarUrl }))
            setProfileFeedback("Avatar actualizado correctamente")

            // Refrescar datos del usuario para que el avatar se refleje en toda la app
            if (typeof refreshUser === "function") {
                await refreshUser()
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error al subir el avatar"
            setProfileFeedback(message)
        } finally {
            setIsUploadingAvatar(false)
            // Limpiar el input para poder subir el mismo archivo de nuevo
            if (avatarInputRef.current) avatarInputRef.current.value = ""
        }
    }

    const handleSelectChat = (chatId: string) => {
        setActiveChatId(chatId)
        const targetChat = chats.find((chat) => chat.id === chatId)
        if (targetChat?.conversationId && !targetChat.hasLoaded && !targetChat.isLoading) {
            void loadConversationMessages(targetChat.conversationId)
        }
    }

    const handleCreateNewChat = async () => {
        const newChat = createLocalChat()

        setChats((prevChats) => [newChat, ...prevChats])
        setActiveChatId(newChat.id)
        setIsThinking(false)
        setInputValue("")
        setChatError(null)
        setSelectedQuickPrompts([])
        setOpenSubMenuLabel(null)
        setSelectedSubOption({})

        // Crear la conversación en el backend inmediatamente para generar el saludo
        if (token) {
            try {
                const response = await fetch(buildApiUrl("/api/chat/create"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        intent: null,
                    }),
                })

                if (response.status === 429) {
                    // Límite alcanzado: eliminar el chat local optimista
                    const errorData = await response.json().catch(() => null)
                    setChats((prevChats) => prevChats.filter((c) => c.id !== newChat.id))
                    // Reactivar el chat anterior si existe
                    setChats((prevChats) => {
                        if (prevChats.length > 0) setActiveChatId(prevChats[0].id)
                        return prevChats
                    })
                    showLimitDialog(errorData?.message || "Has alcanzado el límite de conversaciones.")
                    return
                }

                if (response.ok) {
                    const data = await response.json()

                    // Actualizar el chat con la conversación y los mensajes (saludo inicial)
                    setChats((prevChats) =>
                        prevChats.map((chat) =>
                            chat.id === newChat.id
                                ? {
                                    ...chat,
                                    conversationId: data.conversationId,
                                    intent: data.intent,
                                    messages: data.messages.map((msg: any) => ({
                                        id: msg.id,
                                        role: toFrontendRole(msg.role),
                                        content: msg.content,
                                        createdAt: msg.fechaCreacion,
                                    })),
                                    hasLoaded: true,
                                }
                                : chat,
                        ),
                    )
                }
            } catch (error) {
                console.error("Error creando conversación:", error)
            }
        }
    }

    const handleSearchChats = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        try {
            const lowerQuery = query.toLowerCase()

            // Buscar en todos los chats (activos y archivados)
            const matches = chats.filter((chat) => {
                // Buscar en el título
                if (chat.title.toLowerCase().includes(lowerQuery)) {
                    return true
                }

                // Buscar en los mensajes
                const hasMessageMatch = chat.messages.some((msg) =>
                    msg.content.toLowerCase().includes(lowerQuery)
                )

                return hasMessageMatch
            })

            setSearchResults(matches)
        } catch (error) {
            console.error("Error buscando chats:", error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleSearchQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value
        setSearchQuery(query)
        void handleSearchChats(query)
    }

    const handleSelectSearchResult = (chatId: string) => {
        handleSelectChat(chatId)
        setIsSearchDialogOpen(false)
        setSearchQuery("")
        setSearchResults([])
    }

    const handleRequestDeleteChat = (chat: Chat) => {
        setChatPendingDeletion(chat)
        setIsDeleteDialogOpen(true)
    }

    const handleCancelDeleteChat = () => {
        setIsDeleteDialogOpen(false)
        setChatPendingDeletion(null)
    }

    const handleConfirmDeleteChat = async () => {
        if (!chatPendingDeletion) {
            return
        }

        const { conversationId, id: chatId } = chatPendingDeletion

        if (conversationId && !token) {
            setChatError("No hay sesión activa. Vuelve a iniciar sesión e inténtalo de nuevo.")
            return
        }

        if (conversationId && token) {
            setIsDeletingChat(true)
            try {
                const response = await fetch(buildApiUrl(`/api/chat/${conversationId}`), {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (!response.ok) {
                    const body = await response.json().catch(() => null)
                    const message = body?.message || body?.error || "No se pudo eliminar el chat"
                    throw new Error(message)
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "No se pudo eliminar el chat"
                setChatError(message)
                return
            } finally {
                setIsDeletingChat(false)
            }
        }

        let nextActiveChatId = activeChatId === chatId ? "" : activeChatId

        setChats((prevChats) => {
            const updated = prevChats.filter((chat) => chat.id !== chatId)
            if (chatId === activeChatId) {
                const fallback = updated.find((chat) => !chat.archived)
                nextActiveChatId = fallback?.id ?? ""
            }
            return updated
        })

        if (nextActiveChatId !== activeChatId) {
            setActiveChatId(nextActiveChatId)
        }

        setChatError(null)
        setIsDeleteDialogOpen(false)
        setChatPendingDeletion(null)
        setIsDeletingChat(false)
    }

    const handleArchiveChat = (chatId: string) => {
        let toggledChat: Chat | null = null
        let nextActiveChatId = activeChatId

        setChats((prevChats) => {
            const updated = prevChats.map((chat) => {
                if (chat.id === chatId) {
                    const updatedChat = {
                        ...chat,
                        archived: !chat.archived,
                    }
                    toggledChat = updatedChat
                    return updatedChat
                }
                return chat
            })

            if (toggledChat) {
                if (toggledChat.archived) {
                    if (nextActiveChatId === chatId) {
                        const fallback = updated.find((chat) => !chat.archived)
                        nextActiveChatId = fallback?.id ?? ""
                    }
                } else {
                    nextActiveChatId = chatId
                }
            }

            return updated
        })

        if (toggledChat && nextActiveChatId !== activeChatId) {
            setActiveChatId(nextActiveChatId)
        }
    }

    const handleRestoreArchivedChat = (chatId: string) => {
        handleArchiveChat(chatId)
        setIsArchivedDialogOpen(false)
    }

    const handleShareChat = async (chatId: string) => {
        const chat = chats.find((item) => item.id === chatId)
        if (!chat) return

        const transcript = chat.messages
            .map((message) => `${message.role === "usuario" ? t("chat.roleUser") : t("chat.roleAssistant")}:\n${message.content}`)
            .join("\n\n")

        try {
            await navigator?.clipboard?.writeText(transcript)
            setShareFeedback(t("chat.copiedToClipboard"))
        } catch (error) {
            console.error("No se pudo copiar la conversación", error)
            setShareFeedback(t("chat.couldNotCopy"))
        }
    }

    const isChatPinned = useCallback((chat: Chat): boolean => {
        try {
            const stored = localStorage.getItem("pinnedChats")
            const pinnedIds: string[] = stored ? JSON.parse(stored) : []
            return pinnedIds.includes(chat.conversationId ?? chat.id)
        } catch { return false }
    }, [])

    const handleTogglePinChat = useCallback((chat: Chat) => {
        const key = chat.conversationId ?? chat.id
        try {
            const stored = localStorage.getItem("pinnedChats")
            let pinnedIds: string[] = stored ? JSON.parse(stored) : []
            if (pinnedIds.includes(key)) {
                pinnedIds = pinnedIds.filter((id) => id !== key)
            } else {
                pinnedIds = [key, ...pinnedIds]
            }
            localStorage.setItem("pinnedChats", JSON.stringify(pinnedIds))
            // Forzar re-render de sidebarChats
            setChats((prev) => [...prev])
        } catch { /* ignore */ }
    }, [])

    const handleStartRename = useCallback((chat: Chat) => {
        setRenamingChatId(chat.id)
        setRenameValue(chat.title)
    }, [])

    const handleConfirmRename = useCallback(async () => {
        if (!renamingChatId || !renameValue.trim()) {
            setRenamingChatId(null)
            setRenameValue("")
            return
        }

        const chat = chats.find((c) => c.id === renamingChatId)
        if (!chat) {
            setRenamingChatId(null)
            setRenameValue("")
            return
        }

        const newTitle = renameValue.trim()

        // Actualizar localmente inmediatamente
        setChats((prev) => prev.map((c) =>
            c.id === renamingChatId ? { ...c, title: newTitle } : c
        ))

        // Persistir en el backend si hay conversationId
        if (chat.conversationId && token) {
            try {
                const response = await fetch(buildApiUrl(`/api/chat/${chat.conversationId}`), {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ titulo: newTitle }),
                })
                if (!response.ok) {
                    console.error("Error renombrando conversación")
                }
            } catch (error) {
                console.error("Error renombrando conversación:", error)
            }
        }

        setRenamingChatId(null)
        setRenameValue("")
    }, [renamingChatId, renameValue, chats, token])

    useEffect(() => {
        if (status === "authenticated" && token) {
            void fetchConversations()
        }
    }, [fetchConversations, status, token])

    const adjustPromptTextareaHeight = useCallback(() => {
        if (typeof window === "undefined") return
        const textarea = promptTextareaRef.current
        if (!textarea) return

        textarea.style.height = "auto"

        const computed = window.getComputedStyle(textarea)
        const lineHeight = Number.parseFloat(computed.lineHeight || "20") || 20
        const minHeight = Math.max(lineHeight * 1.6, 44)
        const maxHeight = lineHeight * 8
        const nextHeight = Math.min(maxHeight, textarea.scrollHeight)

        textarea.style.height = `${Math.max(nextHeight, minHeight)}px`
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden"
    }, [])

    useEffect(() => {
        adjustPromptTextareaHeight()
    }, [adjustPromptTextareaHeight, inputValue, selectedQuickPrompts, messageCount])

    useEffect(() => {
        if (!activeChat?.conversationId) return
        if (activeChat.hasLoaded || activeChat.isLoading) return

        void loadConversationMessages(activeChat.conversationId)
    }, [activeChat?.conversationId, activeChat?.hasLoaded, activeChat?.isLoading, loadConversationMessages])

    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="space-y-4 text-center">
                    <Sparkles className="mx-auto h-8 w-8 animate-pulse text-primary" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">{t("chat.preparingWorkspace")}</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        router.push("/auth/login")
        return null
    }

    const sidebarWidthClass = isSidebarCollapsed ? "w-16" : "w-80"

    // Considerar que no hay mensajes si solo está el saludo inicial del asistente
    const userMessages = activeChat?.messages.filter(m => m.role === "usuario") || []
    const hasMessages = Boolean(activeChat && userMessages.length > 0)

    const renderPromptComposer = (variant: "center" | "bottom") => {
        const hasMessages = variant === "bottom"

        return (
            <form
                onSubmit={handleSubmit}
                className={cn(
                    "w-full mx-auto max-w-3xl",
                    variant === "center" ? "px-4" : "px-4 pb-8 pt-0",
                )}
            >
                <div className="space-y-4">
                    <div
                        className={cn(
                            "flex flex-col gap-3 rounded-[32px] border border-border/40 px-4 py-3 backdrop-blur",
                            "bg-slate-50/80 dark:bg-slate-900/40",
                            "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.4)]",
                            "focus-within:border-primary/40",
                        )}
                    >
                        {/* Textarea arriba */}
                        <Textarea
                            ref={promptTextareaRef}
                            value={inputValue}
                            onChange={(event) => setInputValue(event.target.value)}
                            onKeyDown={handlePromptKeyDown}
                            placeholder={t("chat.inputPlaceholder")}
                            className={cn(
                                "min-h-0 max-h-32 resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 shadow-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                            )}
                            rows={1}
                            disabled={!activeChat}
                        />

                        {/* Badges de etiquetas seleccionadas */}
                        {selectedQuickPromptItems.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedQuickPromptItems.map((item) => {
                                    const Icon = item.icon
                                    const colorKey = (item as any)._parentLabel || item.label
                                    const categoryColors: Record<string, string> = {
                                        "Dinámicas y Actividades": "border-emerald-500 bg-emerald-100 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300",
                                        "Oraciones": "border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300",
                                        "Celebraciones": "border-pink-500 bg-pink-100 text-pink-800 dark:border-pink-500 dark:bg-pink-950/60 dark:text-pink-300",
                                        "Programaciones": "border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300",
                                        "Consulta": "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-950/60 dark:text-slate-300",
                                    }
                                    const colorClass = categoryColors[colorKey] || "border-gray-500 bg-gray-100 text-gray-800 dark:border-gray-500 dark:bg-gray-950/60 dark:text-gray-300"
                                    return (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => handleBadgeRemove(item as any)}
                                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-80 ${colorClass}`}
                                        >
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                            {item.label}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Badges de herramientas activas */}
                        {((hasActiveGoogleDrive && googleDriveToolEnabled) || (hasActiveGoogleDocs && googleDocsToolEnabled)) && (
                            <div className="flex flex-wrap items-center gap-2">
                                {hasActiveGoogleDrive && googleDriveToolEnabled && (
                                    <button
                                        type="button"
                                        onClick={() => setGoogleDriveToolEnabled(false)}
                                        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-70 border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300"
                                        title="Desactivar herramienta Google Drive"
                                    >
                                        <HardDrive className="h-3 w-3" aria-hidden="true" />
                                        Google Drive
                                        <X className="h-3 w-3 ml-0.5" aria-hidden="true" />
                                    </button>
                                )}
                                {hasActiveGoogleDocs && googleDocsToolEnabled && (
                                    <button
                                        type="button"
                                        onClick={() => setGoogleDocsToolEnabled(false)}
                                        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-70 border-green-400 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950/60 dark:text-green-300"
                                        title="Desactivar herramienta Google Docs"
                                    >
                                        <FileText className="h-3 w-3" aria-hidden="true" />
                                        Google Docs
                                        <X className="h-3 w-3 ml-0.5" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Badges de archivos adjuntos */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 py-2">
                                {attachedFiles.map((file) => (
                                    <Badge
                                        key={file.fileName}
                                        variant="outline"
                                        className="flex items-center gap-2 border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300"
                                    >
                                        <FileText className="h-3 w-3" aria-hidden="true" />
                                        <span className="max-w-[200px] truncate">{file.fileName}</span>
                                        <span className="text-xs opacity-70">({file.wordCount} {t("files.words")})</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(file.fileName)}
                                            className="ml-1 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-900"
                                            aria-label={`${t("files.remove")} ${file.fileName}`}
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Barra de botones abajo */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {/* Botón clip para archivos — menú desplegable si hay Drive conectado */}
                                {hasActiveGoogleDrive ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 rounded-full"
                                                aria-label={t("files.attachFiles")}
                                                disabled={isThinking || isUploadingFiles}
                                            >
                                                <Paperclip className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-56">
                                            <DropdownMenuItem onSelect={handleFileSelect}>
                                                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                                                Desde el ordenador
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setIsDrivePickerOpen(true)}>
                                                <svg viewBox="0 0 87.3 78" className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                                                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
                                                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.55z" fill="#ea4335" />
                                                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                                                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                                                    <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                                                </svg>
                                                Desde Google Drive
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <TooltipProvider delayDuration={700}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 rounded-full"
                                                    aria-label={t("files.attachFiles")}
                                                    onClick={handleFileSelect}
                                                    disabled={isThinking || isUploadingFiles}
                                                >
                                                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>{t("files.attachFilesTooltip")}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}

                                {/* Botón llave inglesa para herramientas - solo visible para usuarios con acceso */}
                                {hasTools && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="relative h-8 w-8 shrink-0 rounded-full"
                                                aria-label={t("tooltips.tools")}
                                            >
                                                <Wrench className="h-4 w-4" aria-hidden="true" />
                                                {(hasActiveGoogleDrive && googleDriveToolEnabled) || (hasActiveGoogleDocs && googleDocsToolEnabled) ? (
                                                    <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                                                ) : null}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-60">
                                            <DropdownMenuItem
                                                className={cn(isCanvasMode && "bg-primary/10 text-primary")}
                                                onSelect={() => setIsCanvasMode(!isCanvasMode)}
                                            >
                                                <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
                                                {t("tooltips.canvasMode")}
                                                {isCanvasMode && (
                                                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                                                        ON
                                                    </Badge>
                                                )}
                                            </DropdownMenuItem>

                                            {/* Conectores activos */}
                                            {(hasActiveGoogleDrive || hasActiveGoogleDocs) && (
                                                <>
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">
                                                        Conectores
                                                    </div>
                                                    {hasActiveGoogleDrive && (
                                                        <DropdownMenuItem
                                                            className={cn(googleDriveToolEnabled && "bg-primary/10 text-primary")}
                                                            onSelect={() => setGoogleDriveToolEnabled(!googleDriveToolEnabled)}
                                                        >
                                                            <HardDrive className="mr-2 h-4 w-4" aria-hidden="true" />
                                                            Google Drive
                                                            <Badge
                                                                variant={googleDriveToolEnabled ? "default" : "outline"}
                                                                className="ml-auto text-[10px] px-1.5 py-0"
                                                            >
                                                                {googleDriveToolEnabled ? "ON" : "OFF"}
                                                            </Badge>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {hasActiveGoogleDocs && (
                                                        <DropdownMenuItem
                                                            className={cn(googleDocsToolEnabled && "bg-primary/10 text-primary")}
                                                            onSelect={() => setGoogleDocsToolEnabled(!googleDocsToolEnabled)}
                                                        >
                                                            <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                                                            Google Docs
                                                            <Badge
                                                                variant={googleDocsToolEnabled ? "default" : "outline"}
                                                                className="ml-auto text-[10px] px-1.5 py-0"
                                                            >
                                                                {googleDocsToolEnabled ? "ON" : "OFF"}
                                                            </Badge>
                                                        </DropdownMenuItem>
                                                    )}
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                {/* Selector de etiquetas - solo cuando hay mensajes */}
                                {hasMessages && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 rounded-full"
                                                aria-label={t("categories.selectCategories")}
                                            >
                                                <Tag className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-64">
                                            {quickPrompts.map((item) => {
                                                const Icon = item.icon
                                                const isSelected = selectedQuickPrompts.includes(item.label)
                                                if (item.subOptions) {
                                                    const subColor = item.intent.startsWith("ORACION") ? "text-violet-500" : "text-pink-500"
                                                    return (
                                                        <DropdownMenuSub key={item.label}>
                                                            <DropdownMenuSubTrigger
                                                                className={cn(
                                                                    "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                                                                    isSelected && "bg-primary/10 text-primary"
                                                                )}
                                                            >
                                                                <Icon className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
                                                                {item.label}
                                                            </DropdownMenuSubTrigger>
                                                            <DropdownMenuSubContent className="w-52">
                                                                {item.subOptions.map((sub) => {
                                                                    const SubIcon = sub.icon
                                                                    const isSubSelected = selectedSubOption[item.label]?.intent === sub.intent
                                                                    return (
                                                                        <DropdownMenuItem
                                                                            key={sub.intent}
                                                                            className={cn(isSubSelected && "bg-primary/10 text-primary")}
                                                                            onSelect={(e) => {
                                                                                e.preventDefault()
                                                                                handleSubOptionSelect(item, sub)
                                                                            }}
                                                                        >
                                                                            <SubIcon className={cn("mr-2 h-4 w-4", subColor)} aria-hidden="true" />
                                                                            {sub.label}
                                                                        </DropdownMenuItem>
                                                                    )
                                                                })}
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuSub>
                                                    )
                                                }
                                                return (
                                                    <DropdownMenuItem
                                                        key={item.label}
                                                        className={cn(isSelected && "bg-primary/10 text-primary")}
                                                        onSelect={() => handleQuickPromptToggle(item)}
                                                    >
                                                        <Icon className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
                                                        {item.label}
                                                    </DropdownMenuItem>
                                                )
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                {/* Badge Thinking - solo para PRO y roles especiales */}
                                {canUseThinkingMode && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsThinkingMode(!isThinkingMode)}
                                                    className="transition"
                                                    aria-label={t("tooltips.thinkingMode")}
                                                    aria-pressed={isThinkingMode}
                                                >
                                                    <Badge
                                                        className={cn(
                                                            "cursor-pointer transition-colors",
                                                            isThinkingMode
                                                                ? "bg-[#8CC63F] hover:bg-[#7AB62F] text-white border-[#8CC63F]"
                                                                : "bg-muted text-muted-foreground hover:bg-muted/80 border-border"
                                                        )}
                                                    >
                                                        Deep think
                                                    </Badge>
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>{t("tooltips.thinkingModeTooltip")}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}

                                {/* Badge Canvas - solo para usuarios con herramientas */}
                                {hasTools && isCanvasMode && (
                                    <Badge
                                        className="cursor-pointer bg-violet-500 hover:bg-violet-600 text-white border-violet-500 transition-colors"
                                        onClick={() => setIsCanvasMode(false)}
                                    >
                                        <PenLine className="mr-1 h-3 w-3" />
                                        {t("tooltips.canvasMode")}
                                    </Badge>
                                )}

                                {/* Botón de micrófono para dictar */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-8 w-8 shrink-0 rounded-full transition-colors",
                                                    isRecording && "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                                                )}
                                                aria-label={isRecording ? t("recording.stopRecording") : t("recording.dictate")}
                                                onClick={isRecording ? handleStopRecording : handleStartRecording}
                                                disabled={isThinking || isTranscribing}
                                            >
                                                {isRecording ? (
                                                    <Square className="h-4 w-4 animate-pulse" aria-hidden="true" />
                                                ) : (
                                                    <Mic className="h-4 w-4" aria-hidden="true" />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>{isRecording ? t("recording.stopRecording") : isTranscribing ? t("recording.transcribing") : t("recording.dictate")}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {isThinking ? (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all"
                                                    onClick={handleStopGeneration}
                                                    aria-label={t("tooltips.stopGeneration")}
                                                >
                                                    <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>{t("tooltips.stopGeneration")}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : (
                                    <Button
                                        type="submit"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 rounded-full"
                                        disabled={inputValue.trim().length === 0 || !activeChat}
                                        aria-label={t("tooltips.send")}
                                    >
                                        <Send className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Etiquetas debajo de la caja - solo cuando NO hay mensajes */}
                    {!hasMessages && (
                        <div className="flex flex-col items-center gap-2 w-full">
                            <div className="flex flex-nowrap items-center justify-center gap-2">
                                {quickPrompts.map((item) => {
                                    const Icon = item.icon
                                    const isSelected = selectedQuickPrompts.includes(item.label)
                                    const categoryColors: Record<string, { base: string, selected: string }> = {
                                        "Dinámicas y Actividades": {
                                            base: "border-emerald-500/30 bg-transparent text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                                            selected: "border-emerald-500 bg-emerald-100 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        },
                                        "Oraciones": {
                                            base: "border-violet-500/30 bg-transparent text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30",
                                            selected: "border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300"
                                        },
                                        "Celebraciones": {
                                            base: "border-pink-500/30 bg-transparent text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30",
                                            selected: "border-pink-500 bg-pink-100 text-pink-800 dark:border-pink-500 dark:bg-pink-950/60 dark:text-pink-300"
                                        },
                                        "Programaciones": {
                                            base: "border-blue-500/30 bg-transparent text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30",
                                            selected: "border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300"
                                        },
                                        "Consulta": {
                                            base: "border-slate-500/30 bg-transparent text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950/30",
                                            selected: "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-950/60 dark:text-slate-300"
                                        },
                                    }
                                    const colors = categoryColors[item.label] || {
                                        base: "border-gray-500/30 bg-transparent text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-950/30",
                                        selected: "border-gray-500 bg-gray-100 text-gray-800 dark:border-gray-500 dark:bg-gray-950/60 dark:text-gray-300"
                                    }
                                    const colorClass = isSelected ? colors.selected : colors.base

                                    return (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => handleQuickPromptToggle(item)}
                                            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${colorClass}`}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            {item.label}
                                            {item.subOptions && (
                                                <ChevronDown className={cn("h-3 w-3 transition-transform", (isSelected || openSubMenuLabel === item.label) && "rotate-180")} />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                            {/* Sub-opciones genéricas (Oraciones / Celebraciones) */}
                            {openSubMenuLabel && (() => {
                                const openPrompt = quickPrompts.find(p => p.label === openSubMenuLabel && p.subOptions)
                                if (!openPrompt?.subOptions) return null
                                const isOracion = openPrompt.intent.startsWith("ORACION")
                                return (
                                    <div className="flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {openPrompt.subOptions.map((sub) => {
                                            const SubIcon = sub.icon
                                            const isSubSelected = selectedSubOption[openPrompt.label]?.intent === sub.intent
                                            const selectedCls = isOracion
                                                ? "border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300"
                                                : "border-pink-500 bg-pink-100 text-pink-800 dark:border-pink-500 dark:bg-pink-950/60 dark:text-pink-300"
                                            const baseCls = isOracion
                                                ? "border-violet-500/30 bg-transparent text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                                : "border-pink-500/30 bg-transparent text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30"
                                            return (
                                                <button
                                                    key={sub.intent}
                                                    type="button"
                                                    onClick={() => handleSubOptionSelect(openPrompt, sub)}
                                                    className={cn(
                                                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                                        isSubSelected ? selectedCls : baseCls
                                                    )}
                                                >
                                                    <SubIcon className="h-4 w-4" aria-hidden="true" />
                                                    {sub.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )
                            })()}
                        </div>
                    )}
                </div>
            </form>
        )
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <aside
                className={cn(
                    "relative z-10 flex h-full flex-col bg-muted/40 backdrop-blur transition-all duration-300 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_16px_-4px_rgba(0,0,0,0.3)]",
                    sidebarWidthClass,
                )}
            >
                {/* Logo y título */}
                <div className="flex items-center justify-between px-4 pt-6 pb-4">
                    {isSidebarCollapsed ? (
                        <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white shadow-md mx-auto">
                            <Image src="/LogotipoRPJ_circulo.png" alt="RPJ" width={36} height={36} priority className="object-cover" />
                        </span>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="relative inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-md">
                                    <Image src="/LogotipoRPJ_circulo.png" alt="RPJ" width={56} height={56} priority className="object-cover" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-base font-semibold leading-tight">{t("app.title")}</span>
                                    <span className="text-base font-semibold leading-tight">{t("app.subtitle")}</span>
                                </div>
                            </div>
                            {/* Botón de colapsar junto al título */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                                className="h-9 w-9"
                                aria-label={t("sidebar.hideMenu")}
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>

                {/* Separador */}
                <div className="pb-4" />

                {/* Botones de acción - mismo padding y espaciado */}
                {isSidebarCollapsed ? (
                    <div className="flex flex-col gap-1 px-2">
                        {/* Nueva conversación - colapsado */}
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCreateNewChat}
                                        className="h-8 w-8 rounded-lg hover:bg-muted text-foreground mx-auto"
                                    >
                                        <PenSquare className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>{t("sidebar.newConversation")}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Buscar conversaciones - colapsado */}
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsSearchDialogOpen(true)}
                                        className="h-8 w-8 rounded-lg hover:bg-muted text-foreground mx-auto"
                                    >
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>{t("sidebar.searchConversations")}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Carpetas de trabajo - colapsado (solo Pro) */}
                        {isProUser && carpetasHook.todasLasCarpetas.length > 0 && (
                            <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsSidebarCollapsed(false)}
                                            className="h-8 w-8 rounded-lg hover:bg-muted text-foreground mx-auto"
                                        >
                                            <FolderOpen className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>{t("folders.title")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Conversaciones - colapsado */}
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsSidebarCollapsed(false)}
                                        className="h-8 w-8 rounded-lg hover:bg-muted text-foreground mx-auto"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>{t("sidebar.conversations")}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Espaciador flexible */}
                        <div className="flex-1" />

                        {/* Botón expandir */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarCollapsed(false)}
                            className="h-7 w-7 mx-auto mb-2 text-foreground"
                            aria-label={t("sidebar.showMenu")}
                        >
                            <ChevronsRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-1 px-2">
                        {/* Nueva conversación - expandido */}
                        <button
                            type="button"
                            onClick={handleCreateNewChat}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-normal text-foreground transition-colors hover:bg-muted"
                        >
                            <PenSquare className="h-4 w-4" aria-hidden="true" />
                            <span>{t("sidebar.newConversation")}</span>
                        </button>

                        {/* Buscar conversaciones - expandido */}
                        <button
                            type="button"
                            onClick={() => setIsSearchDialogOpen(true)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-normal text-foreground transition-colors hover:bg-muted"
                        >
                            <Search className="h-4 w-4" aria-hidden="true" />
                            <span>{t("sidebar.searchConversations")}</span>
                        </button>

                        {/* Separador con más espacio */}
                        <div className="py-2">
                            <div className="border-t border-border/40" />
                        </div>

                        {/* Carpetas de trabajo (solo Pro) */}
                        {isProUser && (
                            <CarpetasSidebar
                                carpetas={carpetasHook.todasLasCarpetas}
                                activeChatConversationId={activeChat?.conversationId ?? null}
                                onSelectChat={handleFolderChatSelect}
                                onCreateFolder={handleCreateFolder}
                                onEditFolder={handleEditFolder}
                                onShareFolder={handleShareFolder}
                                onDeleteFolder={handleDeleteFolder}
                                onRemoveConversation={handleRemoveChatFromFolder}
                                onMarkNotificationsRead={carpetasHook.marcarNotificacionesLeidas}
                                userId={user?.id ?? ""}
                            />
                        )}

                        {/* Título Conversaciones */}
                        <button
                            onClick={() => setIsChatsListCollapsed(!isChatsListCollapsed)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            <div className="flex items-center gap-3">
                                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                                <span>{t("sidebar.conversations")}</span>
                            </div>
                            {isChatsListCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                )}

                {/* Sección de chats */}
                {isSidebarCollapsed ? (
                    <div className="flex-1" />
                ) : (
                    <ScrollArea className="flex-1">
                        {!isChatsListCollapsed && (
                            <div className="space-y-1 px-2 pb-4">
                                {sidebarChats.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-8 text-center text-xs text-muted-foreground">
                                        {t("sidebar.noConversations")}
                                    </div>
                                )}

                                {sidebarChats.map((chat) => {
                                    const isActive = chat.id === activeChatId
                                    const truncatedTitle = chat.title.length > 28 ? chat.title.substring(0, 28) + '…' : chat.title
                                    const pinned = isChatPinned(chat)
                                    const isRenaming = renamingChatId === chat.id

                                    return (
                                        <div
                                            key={chat.id}
                                            className={cn(
                                                "group relative flex cursor-pointer items-center justify-between gap-1.5 rounded-lg px-3 py-2 transition-colors",
                                                isActive ? "bg-primary/10" : "hover:bg-muted/50",
                                            )}
                                            onClick={() => !isRenaming && handleSelectChat(chat.id)}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                {pinned && (
                                                    <Pin className="h-3 w-3 flex-shrink-0 text-primary/60 rotate-45" />
                                                )}
                                                {chat.esCompartida && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Mail className="h-3 w-3 flex-shrink-0 text-primary/70" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="max-w-xs">
                                                            <p className="text-xs">
                                                                {t("share.sharedBy", {
                                                                    name: chat.compartidaNombre || "",
                                                                    email: chat.compartidaDesde || "",
                                                                })}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {isRenaming ? (
                                                    <input
                                                        type="text"
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault()
                                                                void handleConfirmRename()
                                                            }
                                                            if (e.key === "Escape") {
                                                                setRenamingChatId(null)
                                                                setRenameValue("")
                                                            }
                                                        }}
                                                        onBlur={() => void handleConfirmRename()}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex-1 bg-transparent text-[11px] leading-tight outline-none border-b border-primary/40 py-0.5"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="truncate text-[11px] leading-tight">
                                                        {truncatedTitle}
                                                    </span>
                                                )}
                                            </div>

                                            {!isRenaming && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 flex-shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-muted"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem
                                                        onSelect={(event) => {
                                                            event.preventDefault()
                                                            handleStartRename(chat)
                                                        }}
                                                    >
                                                        <PenLine className="mr-2 h-4 w-4" aria-hidden="true" /> {t("sidebar.rename")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={(event) => {
                                                            event.preventDefault()
                                                            handleTogglePinChat(chat)
                                                        }}
                                                    >
                                                        {pinned ? (
                                                            <><PinOff className="mr-2 h-4 w-4" aria-hidden="true" /> {t("sidebar.unpinChat")}</>
                                                        ) : (
                                                            <><Pin className="mr-2 h-4 w-4" aria-hidden="true" /> {t("sidebar.pinChat")}</>
                                                        )}
                                                    </DropdownMenuItem>
                                                    {/* Mover a carpeta (solo Pro) */}
                                                    {isProUser && carpetasHook.carpetasPropias.length > 0 && chat.conversationId && (
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger>
                                                                <FolderOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                                                                {t("folders.moveToFolder")}
                                                            </DropdownMenuSubTrigger>
                                                            <DropdownMenuSubContent className="w-48">
                                                                {carpetasHook.carpetasPropias.map((carpeta) => (
                                                                    <DropdownMenuItem
                                                                        key={carpeta.id}
                                                                        onSelect={(event) => {
                                                                            event.preventDefault()
                                                                            if (chat.conversationId) {
                                                                                void handleAddChatToFolder(carpeta.id, chat.conversationId)
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span className="mr-2 h-3 w-3 rounded-full inline-block" style={{ backgroundColor: carpeta.color }} />
                                                                        <span className="truncate text-xs">{carpeta.nombre}</span>
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuSub>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onSelect={(event) => {
                                                            event.preventDefault()
                                                            handleShareChat(chat.id)
                                                        }}
                                                    >
                                                        <Share2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t("sidebar.share")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={(event) => {
                                                            event.preventDefault()
                                                            handleArchiveChat(chat.id)
                                                        }}
                                                    >
                                                        <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                                                        {t("sidebar.archive")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onSelect={(event) => {
                                                            event.preventDefault()
                                                            handleRequestDeleteChat(chat)
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t("sidebar.delete")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>
                )}

                {/* Sección de usuario - siempre visible */}
                <div className={cn(
                    "border-t border-border/60",
                    isSidebarCollapsed ? "px-2 py-4" : "px-4 py-6"
                )}>
                    {isSidebarCollapsed ? (
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="mx-auto overflow-hidden rounded-full transition-transform hover:scale-105"
                                            >
                                                <Avatar className="h-9 w-9">
                                                    {user?.avatarUrl ? (
                                                        <AvatarImage src={user.avatarUrl} alt={user.nombre || "Avatar"} />
                                                    ) : null}
                                                    <AvatarFallback style={{ backgroundColor: '#94c120', color: 'white' }} className="text-xs font-semibold uppercase">{initials}</AvatarFallback>
                                                </Avatar>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="center"
                                            side="right"
                                            className="w-56"
                                        >
                                            <DropdownMenuItem onSelect={() => setIsUserDialogOpen(true)}>
                                                <User className="mr-2 h-4 w-4" />
                                                {t("userMenu.user")}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setIsArchivedDialogOpen(true)}>
                                                <Archive className="mr-2 h-4 w-4" />
                                                {t("userMenu.archivedConversations")}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
                                                <Settings className="mr-2 h-4 w-4" />
                                                {t("userMenu.settings")}
                                            </DropdownMenuItem>
                                            {canShowOptions && (
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <FileStack className="mr-2 h-4 w-4" />
                                                        {t("userMenu.options")}
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="w-48">
                                                        {canAccessDocumentation && (
                                                            <DropdownMenuItem onSelect={() => router.push("/documentacion")}>
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                {t("userMenu.documentation")}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canAccessAdministration && (
                                                            <DropdownMenuItem onSelect={() => router.push("/admin")}>
                                                                <UserCog className="mr-2 h-4 w-4" />
                                                                {t("userMenu.administration")}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canAccessAdministration && (
                                                            <DropdownMenuItem onSelect={() => router.push("/estadisticas")}>
                                                                <BarChart3 className="mr-2 h-4 w-4" />
                                                                {t("userMenu.statistics")}
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onSelect={() => handleLogout()}
                                                className="text-destructive"
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                {t("userMenu.logout")}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>{user?.nombre || user?.email}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-border/60"
                                    >
                                        <Avatar className="h-12 w-12">
                                            {user?.avatarUrl ? (
                                                <AvatarImage src={user.avatarUrl} alt={user.nombre || "Avatar"} />
                                            ) : null}
                                            <AvatarFallback style={{ backgroundColor: '#94c120', color: 'white' }} className="text-sm font-semibold uppercase">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium leading-tight">{user?.nombre || user?.email}</span>
                                            <span className="text-xs uppercase tracking-wide text-muted-foreground">{user?.rol}</span>
                                        </div>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    side="top"
                                    className="w-56"
                                >
                                    <DropdownMenuItem onSelect={() => setIsUserDialogOpen(true)}>
                                        <User className="mr-2 h-4 w-4" />
                                        {t("userMenu.user")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsArchivedDialogOpen(true)}>
                                        <Archive className="mr-2 h-4 w-4" />
                                        {t("userMenu.archivedConversations")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        {t("userMenu.settings")}
                                    </DropdownMenuItem>
                                    {canShowOptions && (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <FileStack className="mr-2 h-4 w-4" />
                                                {t("userMenu.options")}
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="w-48">
                                                {canAccessDocumentation && (
                                                    <DropdownMenuItem onSelect={() => router.push("/documentacion")}>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        {t("userMenu.documentation")}
                                                    </DropdownMenuItem>
                                                )}
                                                {canAccessAdministration && (
                                                    <DropdownMenuItem onSelect={() => router.push("/admin")}>
                                                        <UserCog className="mr-2 h-4 w-4" />
                                                        {t("userMenu.administration")}
                                                    </DropdownMenuItem>
                                                )}
                                                {canAccessAdministration && (
                                                    <DropdownMenuItem onSelect={() => router.push("/estadisticas")}>
                                                        <BarChart3 className="mr-2 h-4 w-4" />
                                                        {t("userMenu.statistics")}
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={() => handleLogout()}
                                        className="text-destructive"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        {t("userMenu.logout")}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <UsageStats token={token} />
                        </>
                    )}
                </div>
            </aside>

            <main className="flex flex-1 flex-col overflow-hidden">
                <header className="flex items-center justify-between border-b border-border/60 bg-background/95 px-8 py-4">
                    <nav className="flex items-center">
                        <Link
                            href="/acerca-de"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                        >
                            <Info className="h-4 w-4" />
                            {t("header.aboutIARPJ")}
                        </Link>
                        <div className="h-5 w-px bg-border/60 mx-2" />
                        <Link
                            href="/guia-de-uso"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                        >
                            <BookOpen className="h-4 w-4" />
                            {t("header.usageGuide")}
                        </Link>
                        <div className="h-5 w-px bg-border/60 mx-2" />
                        <Link
                            href="/contacto"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                        >
                            <Mail className="h-4 w-4" />
                            {t("header.contact")}
                        </Link>
                    </nav>
                    <div className="flex items-center gap-3">
                        {shareFeedback && (
                            <p className="text-xs text-primary/80" role="status">
                                {shareFeedback}
                            </p>
                        )}
                        <LanguageSelector />
                        <ThemeToggleButton />
                    </div>
                </header>

                <section className="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/40">
                    {!hasMessages ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8" style={{ paddingBottom: "15%" }}>
                            <div className="flex flex-col items-center gap-2 text-center max-w-2xl">
                                <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-foreground leading-relaxed">
                                    {activeChat?.messages[0]?.role === "asistente" && activeChat?.messages[0]?.content
                                        ? activeChat.messages[0].content
                                        : user?.nombre
                                            ? t("chat.greeting", { name: user.nombre })
                                            : t("chat.greetingGeneric")}
                                </p>
                            </div>
                            {renderPromptComposer("center")}
                        </div>
                    ) : (
                        <div className="flex h-full flex-col overflow-hidden">
                            <div ref={scrollRef} className="flex-1 overflow-y-auto py-10">
                                <div className={cn("mx-auto w-full max-w-[60%] space-y-8 px-4", fontClassMap[chatFont] || "font-sans")}>
                                {activeChat?.isLoading && activeChat.messages.length === 0 && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
                                        <span>{t("chat.loadingConversation")}</span>
                                    </div>
                                )}

                                {activeChat && activeChat.messages.map((message, messageIndex) => (
                                    <div
                                        key={message.id}
                                        className={cn("flex gap-4 group", message.role === "usuario" ? "justify-end" : "justify-start")}
                                    >
                                        <div
                                            className={cn(
                                                "relative max-w-[85%] text-sm leading-relaxed",
                                                message.role === "usuario"
                                                    ? "rounded-2xl border border-border/30 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 px-5 py-4 shadow-sm"
                                                    : "text-foreground",
                                            )}
                                        >
                                            {message.role === "asistente" && message.isWorkContent === true && (
                                                <div className="flex justify-end mb-3 gap-2">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button type="button" className="focus:outline-none">
                                                                <Badge
                                                                    className="cursor-pointer bg-muted text-muted-foreground hover:bg-muted/80 border-border flex items-center gap-1"
                                                                >
                                                                    <Download className="h-3 w-3" />
                                                                    {t("download.button")}
                                                                </Badge>
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onSelect={async () => {
                                                                    try {
                                                                        await downloadAsPDF(message.content, `respuesta-${message.id}.pdf`)
                                                                    } catch (error) {
                                                                        console.error("Error descargando PDF:", error)
                                                                    }
                                                                }}
                                                            >
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                {t("download.pdfDocument")}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={async () => {
                                                                    try {
                                                                        await downloadAsWord(message.content, `respuesta-${message.id}.docx`)
                                                                    } catch (error) {
                                                                        console.error("Error descargando Word:", error)
                                                                    }
                                                                }}
                                                            >
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                {t("download.wordDocument")}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    {hasTools && (
                                                        <button
                                                            type="button"
                                                            className="focus:outline-none"
                                                            onClick={() => {
                                                                setCanvasContent(stripSourcesSection(message.content))
                                                                setCanvasMessageId(message.id)
                                                                setCanvasOpen(true)
                                                            }}
                                                        >
                                                            <Badge
                                                                className="cursor-pointer bg-muted text-muted-foreground hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 border-border flex items-center gap-1"
                                                            >
                                                                <PenLine className="h-3 w-3" />
                                                                {t("tooltips.canvasMode")}
                                                            </Badge>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {message.role === "asistente" ? (
                                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                                                            ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-1.5">{children}</ul>,
                                                            ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-1.5">{children}</ol>,
                                                            li: ({ children }) => <li className="mb-1 pl-1 leading-relaxed">{children}</li>,
                                                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                            em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                                                            h1: ({ children }) => <h1 className="mt-6 mb-3 text-xl font-bold border-b border-border/40 pb-2">{children}</h1>,
                                                            h2: ({ children }) => <h2 className="mt-5 mb-2.5 text-lg font-bold">{children}</h2>,
                                                            h3: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
                                                            h4: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h4>,
                                                            blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground">{children}</blockquote>,
                                                            hr: () => <hr className="my-6 border-border/40" />,
                                                            code: ({ children, ...props }) => {
                                                                const isInline = !props.className
                                                                return isInline ? (
                                                                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
                                                                ) : (
                                                                    <code className="block rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">{children}</code>
                                                                )
                                                            },
                                                        }}
                                                    >
                                                        {stripSourcesSection(message.content)}
                                                    </ReactMarkdown>
                                                    {/* Caja ámbar de fuentes consultadas */}
                                                    {extractSourcesText(message.content) && (
                                                        <div className="mt-3 rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 px-3 py-2">
                                                            <p className="text-[10px] font-medium leading-relaxed text-amber-700 dark:text-amber-400 m-0 mb-1">
                                                                📚 Fuentes consultadas:
                                                            </p>
                                                            <ul className="m-0 pl-4 list-disc space-y-0.5">
                                                                {extractSourcesText(message.content)!.split(/[,;|]|\n/).map((src, i) => {
                                                                    const trimmed = src.replace(/^[\s\-•]+/, '').trim()
                                                                    if (!trimmed) return null
                                                                    return (
                                                                        <li key={i} className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
                                                                            {trimmed}
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="whitespace-pre-wrap">{message.content}</div>
                                            )}

                                            {/* Iconos de acción para trabajos finales */}
                                            {message.role === "asistente" && message.isWorkContent === true && (
                                                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/30">
                                                    {/* Copiar */}
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                                        onClick={async () => {
                                                            try {
                                                                await navigator.clipboard.writeText(message.content)
                                                                setCopiedMessageId(message.id)
                                                                setTimeout(() => setCopiedMessageId(null), 2000)
                                                            } catch {
                                                                console.error("Error al copiar")
                                                            }
                                                        }}
                                                    >
                                                        {copiedMessageId === message.id ? (
                                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>

                                                    {/* Feedback positivo */}
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                                                            feedbackMap[message.id] === "POSITIVO"
                                                                ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                        )}
                                                        onClick={async () => {
                                                            try {
                                                                if (feedbackMap[message.id] === "POSITIVO") {
                                                                    const response = await fetch(buildApiUrl(`/api/feedback/${message.id}`), {
                                                                        method: "DELETE",
                                                                        headers: { Authorization: `Bearer ${token}` },
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo eliminar feedback")
                                                                    setFeedbackMap(prev => { const n = { ...prev }; delete n[message.id]; return n })
                                                                } else {
                                                                    const response = await fetch(buildApiUrl("/api/feedback"), {
                                                                        method: "POST",
                                                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                                        body: JSON.stringify({ mensajeId: message.id, tipo: "POSITIVO", intencion: activeChat?.intent || null }),
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo guardar feedback")
                                                                    setFeedbackMap(prev => ({ ...prev, [message.id]: "POSITIVO" }))
                                                                }
                                                            } catch { console.error("Error al enviar feedback") }
                                                        }}
                                                    >
                                                        <ThumbsUp className="h-3.5 w-3.5" />
                                                    </button>

                                                    {/* Feedback negativo */}
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                                                            feedbackMap[message.id] === "NEGATIVO"
                                                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                        )}
                                                        onClick={async () => {
                                                            try {
                                                                if (feedbackMap[message.id] === "NEGATIVO") {
                                                                    const response = await fetch(buildApiUrl(`/api/feedback/${message.id}`), {
                                                                        method: "DELETE",
                                                                        headers: { Authorization: `Bearer ${token}` },
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo eliminar feedback")
                                                                    setFeedbackMap(prev => { const n = { ...prev }; delete n[message.id]; return n })
                                                                } else {
                                                                    const response = await fetch(buildApiUrl("/api/feedback"), {
                                                                        method: "POST",
                                                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                                        body: JSON.stringify({ mensajeId: message.id, tipo: "NEGATIVO", intencion: activeChat?.intent || null }),
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo guardar feedback")
                                                                    setFeedbackMap(prev => ({ ...prev, [message.id]: "NEGATIVO" }))
                                                                }
                                                            } catch { console.error("Error al enviar feedback") }
                                                        }}
                                                    >
                                                        <ThumbsDown className="h-3.5 w-3.5" />
                                                    </button>

                                                    {/* Compartir */}
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                                        onClick={() => {
                                                            setShareMessageContent(message.content)
                                                            setShareConversationTitle(activeChat?.title || "Contenido generado por IA RPJ")
                                                            setShareDialogOpen(true)
                                                        }}
                                                    >
                                                        <Share2 className="h-3.5 w-3.5" />
                                                        <span>{t("sidebar.share")}</span>
                                                    </button>

                                                    {/* Regenerar */}
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                                        disabled={isThinking}
                                                        onClick={() => {
                                                            // Encontrar el mensaje del usuario anterior a este del asistente
                                                            const msgs = activeChat?.messages || []
                                                            const prevUserMsg = msgs.slice(0, messageIndex).reverse().find(m => m.role === "usuario")
                                                            if (prevUserMsg) {
                                                                setInputValue(prevUserMsg.content)
                                                                // Eliminar la respuesta actual y el mensaje del usuario para regenerar
                                                                setChats(prevChats => prevChats.map(chat =>
                                                                    chat.id === activeChat?.id
                                                                        ? { ...chat, messages: msgs.filter((_, i) => i < messageIndex - 1) }
                                                                        : chat
                                                                ))
                                                            }
                                                        }}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        <span>{t("common.retry")}</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Feedback para mensajes conversacionales (no work content) */}
                                            {message.role === "asistente" && !message.isWorkContent && (
                                                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "inline-flex items-center rounded-md p-1.5 text-xs transition-colors",
                                                            feedbackMap[message.id] === "POSITIVO"
                                                                ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                                                                : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/60"
                                                        )}
                                                        onClick={async () => {
                                                            try {
                                                                if (feedbackMap[message.id] === "POSITIVO") {
                                                                    const response = await fetch(buildApiUrl(`/api/feedback/${message.id}`), {
                                                                        method: "DELETE",
                                                                        headers: { Authorization: `Bearer ${token}` },
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo eliminar feedback")
                                                                    setFeedbackMap(prev => { const n = { ...prev }; delete n[message.id]; return n })
                                                                } else {
                                                                    const response = await fetch(buildApiUrl("/api/feedback"), {
                                                                        method: "POST",
                                                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                                        body: JSON.stringify({ mensajeId: message.id, tipo: "POSITIVO", intencion: activeChat?.intent || null }),
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo guardar feedback")
                                                                    setFeedbackMap(prev => ({ ...prev, [message.id]: "POSITIVO" }))
                                                                }
                                                            } catch { console.error("Error al enviar feedback") }
                                                        }}
                                                    >
                                                        <ThumbsUp className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "inline-flex items-center rounded-md p-1.5 text-xs transition-colors",
                                                            feedbackMap[message.id] === "NEGATIVO"
                                                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                                                                : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/60"
                                                        )}
                                                        onClick={async () => {
                                                            try {
                                                                if (feedbackMap[message.id] === "NEGATIVO") {
                                                                    const response = await fetch(buildApiUrl(`/api/feedback/${message.id}`), {
                                                                        method: "DELETE",
                                                                        headers: { Authorization: `Bearer ${token}` },
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo eliminar feedback")
                                                                    setFeedbackMap(prev => { const n = { ...prev }; delete n[message.id]; return n })
                                                                } else {
                                                                    const response = await fetch(buildApiUrl("/api/feedback"), {
                                                                        method: "POST",
                                                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                                        body: JSON.stringify({ mensajeId: message.id, tipo: "NEGATIVO", intencion: activeChat?.intent || null }),
                                                                    })
                                                                    if (!response.ok) throw new Error("No se pudo guardar feedback")
                                                                    setFeedbackMap(prev => ({ ...prev, [message.id]: "NEGATIVO" }))
                                                                }
                                                            } catch { console.error("Error al enviar feedback") }
                                                        }}
                                                    >
                                                        <ThumbsDown className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {message.role === "usuario" && (
                                            <Avatar className="h-9 w-9">
                                                {user?.avatarUrl ? (
                                                    <AvatarImage src={user.avatarUrl} alt={user.nombre || "Avatar"} />
                                                ) : null}
                                                <AvatarFallback style={{ backgroundColor: '#94c120', color: 'white' }}>{initials}</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}

                                {isThinking && (
                                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2">
                                                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                                                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "120ms" }} />
                                                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "240ms" }} />
                                                <span className="text-xs font-medium text-muted-foreground">{t("chat.thinking")}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!activeChat && (
                                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                        Selecciona o crea un chat para comenzar.
                                    </div>
                                )}
                                </div>
                            </div>
                            {renderPromptComposer("bottom")}
                        </div>
                    )}
                </section>
            </main>
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("profile.title")}</DialogTitle>
                        <DialogDescription>{t("profile.subtitle")}</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleProfileSubmit}>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-nombre">{t("profile.name")}</Label>
                            <Input id="profile-nombre" value={profileForm.nombre} onChange={handleProfileInputChange("nombre")} placeholder={t("profile.namePlaceholder")} autoComplete="given-name" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-apellidos">{t("profile.lastName")}</Label>
                            <Input id="profile-apellidos" value={profileForm.apellidos} onChange={handleProfileInputChange("apellidos")} placeholder={t("profile.lastNamePlaceholder")} autoComplete="family-name" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-telefono">{t("profile.phone")}</Label>
                            <Input id="profile-telefono" value={profileForm.telefono} onChange={handleProfileInputChange("telefono")} placeholder={t("profile.phonePlaceholder")} autoComplete="tel" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-organizacion">{t("profile.organization")}</Label>
                            <Input id="profile-organizacion" value={profileForm.organizacion} onChange={handleProfileInputChange("organizacion")} placeholder={t("profile.organizationPlaceholder")} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-cargo">{t("profile.position")}</Label>
                            <Input id="profile-cargo" value={profileForm.cargo} onChange={handleProfileInputChange("cargo")} placeholder={t("profile.positionPlaceholder")} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-experiencia">{t("profile.experience")}</Label>
                            <Input id="profile-experiencia" type="number" min="0" value={profileForm.experiencia} onChange={handleProfileInputChange("experiencia")} placeholder={t("profile.experiencePlaceholder")} />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("profile.avatar")}</Label>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Avatar className="h-16 w-16">
                                        {profileForm.avatarUrl ? (
                                            <AvatarImage src={profileForm.avatarUrl} alt="Avatar" />
                                        ) : null}
                                        <AvatarFallback style={{ backgroundColor: '#94c120', color: 'white', fontSize: '1.25rem' }}>{initials}</AvatarFallback>
                                    </Avatar>
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={isUploadingAvatar}
                                        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        <Camera className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={isUploadingAvatar}
                                    >
                                        {isUploadingAvatar ? t("profile.saving") : t("profile.changeAvatar")}
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground">JPG, PNG o WebP. Máx 5 MB.</p>
                                </div>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("auth.email")}: {user?.email}</p>
                        {profileFeedback && (
                            <p className="text-sm text-primary" role="status">{profileFeedback}</p>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                                {t("common.close")}
                            </Button>
                            <Button type="submit" disabled={profileSaving}>
                                {profileSaving ? t("profile.saving") : t("profile.saveChanges")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={isArchivedDialogOpen} onOpenChange={setIsArchivedDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("archivedDialog.title")}</DialogTitle>
                        <DialogDescription>{t("sidebar.archivedChats")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {archivedChats.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("archivedDialog.empty")}</p>
                        ) : (
                            archivedChats.map((chat) => (
                                <div key={chat.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm">
                                    <div className="font-medium">{chat.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(chat.createdAt, locale)}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleRestoreArchivedChat(chat.id)}>
                                            {t("archivedDialog.restore")}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleArchiveChat(chat.id)}>
                                            {t("sidebar.unarchive")}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => setIsArchivedDialogOpen(false)} variant="outline">{t("common.close")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    setIsDeleteDialogOpen(open)
                    if (!open) {
                        setChatPendingDeletion(null)
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("deleteDialog.title")}</DialogTitle>
                        <DialogDescription>{t("deleteDialog.warning")}</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm">
                        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                        <p>
                            {t("deleteDialog.message")}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleCancelDeleteChat}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmDeleteChat}
                            disabled={isDeletingChat}
                        >
                            {isDeletingChat ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Configuración */}
            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl">{t("settings.title")}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-1 gap-6 overflow-hidden">
                        {/* Sidebar de navegación */}
                        <div className="w-48 shrink-0 space-y-1">
                            <button
                                type="button"
                                onClick={() => setSettingsTab("general")}
                                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
                                    settingsTab === "general"
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent/50"
                                }`}
                            >
                                <Settings className="h-4 w-4" />
                                {t("settings.general")}
                            </button>
                            {hasTools && (
                                <button
                                    type="button"
                                    onClick={() => setSettingsTab("conectores")}
                                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
                                        settingsTab === "conectores"
                                            ? "bg-accent text-accent-foreground"
                                            : "text-muted-foreground hover:bg-accent/50"
                                    }`}
                                >
                                    <Plug className="h-4 w-4" />
                                    Conectores
                                </button>
                            )}
                        </div>

                        {/* Contenido de configuración */}
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                            {settingsTab === "general" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">{t("settings.appearance")}</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ThemeToggleButton />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">{t("settings.language")}</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("settings.languageDesc")}
                                        </p>
                                    </div>
                                    <select
                                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                        value={locale}
                                        onChange={async (e) => {
                                            const newLocale = e.target.value as Locale
                                            setLocale(newLocale)
                                            // Also save to backend if user is authenticated
                                            if (isAuthenticated && token) {
                                                try {
                                                    await updateProfile({ idioma: newLocale })
                                                } catch (error) {
                                                    console.error("Error saving language preference:", error)
                                                }
                                            }
                                        }}
                                    >
                                        {locales.map((loc) => (
                                            <option key={loc} value={loc}>
                                                {localeNames[loc]}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Fuente del chat */}
                                <div className="space-y-3 pt-2">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium flex items-center gap-2">
                                            <Type className="h-4 w-4" />
                                            {t("settings.chatFont")}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("settings.chatFontDesc")}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: "inter", label: "Predeterminada", fontClass: "font-sans" },
                                            { id: "dm-sans", label: "Sans moderna", fontClass: "font-[family-name:var(--font-dm-sans)]" },
                                            { id: "lora", label: "Serif clásica", fontClass: "font-[family-name:var(--font-lora)]" },
                                            { id: "lexend", label: "Legible", fontClass: "font-[family-name:var(--font-lexend)]" },
                                        ].map((font) => (
                                            <button
                                                key={font.id}
                                                type="button"
                                                onClick={async () => {
                                                    if (isAuthenticated && token) {
                                                        try {
                                                            await updateProfile({ fuenteChat: font.id })
                                                        } catch (error) {
                                                            console.error("Error saving font preference:", error)
                                                        }
                                                    }
                                                }}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:border-primary/50",
                                                    chatFont === font.id
                                                        ? "border-primary bg-primary/5 shadow-sm"
                                                        : "border-border/60 bg-card"
                                                )}
                                            >
                                                <span className={cn("text-xs leading-relaxed text-center", font.fontClass)}>
                                                    El veloz murciélago hindú comía...
                                                </span>
                                                <span className="text-[10px] font-medium text-muted-foreground">{font.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            )}

                            {settingsTab === "conectores" && hasTools && token && (
                                <ConnectoresPanel token={token} />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Diálogo de búsqueda de chats */}
            <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t("searchDialog.title")}</DialogTitle>
                        <DialogDescription>
                            {t("searchDialog.placeholder")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={t("common.search") + "..."}
                                value={searchQuery}
                                onChange={handleSearchQueryChange}
                                className="pl-10"
                                autoFocus
                            />
                        </div>

                        <ScrollArea className="flex-1 -mx-6 px-6">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-8">
                                    <Sparkles className="h-6 w-6 animate-pulse text-primary" />
                                </div>
                            ) : searchQuery.trim() === "" ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Search className="h-12 w-12 text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        {t("searchDialog.placeholder")}
                                    </p>
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        {t("searchDialog.noResults")}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {searchResults.map((chat) => {
                                        const matchesInContent = chat.messages.filter((msg) =>
                                            msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                                        ).length

                                        return (
                                            <button
                                                key={chat.id}
                                                onClick={() => handleSelectSearchResult(chat.id)}
                                                className={cn(
                                                    "w-full text-left rounded-lg border border-border/60 bg-background p-4 transition-colors hover:bg-muted/50",
                                                    chat.archived && "opacity-70"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <MessageSquare className="h-4 w-4 flex-shrink-0 text-primary" />
                                                            <h4 className="font-medium text-sm truncate">
                                                                {chat.title}
                                                            </h4>
                                                            {chat.archived && (
                                                                <Archive className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {chat.messages.length} {t("usageStats.messages").toLowerCase()}
                                                            {matchesInContent > 0 && (
                                                                <> • {matchesInContent}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsSearchDialogOpen(false)
                                setSearchQuery("")
                                setSearchResults([])
                            }}
                        >
                            {t("common.close")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {mustChangePassword && token && (
                <ChangePasswordModal
                    token={token}
                    onSuccess={clearPasswordChangeFlag}
                />
            )}

            {/* Canvas Dialog */}
            <CanvasDialog
                open={canvasOpen}
                onClose={(finalContent) => {
                    setCanvasOpen(false)
                    if (finalContent && activeChat) {
                        const targetId = canvasMessageId
                        setChats(prev => prev.map(chat => {
                            if (chat.id !== activeChatId) return chat

                            // 1. Buscar el mensaje exacto por su ID (caso normal)
                            const foundByIdIdx = targetId
                                ? chat.messages.findIndex(m => m.id === targetId)
                                : -1

                            if (foundByIdIdx >= 0) {
                                return {
                                    ...chat,
                                    messages: chat.messages.map((msg, i) =>
                                        i === foundByIdIdx
                                            ? { ...msg, content: finalContent, isWorkContent: true }
                                            : msg
                                    ),
                                }
                            }

                            // 2. Fallback: actualizar el último mensaje del asistente
                            //    (caso canvas abierto desde respuesta nueva antes de recarga de IDs)
                            const lastAssistantIdx = [...(chat.messages)].reverse()
                                .findIndex(m => m.role === "asistente")
                            if (lastAssistantIdx >= 0) {
                                const actualIdx = (chat.messages.length - 1) - lastAssistantIdx
                                return {
                                    ...chat,
                                    messages: chat.messages.map((msg, i) =>
                                        i === actualIdx
                                            ? { ...msg, content: finalContent, isWorkContent: true }
                                            : msg
                                    ),
                                }
                            }

                            return chat
                        }))
                    }
                    setCanvasMessageId(null)
                }}
                initialContent={canvasContent}
                conversationId={activeChat?.conversationId ?? null}
                messageId={canvasMessageId}
                token={token ?? ""}
                userInitials={initials}
                userLanguage={user?.idioma ?? "es"}
            />

            {/* Share Dialog */}
            <ShareDialog
                open={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                messageContent={shareMessageContent}
                conversationTitle={shareConversationTitle}
                token={token ?? ""}
            />

            {/* Google Drive Picker */}
            <GoogleDrivePicker
                open={isDrivePickerOpen}
                onOpenChange={setIsDrivePickerOpen}
                token={token ?? ""}
                onFilesSelected={handleDriveFilesSelected}
            />

            {/* Carpetas de trabajo - Diálogos */}
            <CarpetaDialog
                open={carpetaDialogOpen}
                onOpenChange={setCarpetaDialogOpen}
                carpeta={carpetaEditing}
                onSave={handleSaveFolder}
                saving={carpetaSaving}
            />

            {/* Dialog de límite alcanzado */}
            <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {t("limits.title")}
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-sm leading-relaxed">
                            {limitDialogMessage}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-medium mb-1">{t("limits.dailyLimit")}</p>
                        <p>{t("limits.resetInfo")}</p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setLimitDialogOpen(false)}>
                            {t("limits.understood")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CarpetaShareDialog
                open={carpetaShareDialogOpen}
                onOpenChange={setCarpetaShareDialogOpen}
                carpeta={carpetaSharing}
                onShare={async (email, permisos) => {
                    if (!carpetaSharing) return false
                    return await carpetasHook.compartirCarpeta(carpetaSharing.id, email, permisos)
                }}
                onUnshare={async (userId) => {
                    if (!carpetaSharing) return false
                    return await carpetasHook.dejarDeCompartir(carpetaSharing.id, userId)
                }}
                onSearchUsers={carpetasHook.buscarUsuariosPro}
            />
        </div>
    )
}