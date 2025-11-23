"use client"

import { useEffect, useState } from "react"
import { BarChart3, MessageSquare, Calendar, Info } from "lucide-react"
import { buildApiUrl } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

type UsageStats = {
    role: string
    limits: {
        maxConversations: number | null
        maxMessagesPerConversation: number | null
        maxDailyInteractions: number | null
        maxDailyChats: number | null
    }
    stats: {
        conversations: {
            current: number
            max: number | null
            available: number | null
        }
        dailyInteractions: {
            current: number
            max: number | null
            available: number | null
        }
        dailyChats: {
            current: number
            max: number | null
            available: number | null
        }
        messagesPerConversation: {
            max: number | null
        }
    }
}

interface UsageStatsProps {
    token: string | null
}

export function UsageStats({ token }: UsageStatsProps) {
    const [stats, setStats] = useState<UsageStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return

        const fetchStats = async () => {
            try {
                const response = await fetch(buildApiUrl("/api/chat/stats"), {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (response.ok) {
                    const data = await response.json()
                    setStats(data)
                }
            } catch (error) {
                console.error("Error cargando estadísticas:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
        // Actualizar cada 30 segundos
        const interval = setInterval(fetchStats, 30000)
        return () => clearInterval(interval)
    }, [token])

    if (loading || !stats) return null

    // No mostrar para admins sin límites
    const hasLimits = stats.limits.maxConversations !== null || 
                      stats.limits.maxDailyInteractions !== null ||
                      stats.limits.maxDailyChats !== null ||
                      stats.limits.maxMessagesPerConversation !== null

    if (!hasLimits) return null

    const getPercentage = (current: number, max: number | null) => {
        if (max === null) return 0
        return Math.min(100, (current / max) * 100)
    }

    const getColorClass = (current: number, max: number | null) => {
        if (max === null) return "bg-emerald-500"
        const percentage = (current / max) * 100
        if (percentage >= 90) return "bg-red-500"
        if (percentage >= 70) return "bg-amber-500"
        return "bg-emerald-500"
    }

    return (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Límites de uso</span>
                <TooltipProvider>
                    <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-xs">
                            <p className="font-medium mb-1.5">Límites para usuarios:</p>
                            <ul className="space-y-1 text-muted-foreground">
                                <li>• <strong>7 chats</strong> almacenados simultáneamente (incluyendo archivados)</li>
                                <li>• <strong>5 iteraciones</strong> (mensajes al modelo de IA) por chat</li>
                                <li>• <strong>3 chats nuevos</strong> diarios</li>
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Chats totales */}
            {stats.limits.maxConversations !== null && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            <span>Chats totales</span>
                        </div>
                        <span className="font-medium text-foreground">
                            {stats.stats.conversations.current}/{stats.stats.conversations.max}
                        </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full transition-all ${getColorClass(
                                stats.stats.conversations.current,
                                stats.stats.conversations.max
                            )}`}
                            style={{
                                width: `${getPercentage(
                                    stats.stats.conversations.current,
                                    stats.stats.conversations.max
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Chats diarios */}
            {stats.limits.maxDailyChats !== null && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Chats diarios</span>
                        </div>
                        <span className="font-medium text-foreground">
                            {stats.stats.dailyChats?.current || 0}/{stats.stats.dailyChats?.max || 3}
                        </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full transition-all ${getColorClass(
                                stats.stats.dailyChats?.current || 0,
                                stats.stats.dailyChats?.max || 3
                            )}`}
                            style={{
                                width: `${getPercentage(
                                    stats.stats.dailyChats?.current || 0,
                                    stats.stats.dailyChats?.max || 3
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Interacciones diarias */}
            {stats.limits.maxDailyInteractions !== null && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <BarChart3 className="h-3 w-3" />
                            <span>Iteraciones diarias</span>
                        </div>
                        <span className="font-medium text-foreground">
                            {stats.stats.dailyInteractions.current}/{stats.stats.dailyInteractions.max}
                        </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full transition-all ${getColorClass(
                                stats.stats.dailyInteractions.current,
                                stats.stats.dailyInteractions.max
                            )}`}
                            style={{
                                width: `${getPercentage(
                                    stats.stats.dailyInteractions.current,
                                    stats.stats.dailyInteractions.max
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Mensajes por chat */}
            {stats.limits.maxMessagesPerConversation !== null && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/30">
                    <span className="text-muted-foreground">Máx. mensajes por chat</span>
                    <span className="font-medium text-foreground">{stats.limits.maxMessagesPerConversation}</span>
                </div>
            )}
        </div>
    )
}
