"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
    ArrowLeft,
    ExternalLink,
    Smartphone,
    Monitor,
    ChevronRight,
    ChevronDown,
    Menu,
    X,
    BookOpen,
    LogIn,
    MessageSquare,
    FolderOpen,
    Puzzle,
    Palette,
    HelpCircle,
    Mail,
    Brain,
    PenTool,
    Paperclip,
    Mic,
    ThumbsUp,
    Share2,
    FileDown,
    Search,
    Archive,
    Sparkles,
    Sun,
    Globe,
    Type,
    CreditCard,
    Shield,
    Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"

// ─── Tipos ───────────────────────────────────────────────
interface SidebarItem {
    id: string
    icon?: React.ReactNode
    children?: SidebarItem[]
    badge?: string
}

// ─── Estructura del sidebar ──────────────────────────────
const GUIDE_STRUCTURE: SidebarItem[] = [
    {
        id: "introduccion",
        icon: <BookOpen className="h-4 w-4" />,
    },
    {
        id: "primeros-pasos",
        icon: <LogIn className="h-4 w-4" />,
        children: [
            { id: "crear-cuenta" },
            { id: "iniciar-sesion" },
            { id: "cambiar-contrasena" },
            { id: "tu-perfil" },
        ],
    },
    {
        id: "chat-ia",
        icon: <MessageSquare className="h-4 w-4" />,
        children: [
            { id: "crear-conversacion" },
            { id: "categorias-consulta" },
            { id: "escribir-prompt" },
            { id: "modo-deep-think", badge: "PRO" },
            { id: "modo-lienzo", badge: "PRO" },
            { id: "adjuntar-archivos" },
            { id: "dictar-por-voz" },
            { id: "feedback-respuestas" },
            { id: "compartir-contenido" },
            { id: "descargar-respuestas" },
        ],
    },
    {
        id: "conversaciones",
        icon: <FolderOpen className="h-4 w-4" />,
        children: [
            { id: "gestionar-conversaciones" },
            { id: "buscar-conversaciones" },
            { id: "archivar-eliminar" },
            { id: "carpetas-trabajo", badge: "PRO" },
            { id: "fuentes-consultadas" },
        ],
    },
    {
        id: "conectores",
        icon: <Puzzle className="h-4 w-4" />,
        badge: "PRO",
        children: [
            { id: "conector-google-drive" },
            { id: "conector-google-docs" },
        ],
    },
    {
        id: "personalizacion",
        icon: <Palette className="h-4 w-4" />,
        children: [
            { id: "tema-claro-oscuro" },
            { id: "idioma" },
            { id: "fuente-chat" },
        ],
    },
    {
        id: "instalar-movil",
        icon: <Smartphone className="h-4 w-4" />,
        children: [
            { id: "android-chrome" },
            { id: "ios-safari" },
        ],
    },
    {
        id: "planes-limites",
        icon: <CreditCard className="h-4 w-4" />,
        children: [
            { id: "plan-free" },
            { id: "plan-pro" },
        ],
    },
    {
        id: "preguntas-frecuentes",
        icon: <HelpCircle className="h-4 w-4" />,
    },
    {
        id: "contacto-soporte",
        icon: <Mail className="h-4 w-4" />,
    },
]

