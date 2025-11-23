"use client"

import Image from "next/image"
import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    Activity,
    Archive,
    BookOpen,
    BookOpenCheck,
    ChevronsLeft,
    ChevronsRight,
    LogOut,
    ListTodo,
    MessageSquare,
    MoreHorizontal,
    Send,
    Share2,
    Sparkles,
    CalendarClock,
    Trash2,
    AlertTriangle,
    Plus,
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
    Search,
    Paperclip,
    Wrench,
    Tag,
    Mic,
    Square,
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
import { UsageStats } from "@/components/usage-stats"
import { downloadAsPDF, downloadAsWord } from "@/lib/document-generator"
import { ChangePasswordModal } from "@/components/change-password-modal"

type MessageRole = "usuario" | "asistente"

type ChatMessage = {
    id: string
    role: MessageRole
    content: string
    createdAt?: string
    pending?: boolean
}

type Chat = {
    id: string
    conversationId: string | null
    title: string
    createdAt: Date
    messages: ChatMessage[]
    archived?: boolean
    intent?: string | null
    hasLoaded?: boolean
    isLoading?: boolean
}

type QuickPrompt = {
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

function formatChatTitle(date: Date): string {
    const formattedDate = date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
    const formattedTime = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false })
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
    const { user, status, isAuthenticated, token, logout, updateProfile } = useAuth()

    const [chats, setChats] = useState<Chat[]>([])
    const [activeChatId, setActiveChatId] = useState<string>("")
    const [inputValue, setInputValue] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isChatsListCollapsed, setIsChatsListCollapsed] = useState(false)
    const [loadingConversations, setLoadingConversations] = useState(false)
    const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false)
    const [chatError, setChatError] = useState<string | null>(null)
    const [shareFeedback, setShareFeedback] = useState<string | null>(null)
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
    const [isDeletingChat, setIsDeletingChat] = useState(false)
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Chat[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const activeChatIdRef = useRef<string>("")
    const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
    const quickPrompts = useMemo<QuickPrompt[]>(
        () => [
            {
                label: "Dinámicas y Actividades",
                icon: Activity,
                template: "Necesito una actividad para jóvenes de 15 a 17 años centrada en el trabajo en equipo.",
                intent: "DINAMICA",
                tags: ["DINAMICAS"],
            },
            {
                label: "Celebraciones",
                icon: PartyPopper,
                template: "Diseña una celebración juvenil para el inicio del año pastoral.",
                intent: "CELEBRACION",
                tags: ["CELEBRACIONES"],
            },
            {
                label: "Programaciones",
                icon: CalendarClock,
                template: "Diseña una programación trimestral para un grupo juvenil que se reúne los sábados.",
                intent: "PROGRAMACION",
                tags: ["PROGRAMACIONES"],
            },
            {
                label: "Oraciones",
                icon: BookOpen,
                template: "Necesito una oración breve para iniciar una reunión de jóvenes de 13 años.",
                intent: "ORACION",
                tags: ["ORACIONES"],
            },
            {
                label: "Otros",
                icon: FileText,
                template: "Ayúdame con un recurso creativo para motivar a un grupo juvenil.",
                intent: "OTROS",
                tags: ["OTROS", "CONTENIDO_MIXTO"],
            },
        ],
        [],
    )
    const [selectedQuickPrompts, setSelectedQuickPrompts] = useState<string[]>([])
    const [isThinkingMode, setIsThinkingMode] = useState(false)
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
    
    const selectedQuickPromptItems = useMemo(() => {
        const labelSet = new Set(selectedQuickPrompts)
        return quickPrompts.filter((prompt) => labelSet.has(prompt.label))
    }, [quickPrompts, selectedQuickPrompts])

    const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? null, [chats, activeChatId])
    const sidebarChats = useMemo(() => chats.filter((chat) => !chat.archived), [chats])
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
    const canAccessDocumentation = ["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR"].includes(userRole)
    const canAccessAdministration = ["SUPERADMIN", "ADMINISTRADOR"].includes(userRole)
    const canShowOptions = canAccessDocumentation || canAccessAdministration

    const { mustChangePassword, clearPasswordChangeFlag } = useAuth()

    // Resetear el flag de chat inicial cuando el usuario se desautentica
    useEffect(() => {
        if (status === "unauthenticated") {
            initialChatCreatedRef.current = false
            setHasInitialLoadCompleted(false)
            router.replace("/auth/login")
        }
    }, [router, status])


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
                const message = await response.text()
                throw new Error(message || "No se pudieron cargar las conversaciones")
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
                const message = await response.text()
                throw new Error(message || "No se pudo cargar la conversación")
            }

            const data = await response.json()
            const conversation = data?.conversation
            const messages: ChatMessage[] = Array.isArray(data?.messages)
                ? data.messages.map((msg: any) => ({
                    id: msg.id,
                    role: toFrontendRole(msg.role),
                    content: msg.content,
                    createdAt: msg.fechaCreacion,
                }))
                : []

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
        setInputValue("")
        setChatError(null)

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
                })

                const initialData = await initialResponse.json().catch(() => null)
                
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
                                        id: createId(),
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
                }),
            })

            const data = await response.json().catch(() => null)

            if (!response.ok || !data?.message?.content) {
                const message = data?.message || data?.error || "No se pudo generar la respuesta"
                throw new Error(typeof message === "string" ? message : "No se pudo generar la respuesta")
            }

            const assistantMessage: ChatMessage = {
                id: createId(),
                role: "asistente",
                content: data.message.content,
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
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo generar la respuesta"
            setChatError(message)
        } finally {
            setIsThinking(false)
        }
    }, [activeChat, fetchConversations, inputValue, isThinking, token, selectedQuickPromptItems, isThinkingMode, attachedFiles, isUploadingFiles, loadConversationMessages])

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

    const handleQuickPromptToggle = useCallback((prompt: QuickPrompt) => {
        setSelectedQuickPrompts((prev) => {
            if (prev.includes(prompt.label)) {
                return prev.filter((label) => label !== prompt.label)
            }
            return [...prev, prompt.label]
        })
    }, [])

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
    }, [])

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }, [isRecording])

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

            console.log('📤 Enviando audio al servidor...')
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
    }, [token])

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
            .map((message) => `${message.role === "usuario" ? "Usuario" : "Asistente"}:\n${message.content}`)
            .join("\n\n")

        try {
            await navigator?.clipboard?.writeText(transcript)
            setShareFeedback("Conversación copiada al portapapeles")
        } catch (error) {
            console.error("No se pudo copiar la conversación", error)
            setShareFeedback("No se pudo copiar la conversación")
        }
    }

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
                    <p className="text-sm text-muted-foreground">Preparando tu espacio de trabajo...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        router.push("/auth/login")
        return null
    }

    const sidebarWidthClass = isSidebarCollapsed ? "w-20" : "w-80"
    
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
                    {chatError && (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                            <span>{chatError}</span>
                        </div>
                    )}
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
                            placeholder="¿Cómo puedo ayudarte hoy?"
                            className={cn(
                                "min-h-0 max-h-32 resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 shadow-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                            )}
                            rows={1}
                            disabled={isThinking || !activeChat}
                        />
                        
                        {/* Badges de etiquetas seleccionadas - solo cuando hay mensajes */}
                        {hasMessages && selectedQuickPromptItems.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedQuickPromptItems.map((item) => {
                                    const Icon = item.icon
                                    const categoryColors: Record<string, string> = {
                                        "Dinámicas y Actividades": "border-emerald-500 bg-emerald-100 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300",
                                        "Celebraciones": "border-pink-500 bg-pink-100 text-pink-800 dark:border-pink-500 dark:bg-pink-950/60 dark:text-pink-300",
                                        "Programaciones": "border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300",
                                        "Oraciones": "border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300",
                                        "Otros": "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-950/60 dark:text-slate-300",
                                    }
                                    const colorClass = categoryColors[item.label] || "border-gray-500 bg-gray-100 text-gray-800 dark:border-gray-500 dark:bg-gray-950/60 dark:text-gray-300"
                                    return (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => handleQuickPromptToggle(item)}
                                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-80 ${colorClass}`}
                                        >
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                            {item.label}
                                        </button>
                                    )
                                })}
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
                                        <span className="text-xs opacity-70">({file.wordCount} palabras)</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(file.fileName)}
                                            className="ml-1 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-900"
                                            aria-label={`Eliminar ${file.fileName}`}
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
                                {/* Botón clip para archivos */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 rounded-full"
                                                aria-label="Adjuntar archivos"
                                                onClick={handleFileSelect}
                                                disabled={isThinking || isUploadingFiles}
                                            >
                                                <Paperclip className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>Adjuntar archivos (imágenes JPG/PNG, PDFs)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                
                                {/* Botón llave inglesa para herramientas */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0 rounded-full"
                                                            aria-label="Herramientas"
                                                        >
                                                            <Wrench className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" className="w-56">
                                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                            No hay herramientas disponibles
                                                        </div>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>Herramientas</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                
                                {/* Selector de etiquetas - solo cuando hay mensajes */}
                                {hasMessages && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0 rounded-full"
                                                                aria-label="Seleccionar categorías"
                                                            >
                                                                <Tag className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start" className="w-56">
                                                            {quickPrompts.map((item) => {
                                                                const Icon = item.icon
                                                                const isSelected = selectedQuickPrompts.includes(item.label)
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
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>Selecciona categorías para filtrar los documentos</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                            
                            <div className="flex shrink-0 items-center gap-2">
                                {/* Badge Thinking */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => setIsThinkingMode(!isThinkingMode)}
                                                className="transition"
                                                aria-label="Modo Thinking"
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
                                                    Thinking
                                                </Badge>
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>Activa el modelo de razonamiento profundo</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                
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
                                                aria-label={isRecording ? "Detener grabación" : "Dictar"}
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
                                            <p>{isRecording ? "Detener grabación" : isTranscribing ? "Transcribiendo..." : "Dictar"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-full"
                                    disabled={isThinking || inputValue.trim().length === 0 || !activeChat}
                                    aria-label="Enviar"
                                >
                                    <Send className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Etiquetas debajo de la caja - solo cuando NO hay mensajes */}
                    {!hasMessages && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {quickPrompts.map((item) => {
                                const Icon = item.icon
                                const isSelected = selectedQuickPrompts.includes(item.label)
                                const categoryColors: Record<string, { base: string, selected: string }> = {
                                    "Dinámicas y Actividades": {
                                        base: "border-emerald-500/30 bg-transparent text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                                        selected: "border-emerald-500 bg-emerald-100 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    },
                                    "Celebraciones": {
                                        base: "border-pink-500/30 bg-transparent text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30",
                                        selected: "border-pink-500 bg-pink-100 text-pink-800 dark:border-pink-500 dark:bg-pink-950/60 dark:text-pink-300"
                                    },
                                    "Programaciones": {
                                        base: "border-blue-500/30 bg-transparent text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30",
                                        selected: "border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300"
                                    },
                                    "Oraciones": {
                                        base: "border-violet-500/30 bg-transparent text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30",
                                        selected: "border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300"
                                    },
                                    "Otros": {
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
                                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${colorClass}`}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {item.label}
                                    </button>
                                )
                            })}
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
                    "flex h-full flex-col border-r border-border/50 bg-muted/40 backdrop-blur transition-all duration-300",
                    sidebarWidthClass,
                )}
            >
                {/* Logo y título */}
                <div className="flex items-center justify-between px-4 pt-6 pb-4">
                    {isSidebarCollapsed ? (
                        <span className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-md mx-auto">
                            <Image src="/LogotipoRPJ_circulo.png" alt="RPJ" width={48} height={48} priority className="object-cover" />
                        </span>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="relative inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-md">
                                    <Image src="/LogotipoRPJ_circulo.png" alt="RPJ" width={56} height={56} priority className="object-cover" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-base font-semibold leading-tight">IA Asistente de</span>
                                    <span className="text-base font-semibold leading-tight">Pastoral Juvenil RPJ</span>
                                </div>
                            </div>
                            {/* Botón de colapsar junto al título */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                                className="h-9 w-9"
                                aria-label="Ocultar menú"
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
                    <div className="flex flex-col gap-3 px-2">
                        {/* Nuevo chat - colapsado */}
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCreateNewChat}
                                        className="h-11 w-11 rounded-full hover:bg-primary/10"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>Nuevo chat</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Buscar chats - colapsado */}
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsSearchDialogOpen(true)}
                                        className="h-11 w-11 rounded-full hover:bg-primary/10"
                                    >
                                        <Search className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>Buscar chats</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Botón expandir */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarCollapsed(false)}
                            className="h-9 w-9 mx-auto"
                            aria-label="Mostrar menú"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Nuevo chat - expandido */}
                        <button
                            type="button"
                            onClick={handleCreateNewChat}
                            className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Nuevo chat</span>
                        </button>

                        {/* Buscar chats - expandido */}
                        <button
                            type="button"
                            onClick={() => setIsSearchDialogOpen(true)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <Search className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Buscar chats</span>
                        </button>

                        {/* Título Chats */}
                        <button
                            onClick={() => setIsChatsListCollapsed(!isChatsListCollapsed)}
                            className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Chats</span>
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
                                            No hay chats todavía. Crea un nuevo chat para empezar.
                                        </div>
                                    )}

                                    {sidebarChats.map((chat) => {
                                    const isActive = chat.id === activeChatId
                                    const truncatedTitle = chat.title.length > 25 ? chat.title.substring(0, 25) + '...' : chat.title

                                    return (
                                        <div
                                            key={chat.id}
                                            className={cn(
                                                "group relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors",
                                                isActive ? "bg-primary/10" : "hover:bg-muted/50",
                                            )}
                                            onClick={() => handleSelectChat(chat.id)}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                <span className="truncate text-sm font-medium">
                                                    {truncatedTitle}
                                                </span>
                                            </div>
                                            
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 flex-shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-muted"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                    <DropdownMenuItem
                                                        onSelect={(event) => {
                                                            event.preventDefault()
                                                    handleShareChat(chat.id)
                                                }}
                                            >
                                                <Share2 className="mr-2 h-4 w-4" aria-hidden="true" /> Compartir
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={(event) => {
                                                    event.preventDefault()
                                                    handleArchiveChat(chat.id)
                                                }}
                                            >
                                                <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                                                Archivar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onSelect={(event) => {
                                                    event.preventDefault()
                                                    handleRequestDeleteChat(chat)
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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
                                                className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[#009846] text-sm font-semibold uppercase text-white hover:bg-[#007a38] transition-colors"
                                            >
                                                {initials}
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="center"
                                            side="right"
                                            className="w-56"
                                        >
                                            <DropdownMenuItem onSelect={() => setIsUserDialogOpen(true)}>
                                                <User className="mr-2 h-4 w-4" />
                                                Usuario
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setIsArchivedDialogOpen(true)}>
                                                <Archive className="mr-2 h-4 w-4" />
                                                Chats archivados
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
                                                <Settings className="mr-2 h-4 w-4" />
                                                Configuración
                                            </DropdownMenuItem>
                                            {canShowOptions && (
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <FileStack className="mr-2 h-4 w-4" />
                                                        Opciones
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="w-48">
                                                        {canAccessDocumentation && (
                                                            <DropdownMenuItem onSelect={() => router.push("/documentacion")}>
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                Documentación
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canAccessAdministration && (
                                                            <DropdownMenuItem onSelect={() => router.push("/admin")}>
                                                                <UserCog className="mr-2 h-4 w-4" />
                                                                Administración
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
                                                Salir
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
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#009846] text-sm font-semibold uppercase text-white">
                                            {initials}
                                        </div>
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
                                        Usuario
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsArchivedDialogOpen(true)}>
                                        <Archive className="mr-2 h-4 w-4" />
                                        Chats archivados
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Configuración
                                    </DropdownMenuItem>
                                    {canShowOptions && (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <FileStack className="mr-2 h-4 w-4" />
                                                Opciones
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="w-48">
                                                {canAccessDocumentation && (
                                                    <DropdownMenuItem onSelect={() => router.push("/documentacion")}>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        Documentación
                                                    </DropdownMenuItem>
                                                )}
                                                {canAccessAdministration && (
                                                    <DropdownMenuItem onSelect={() => router.push("/admin")}>
                                                        <UserCog className="mr-2 h-4 w-4" />
                                                        Administración
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
                                        Salir
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
                    <div className="flex items-center gap-8">
                        <Link 
                            href="/acerca-de"
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Info className="h-4 w-4" />
                            Acerca de la IA RPJ
                        </Link>
                        <Link 
                            href="/guia-documental"
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <BookOpenCheck className="h-4 w-4" />
                            Guía documental
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        {shareFeedback && (
                            <p className="text-xs text-primary/80" role="status">
                                {shareFeedback}
                            </p>
                        )}
                        <ThemeToggleButton />
                    </div>
                </header>

                <section className="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/40">
                    {!hasMessages ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8" style={{ paddingBottom: "15%" }}>
                            <div className="flex flex-col items-center gap-6 text-center">
                                <p className="text-3xl font-semibold text-foreground max-w-2xl leading-relaxed">
                                    {activeChat?.messages[0]?.role === "asistente" && activeChat?.messages[0]?.content 
                                        ? activeChat.messages[0].content 
                                        : "¿En qué puedo ayudarte?"}
                                </p>
                            </div>
                            {renderPromptComposer("center")}
                        </div>
                    ) : (
                        <div className="flex h-full flex-col overflow-hidden">
                            <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-8 py-8">
                            {activeChat?.isLoading && activeChat.messages.length === 0 && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
                                    <span>Cargando conversación…</span>
                                </div>
                            )}

                            {activeChat && activeChat.messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn("flex gap-3", message.role === "usuario" ? "justify-end" : "justify-start")}
                                >
                                    {message.role === "asistente" && (
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>IA</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                        className={cn(
                                            "relative max-w-[80%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                                            message.role === "usuario"
                                                ? "border-primary/10 bg-primary text-primary-foreground"
                                                : "border-border/60 bg-card text-foreground",
                                        )}
                                    >
                                        {message.role === "asistente" && (
                                            <div className="absolute right-2 top-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-muted"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
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
                                                            Documento PDF (.pdf)
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
                                                            Documento de Microsoft Word (.docx)
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                        {message.role === "asistente" ? (
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                                                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                                                        li: ({ children }) => <li className="mb-1">{children}</li>,
                                                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                        em: ({ children }) => <em className="italic">{children}</em>,
                                                        h1: ({ children }) => <h1 className="mb-2 text-xl font-bold">{children}</h1>,
                                                        h2: ({ children }) => <h2 className="mb-2 text-lg font-bold">{children}</h2>,
                                                        h3: ({ children }) => <h3 className="mb-2 text-base font-bold">{children}</h3>,
                                                        code: ({ children, ...props }) => {
                                                            const isInline = !props.className
                                                            return isInline ? (
                                                                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
                                                            ) : (
                                                                <code className="block rounded bg-muted p-2 font-mono text-xs">{children}</code>
                                                            )
                                                        },
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{message.content}</div>
                                        )}
                                    </div>
                                    {message.role === "usuario" && (
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>{initials}</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}

                            {isThinking && (
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback>IA</AvatarFallback>
                                    </Avatar>
                                    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2">
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "120ms" }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "240ms" }} />
                                        <span className="text-xs font-medium text-muted-foreground">Pensando...</span>
                                    </div>
                                </div>
                            )}

                            {!activeChat && (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    Selecciona o crea un chat para comenzar.
                                </div>
                            )}
                        </div>
                            {renderPromptComposer("bottom")}
                        </div>
                    )}
                </section>
            </main>
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Perfil de usuario</DialogTitle>
                        <DialogDescription>Actualiza tus datos personales. Esta información ayuda a personalizar las propuestas del asistente.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleProfileSubmit}>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-nombre">Nombre</Label>
                            <Input id="profile-nombre" value={profileForm.nombre} onChange={handleProfileInputChange("nombre")} placeholder="Nombre" autoComplete="given-name" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-apellidos">Apellidos</Label>
                            <Input id="profile-apellidos" value={profileForm.apellidos} onChange={handleProfileInputChange("apellidos")} placeholder="Apellidos" autoComplete="family-name" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-telefono">Teléfono</Label>
                            <Input id="profile-telefono" value={profileForm.telefono} onChange={handleProfileInputChange("telefono")} placeholder="Teléfono de contacto" autoComplete="tel" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-organizacion">Organización</Label>
                            <Input id="profile-organizacion" value={profileForm.organizacion} onChange={handleProfileInputChange("organizacion")} placeholder="Nombre de la organización" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-cargo">Cargo</Label>
                            <Input id="profile-cargo" value={profileForm.cargo} onChange={handleProfileInputChange("cargo")} placeholder="Ej. Coordinador de juventud" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-experiencia">Experiencia (años)</Label>
                            <Input id="profile-experiencia" type="number" min="0" value={profileForm.experiencia} onChange={handleProfileInputChange("experiencia")} placeholder="0" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile-avatar">URL de avatar</Label>
                            <Input id="profile-avatar" value={profileForm.avatarUrl} onChange={handleProfileInputChange("avatarUrl")} placeholder="https://..." autoComplete="url" />
                        </div>
                        <p className="text-xs text-muted-foreground">Correo: {user?.email}</p>
                        {profileFeedback && (
                            <p className="text-sm text-primary" role="status">{profileFeedback}</p>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                                Cerrar
                            </Button>
                            <Button type="submit" disabled={profileSaving}>
                                {profileSaving ? "Guardando..." : "Guardar cambios"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={isArchivedDialogOpen} onOpenChange={setIsArchivedDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Chats archivados</DialogTitle>
                        <DialogDescription>Los chats archivados se ocultan del panel lateral. Desarchívalos para recuperarlos cuando los necesites.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {archivedChats.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No hay chats archivados por ahora.</p>
                        ) : (
                            archivedChats.map((chat) => (
                                <div key={chat.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm">
                                    <div className="font-medium">{chat.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">Archivado el {chat.createdAt.toLocaleString("es-ES")}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleRestoreArchivedChat(chat.id)}>
                                            Abrir
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleArchiveChat(chat.id)}>
                                            Desarchivar
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => setIsArchivedDialogOpen(false)} variant="outline">Cerrar</Button>
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
                        <DialogTitle>Eliminar chat</DialogTitle>
                        <DialogDescription>Esta acción no se puede deshacer. El historial y las respuestas generadas se perderán definitivamente.</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm">
                        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                        <p>
                            ¿Seguro que quieres eliminar <span className="font-semibold">{chatPendingDeletion?.title ?? "esta conversación"}</span>?
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleCancelDeleteChat}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmDeleteChat}
                            disabled={isDeletingChat}
                        >
                            {isDeletingChat ? "Eliminando..." : "Eliminar definitivamente"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Configuración */}
            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Configuración</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-1 gap-6 overflow-hidden">
                        {/* Sidebar de navegación */}
                        <div className="w-48 shrink-0 space-y-1">
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-left"
                            >
                                <Settings className="h-4 w-4" />
                                General
                            </button>
                        </div>
                        
                        {/* Contenido de configuración */}
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">Apariencia</Label>
                                    </div>
                                    <ThemeToggleButton />
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">Idioma</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Selecciona el idioma de la interfaz
                                        </p>
                                    </div>
                                    <select 
                                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                        defaultValue="es"
                                    >
                                        <option value="es">Español</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Diálogo de búsqueda de chats */}
            <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Buscar en chats</DialogTitle>
                        <DialogDescription>
                            Busca en todos tus chats (activos y archivados) por título o contenido
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Escribe para buscar..."
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
                                        Escribe algo para buscar en tus chats
                                    </p>
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        No se encontraron chats que coincidan con &quot;{searchQuery}&quot;
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
                                                            {chat.messages.length} {chat.messages.length === 1 ? "mensaje" : "mensajes"}
                                                            {matchesInContent > 0 && (
                                                                <> • {matchesInContent} {matchesInContent === 1 ? "coincidencia" : "coincidencias"}</>
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
                            Cerrar
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
        </div>
    )
}