// ─── Componente SidebarNav ───────────────────────────────
function SidebarNav({
    activeSection,
    onNavigate,
    onClose,
}: {
    activeSection: string
    onNavigate: (id: string) => void
    onClose?: () => void
}) {
    const t = useTranslations("guide")
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const navRef = useRef<HTMLElement>(null)

    // Abrir la sección padre cuando cambia el activeSection
    useEffect(() => {
        for (const item of GUIDE_STRUCTURE) {
            if (item.children?.some((c) => c.id === activeSection)) {
                setExpanded((prev) => ({ ...prev, [item.id]: true }))
            }
        }
    }, [activeSection])

    // Scroll del sidebar al ítem activo
    useEffect(() => {
        if (!navRef.current) return
        const activeEl = navRef.current.querySelector(`[data-nav-id="${activeSection}"]`)
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }
    }, [activeSection])

    const toggle = (id: string) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

    const handleClick = (id: string, hasChildren: boolean) => {
        if (hasChildren) {
            toggle(id)
        }
        onNavigate(id)
        onClose?.()
    }

    const handleChildClick = (id: string) => {
        onNavigate(id)
        onClose?.()
    }

    return (
        <nav ref={navRef} className="flex flex-col gap-0.5 text-sm">
            {GUIDE_STRUCTURE.map((item) => {
                const isActive = activeSection === item.id
                const hasChildren = !!item.children?.length
                const isExpanded = expanded[item.id]
                const hasActiveChild = item.children?.some(
                    (c) => c.id === activeSection
                )

                return (
                    <div key={item.id}>
                        <button
                            data-nav-id={item.id}
                            onClick={() => handleClick(item.id, hasChildren)}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                                isActive || hasActiveChild
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            <span className="shrink-0 opacity-70">
                                {item.icon}
                            </span>
                            <span className="flex-1 truncate">
                                {t(`sidebar.${item.id}`)}
                            </span>
                            {item.badge && (
                                <Badge
                                    variant="secondary"
                                    className="ml-auto shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] px-1.5 py-0"
                                >
                                    {item.badge}
                                </Badge>
                            )}
                            {hasChildren && (
                                <span className="shrink-0 text-muted-foreground/50">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                </span>
                            )}
                        </button>

                        {hasChildren && isExpanded && (
                            <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-border/50 pl-3">
                                {item.children!.map((child) => {
                                    const isChildActive =
                                        activeSection === child.id
                                    return (
                                        <button
                                            key={child.id}
                                            data-nav-id={child.id}
                                            onClick={() =>
                                                handleChildClick(child.id)
                                            }
                                            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                                                isChildActive
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            }`}
                                        >
                                            <span className="truncate">
                                                {t(`sidebar.${child.id}`)}
                                            </span>
                                            {child.badge && (
                                                <Badge
                                                    variant="secondary"
                                                    className="ml-auto shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] px-1.5 py-0"
                                                >
                                                    {child.badge}
                                                </Badge>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </nav>
    )
}

// ─── Componente principal ────────────────────────────────
export default function GuiaDeUsoPage() {
    const router = useRouter()
    const t = useTranslations("guide")
    const tOld = useTranslations("usageGuide")
    const [activeSection, setActiveSection] = useState("introduccion")
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    const bold = (chunks: React.ReactNode) => (
        <strong className="font-semibold text-foreground">{chunks}</strong>
    )

    const scrollToSection = useCallback((id: string) => {
        setActiveSection(id)
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }, [])

    // Observar secciones visibles para actualizar sidebar
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id)
                        break
                    }
                }
            },
            { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
        )

        const sections = document.querySelectorAll("[data-section]")
        sections.forEach((s) => observer.observe(s))

        return () => observer.disconnect()
    }, [])

    // ─── Helpers de presentación ─────────────────────────
    const SectionTitle = ({
        id,
        icon,
        badge,
        children,
    }: {
        id: string
        icon?: React.ReactNode
        badge?: string
        children: React.ReactNode
    }) => (
        <h2
            id={id}
            data-section
            className="mt-16 mb-6 scroll-mt-24 text-2xl font-extrabold tracking-tight text-foreground first:mt-0 flex items-center gap-2 border-b-2 border-primary/30 pb-3"
        >
            {icon && <span className="text-primary">{icon}</span>}
            {children}
            {badge && (
                <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs">
                    {badge}
                </Badge>
            )}
        </h2>
    )

    const SubSectionTitle = ({
        id,
        icon,
        badge,
        children,
    }: {
        id: string
        icon?: React.ReactNode
        badge?: string
        children: React.ReactNode
    }) => (
        <h3
            id={id}
            data-section
            className="mt-10 mb-4 scroll-mt-24 text-xl font-bold text-foreground flex items-center gap-2"
        >
            {icon && <span className="text-primary/80">{icon}</span>}
            {children}
            {badge && (
                <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs">
                    {badge}
                </Badge>
            )}
        </h3>
    )

    const Paragraph = ({ children }: { children: React.ReactNode }) => (
        <p className="mb-4 leading-relaxed text-muted-foreground">{children}</p>
    )

    const TipList = ({ items }: { items: React.ReactNode[] }) => (
        <ul className="my-4 ml-6 space-y-3 list-disc marker:text-primary">
            {items.map((item, i) => (
                <li
                    key={i}
                    className="pl-2 text-muted-foreground leading-relaxed"
                >
                    {item}
                </li>
            ))}
        </ul>
    )

    const OrderedList = ({ items }: { items: React.ReactNode[] }) => (
        <ol className="my-4 ml-6 space-y-2 list-decimal marker:text-primary marker:font-semibold">
            {items.map((item, i) => (
                <li
                    key={i}
                    className="pl-2 text-muted-foreground leading-relaxed"
                >
                    {item}
                </li>
            ))}
        </ol>
    )

    const StepBox = ({
        icon,
        title,
        children,
    }: {
        icon: React.ReactNode
        title: string
        children: React.ReactNode
    }) => (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-6 mb-6">
            <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                {icon}
                {title}
            </h4>
            {children}
        </div>
    )

    return (
        <div className="flex h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20">
            {/* Header */}
            <header className="shrink-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 sm:px-8 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2">
                    {/* Mobile toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? (
                            <X className="h-5 w-5" />
                        ) : (
                            <Menu className="h-5 w-5" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/")}
                        className="gap-2 hover:bg-primary/10"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">
                            {t("backToChat")}
                        </span>
                    </Button>
                </div>
                <h1 className="text-sm font-semibold text-foreground sm:text-base">
                    {t("pageTitle")}
                </h1>
                <ThemeToggleButton />
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Mobile overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-20 bg-black/40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={`fixed top-[57px] bottom-0 z-20 w-72 border-r border-border/60 bg-background transition-transform duration-200 lg:static lg:translate-x-0 lg:z-0 ${
                        sidebarOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }`}
                >
                    <ScrollArea className="h-full">
                        <div className="p-4">
                            {/* Logo pequeño */}
                            <div className="mb-6 flex items-center gap-3 px-2">
                                <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden">
                                    <Image
                                        src="/LogotipoRPJ_circulo.png"
                                        alt="Logo RPJ"
                                        fill
                                        className="object-contain"
                                        sizes="40px"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground leading-tight">
                                        {t("sidebarTitle")}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {t("sidebarSubtitle")}
                                    </p>
                                </div>
                            </div>

                            <SidebarNav
                                activeSection={activeSection}
                                onNavigate={scrollToSection}
                                onClose={() => setSidebarOpen(false)}
                            />
                        </div>
                    </ScrollArea>
                </aside>

                {/* Content */}
                <main
                    ref={contentRef}
                    className="flex-1 overflow-y-auto"
                >
                    <div className="mx-auto max-w-4xl px-6 sm:px-10 py-10">
                        <article className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                            {/* ════════ 1. INTRODUCCIÓN ════════ */}
                            <div id="introduccion" data-section>
                                <div className="flex justify-center mb-8">
                                    <div className="relative h-48 w-48 sm:h-64 sm:w-64">
                                        <Image
                                            src="/LogotipoRPJ.png"
                                            alt="Logo RPJ"
                                            fill
                                            className="object-contain"
                                            sizes="256px"
                                            quality={100}
                                            priority
                                        />
                                    </div>
                                </div>

                                <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground text-center">
                                    {tOld("mainTitle")}
                                </h2>

                                <TipList
                                    items={[
                                        tOld.rich("tip1", { bold }),
                                        tOld.rich("tip2", { bold }),
                                        tOld.rich("tip3", { bold }),
                                        <>
                                            {tOld.rich("tip4", { bold })}{" "}
                                            <a
                                                href="mailto:redpj@rpj.es"
                                                className="group inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary transition-all hover:bg-primary/20 hover:underline"
                                            >
                                                redpj@rpj.es
                                                <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                                            </a>
                                        </>,
                                    ]}
                                />
                            </div>

                            {/* ════════ 2. PRIMEROS PASOS ════════ */}
                            <SectionTitle
                                id="primeros-pasos"
                                icon={<LogIn className="h-7 w-7" />}
                            >
                                {t("sections.primerosPasos.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.primerosPasos.intro")}
                            </Paragraph>

                            <SubSectionTitle
                                id="crear-cuenta"
                                icon={<Users className="h-5 w-5" />}
                            >
                                {t("sections.crearCuenta.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.crearCuenta.desc")}
                            </Paragraph>
                            <OrderedList
                                items={[
                                    t("sections.crearCuenta.step1"),
                                    t("sections.crearCuenta.step2"),
                                    t("sections.crearCuenta.step3"),
                                    t("sections.crearCuenta.step4"),
                                    t("sections.crearCuenta.step5"),
                                ]}
                            />

                            <SubSectionTitle
                                id="iniciar-sesion"
                                icon={<LogIn className="h-5 w-5" />}
                            >
                                {t("sections.iniciarSesion.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.iniciarSesion.desc")}
                            </Paragraph>
                            <OrderedList
                                items={[
                                    t("sections.iniciarSesion.step1"),
                                    t("sections.iniciarSesion.step2"),
                                    t("sections.iniciarSesion.step3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="cambiar-contrasena"
                                icon={<Shield className="h-5 w-5" />}
                            >
                                {t("sections.cambiarContrasena.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.cambiarContrasena.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.cambiarContrasena.req1"),
                                    t("sections.cambiarContrasena.req2"),
                                    t("sections.cambiarContrasena.req3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="tu-perfil"
                                icon={<Users className="h-5 w-5" />}
                            >
                                {t("sections.tuPerfil.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.tuPerfil.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.tuPerfil.item1"),
                                    t("sections.tuPerfil.item2"),
                                    t("sections.tuPerfil.item3"),
                                ]}
                            />

                            {/* ════════ 3. EL CHAT IA ════════ */}
                            <SectionTitle
                                id="chat-ia"
                                icon={<MessageSquare className="h-7 w-7" />}
                            >
                                {t("sections.chatIA.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.chatIA.intro")}
                            </Paragraph>

                            <SubSectionTitle
                                id="crear-conversacion"
                                icon={<Sparkles className="h-5 w-5" />}
                            >
                                {t("sections.crearConversacion.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.crearConversacion.desc")}
                            </Paragraph>
                            <OrderedList
                                items={[
                                    t("sections.crearConversacion.step1"),
                                    t("sections.crearConversacion.step2"),
                                    t("sections.crearConversacion.step3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="categorias-consulta"
                                icon={<BookOpen className="h-5 w-5" />}
                            >
                                {t("sections.categorias.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.categorias.desc")}
                            </Paragraph>
                            <div className="grid gap-3 sm:grid-cols-2 my-4 not-prose">
                                {[
                                    {
                                        key: "dinamicas",
                                        icon: (
                                            <Sparkles className="h-5 w-5 text-blue-500" />
                                        ),
                                        color: "border-blue-200 dark:border-blue-800/50",
                                    },
                                    {
                                        key: "oraciones",
                                        icon: (
                                            <BookOpen className="h-5 w-5 text-purple-500" />
                                        ),
                                        color: "border-purple-200 dark:border-purple-800/50",
                                    },
                                    {
                                        key: "celebraciones",
                                        icon: (
                                            <Sun className="h-5 w-5 text-amber-500" />
                                        ),
                                        color: "border-amber-200 dark:border-amber-800/50",
                                    },
                                    {
                                        key: "programaciones",
                                        icon: (
                                            <FolderOpen className="h-5 w-5 text-green-500" />
                                        ),
                                        color: "border-green-200 dark:border-green-800/50",
                                    },
                                    {
                                        key: "consulta",
                                        icon: (
                                            <HelpCircle className="h-5 w-5 text-slate-500" />
                                        ),
                                        color: "border-slate-200 dark:border-slate-700/50",
                                    },
                                ].map((cat) => (
                                    <div
                                        key={cat.key}
                                        className={`flex items-start gap-3 rounded-xl border ${cat.color} bg-muted/20 p-4`}
                                    >
                                        <span className="mt-0.5 shrink-0">
                                            {cat.icon}
                                        </span>
                                        <div>
                                            <p className="font-semibold text-sm text-foreground">
                                                {t(
                                                    `sections.categorias.${cat.key}.name`
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {t(
                                                    `sections.categorias.${cat.key}.desc`
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <SubSectionTitle
                                id="escribir-prompt"
                                icon={<PenTool className="h-5 w-5" />}
                            >
                                {t("sections.escribirPrompt.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.escribirPrompt.desc")}
                            </Paragraph>
                            <StepBox
                                icon={
                                    <PenTool className="h-5 w-5 text-primary" />
                                }
                                title={t(
                                    "sections.escribirPrompt.exampleTitle"
                                )}
                            >
                                <div className="space-y-3">
                                    <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 border border-red-200 dark:border-red-800/40">
                                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                                            ✗{" "}
                                            {t(
                                                "sections.escribirPrompt.badLabel"
                                            )}
                                        </p>
                                        <p className="text-sm text-red-700 dark:text-red-300 italic">
                                            {t(
                                                "sections.escribirPrompt.badExample"
                                            )}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 border border-green-200 dark:border-green-800/40">
                                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                                            ✓{" "}
                                            {t(
                                                "sections.escribirPrompt.goodLabel"
                                            )}
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300 italic">
                                            {t(
                                                "sections.escribirPrompt.goodExample"
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </StepBox>
                            <TipList
                                items={[
                                    t("sections.escribirPrompt.tip1"),
                                    t("sections.escribirPrompt.tip2"),
                                    t("sections.escribirPrompt.tip3"),
                                    t("sections.escribirPrompt.tip4"),
                                ]}
                            />

                            <SubSectionTitle
                                id="modo-deep-think"
                                icon={<Brain className="h-5 w-5" />}
                                badge="PRO"
                            >
                                {t("sections.deepThink.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.deepThink.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.deepThink.tip1"),
                                    t("sections.deepThink.tip2"),
                                    t("sections.deepThink.tip3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="modo-lienzo"
                                icon={<PenTool className="h-5 w-5" />}
                                badge="PRO"
                            >
                                {t("sections.modoLienzo.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.modoLienzo.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.modoLienzo.tip1"),
                                    t("sections.modoLienzo.tip2"),
                                    t("sections.modoLienzo.tip3"),
                                    t("sections.modoLienzo.tip4"),
                                ]}
                            />

                            <SubSectionTitle
                                id="adjuntar-archivos"
                                icon={<Paperclip className="h-5 w-5" />}
                            >
                                {t("sections.adjuntarArchivos.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.adjuntarArchivos.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.adjuntarArchivos.format1"),
                                    t("sections.adjuntarArchivos.format2"),
                                    t("sections.adjuntarArchivos.format3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="dictar-por-voz"
                                icon={<Mic className="h-5 w-5" />}
                            >
                                {t("sections.dictarVoz.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.dictarVoz.desc")}
                            </Paragraph>
                            <OrderedList
                                items={[
                                    t("sections.dictarVoz.step1"),
                                    t("sections.dictarVoz.step2"),
                                    t("sections.dictarVoz.step3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="feedback-respuestas"
                                icon={<ThumbsUp className="h-5 w-5" />}
                            >
                                {t("sections.feedback.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.feedback.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.feedback.tip1"),
                                    t("sections.feedback.tip2"),
                                ]}
                            />

                            <SubSectionTitle
                                id="compartir-contenido"
                                icon={<Share2 className="h-5 w-5" />}
                            >
                                {t("sections.compartir.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.compartir.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.compartir.mode1"),
                                    t("sections.compartir.mode2"),
                                ]}
                            />

                            <SubSectionTitle
                                id="descargar-respuestas"
                                icon={<FileDown className="h-5 w-5" />}
                            >
                                {t("sections.descargar.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.descargar.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.descargar.format1"),
                                    t("sections.descargar.format2"),
                                ]}
                            />

                            {/* ════════ 4. CONVERSACIONES ════════ */}
                            <SectionTitle
                                id="conversaciones"
                                icon={<FolderOpen className="h-7 w-7" />}
                            >
                                {t("sections.conversaciones.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.conversaciones.intro")}
                            </Paragraph>

                            <SubSectionTitle
                                id="gestionar-conversaciones"
                                icon={<FolderOpen className="h-5 w-5" />}
                            >
                                {t("sections.gestionarConversaciones.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.gestionarConversaciones.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.gestionarConversaciones.tip1"),
                                    t("sections.gestionarConversaciones.tip2"),
                                    t("sections.gestionarConversaciones.tip3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="buscar-conversaciones"
                                icon={<Search className="h-5 w-5" />}
                            >
                                {t("sections.buscarConversaciones.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.buscarConversaciones.desc")}
                            </Paragraph>

                            <SubSectionTitle
                                id="archivar-eliminar"
                                icon={<Archive className="h-5 w-5" />}
                            >
                                {t("sections.archivarEliminar.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.archivarEliminar.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.archivarEliminar.tip1"),
                                    t("sections.archivarEliminar.tip2"),
                                ]}
                            />

                            <SubSectionTitle
                                id="carpetas-trabajo"
                                icon={<FolderOpen className="h-5 w-5" />}
                                badge="PRO"
                            >
                                {t("sections.carpetasTrabajo.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.carpetasTrabajo.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.carpetasTrabajo.tip1"),
                                    t("sections.carpetasTrabajo.tip2"),
                                    t("sections.carpetasTrabajo.tip3"),
                                    t("sections.carpetasTrabajo.tip4"),
                                    t("sections.carpetasTrabajo.tip5"),
                                ]}
                            />

                            <SubSectionTitle
                                id="fuentes-consultadas"
                                icon={<BookOpen className="h-5 w-5" />}
                            >
                                {t("sections.fuentesConsultadas.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.fuentesConsultadas.desc")}
                            </Paragraph>

                            {/* ════════ 5. CONECTORES (PRO) ════════ */}
                            <SectionTitle
                                id="conectores"
                                icon={<Puzzle className="h-7 w-7" />}
                                badge="PRO"
                            >
                                {t("sections.conectores.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.conectores.intro")}
                            </Paragraph>

                            <SubSectionTitle
                                id="conector-google-drive"
                                icon={<FolderOpen className="h-5 w-5" />}
                            >
                                {t("sections.googleDrive.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.googleDrive.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.googleDrive.tip1"),
                                    t("sections.googleDrive.tip2"),
                                    t("sections.googleDrive.tip3"),
                                ]}
                            />

                            <SubSectionTitle
                                id="conector-google-docs"
                                icon={<FileDown className="h-5 w-5" />}
                            >
                                {t("sections.googleDocs.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.googleDocs.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.googleDocs.tip1"),
                                    t("sections.googleDocs.tip2"),
                                    t("sections.googleDocs.tip3"),
                                ]}
                            />

                            {/* ════════ 6. PERSONALIZACIÓN ════════ */}
                            <SectionTitle
                                id="personalizacion"
                                icon={<Palette className="h-7 w-7" />}
                            >
                                {t("sections.personalizacion.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.personalizacion.intro")}
                            </Paragraph>

                            <SubSectionTitle
                                id="tema-claro-oscuro"
                                icon={<Sun className="h-5 w-5" />}
                            >
                                {t("sections.tema.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.tema.desc")}
                            </Paragraph>

                            <SubSectionTitle
                                id="idioma"
                                icon={<Globe className="h-5 w-5" />}
                            >
                                {t("sections.idioma.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.idioma.desc")}
                            </Paragraph>
                            <Paragraph>
                                {t("sections.idioma.list")}
                            </Paragraph>

                            <SubSectionTitle
                                id="fuente-chat"
                                icon={<Type className="h-5 w-5" />}
                            >
                                {t("sections.fuente.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.fuente.desc")}
                            </Paragraph>

                            {/* ════════ 7. INSTALAR EN EL MÓVIL ════════ */}
                            <SectionTitle
                                id="instalar-movil"
                                icon={<Smartphone className="h-7 w-7" />}
                            >
                                {t("sections.instalarMovil.title")}
                            </SectionTitle>
                            <Paragraph>
                                {tOld("mobileIntro")}
                            </Paragraph>
                            <Paragraph>
                                <em className="font-medium">
                                    {tOld("mobileAppNote")}
                                </em>
                            </Paragraph>

                            <SubSectionTitle
                                id="android-chrome"
                                icon={
                                    <Monitor className="h-5 w-5 text-green-600 dark:text-green-400" />
                                }
                            >
                                {tOld("androidTitle")}
                            </SubSectionTitle>
                            <OrderedList
                                items={[
                                    tOld("androidStep1"),
                                    tOld("androidStep2"),
                                    tOld("androidStep3"),
                                    tOld("androidStep4"),
                                    tOld("androidStep5"),
                                    tOld("androidStep6"),
                                ]}
                            />
                            <p className="text-sm leading-relaxed text-muted-foreground/80 italic mb-6">
                                {tOld("androidNote")}
                            </p>

                            <SubSectionTitle
                                id="ios-safari"
                                icon={
                                    <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                }
                            >
                                {tOld("iosTitle")}
                            </SubSectionTitle>
                            <p className="mb-4 text-sm font-medium text-amber-600 dark:text-amber-400">
                                ⚠️ {tOld("iosImportant")}
                            </p>
                            <OrderedList
                                items={[
                                    tOld("iosStep1"),
                                    tOld("iosStep2"),
                                    tOld("iosStep3"),
                                    tOld("iosStep4"),
                                    tOld("iosStep5"),
                                    tOld("iosStep6"),
                                ]}
                            />
                            <p className="text-sm leading-relaxed text-muted-foreground/80 italic mb-6">
                                {tOld("iosNote")}
                            </p>

                            {/* ════════ 8. PLANES Y LÍMITES ════════ */}
                            <SectionTitle
                                id="planes-limites"
                                icon={<CreditCard className="h-7 w-7" />}
                            >
                                {t("sections.planesLimites.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.planesLimites.intro")}
                            </Paragraph>

                            <SubSectionTitle id="plan-free">
                                {t("sections.planFree.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.planFree.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.planFree.limit1"),
                                    t("sections.planFree.limit2"),
                                    t("sections.planFree.limit3"),
                                    t("sections.planFree.limit4"),
                                    t("sections.planFree.limit5"),
                                ]}
                            />

                            <SubSectionTitle
                                id="plan-pro"
                                badge="PRO"
                            >
                                {t("sections.planPro.title")}
                            </SubSectionTitle>
                            <Paragraph>
                                {t("sections.planPro.desc")}
                            </Paragraph>
                            <TipList
                                items={[
                                    t("sections.planPro.benefit1"),
                                    t("sections.planPro.benefit2"),
                                    t("sections.planPro.benefit3"),
                                    t("sections.planPro.benefit4"),
                                    t("sections.planPro.benefit5"),
                                ]}
                            />

                            {/* ════════ 9. PREGUNTAS FRECUENTES ════════ */}
                            <SectionTitle
                                id="preguntas-frecuentes"
                                icon={<HelpCircle className="h-7 w-7" />}
                            >
                                {t("sections.faq.title")}
                            </SectionTitle>

                            <div className="not-prose space-y-4 my-4">
                                {[1, 2, 3, 4, 5, 6].map((n) => (
                                    <div
                                        key={n}
                                        className="rounded-xl border border-border/60 bg-muted/20 p-5"
                                    >
                                        <p className="font-semibold text-foreground mb-2">
                                            {t(`sections.faq.q${n}`)}
                                        </p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {t(`sections.faq.a${n}`)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* ════════ 10. CONTACTO Y SOPORTE ════════ */}
                            <SectionTitle
                                id="contacto-soporte"
                                icon={<Mail className="h-7 w-7" />}
                            >
                                {t("sections.contacto.title")}
                            </SectionTitle>
                            <Paragraph>
                                {t("sections.contacto.desc")}
                            </Paragraph>

                            <div className="not-prose rounded-xl border border-border/60 bg-muted/20 p-6 text-center">
                                <p className="text-lg font-semibold text-foreground mb-2">
                                    {t("sections.contacto.emailLabel")}
                                </p>
                                <a
                                    href="mailto:redpj@rpj.es"
                                    className="group inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-lg font-medium text-primary transition-all hover:bg-primary/20 hover:underline"
                                >
                                    redpj@rpj.es
                                    <ExternalLink className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                                </a>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {t("sections.contacto.web")}
                                </p>
                                <a
                                    href="https://rpj.es"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all hover:underline mt-1"
                                >
                                    rpj.es
                                    <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                                </a>
                            </div>

                            {/* Spacer final */}
                            <div className="h-32" />
                        </article>
                    </div>
                </main>
            </div>
        </div>
    )
}
