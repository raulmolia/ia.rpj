"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Send, X, Loader2, MessageSquare, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { buildApiUrl } from "@/lib/utils"
import CanvasEditor from "./CanvasEditor"

interface CanvasMiniMessage {
    id: string
    role: "user" | "assistant"
    content: string
}

interface CanvasDialogProps {
    open: boolean
    onClose: (finalContent: string) => void
    initialContent: string
    conversationId: string | null
    token: string
    userInitials: string
    userLanguage: string
}

export default function CanvasDialog({
    open,
    onClose,
    initialContent,
    conversationId,
    token,
    userInitials,
    userLanguage,
}: CanvasDialogProps) {
    const t = useTranslations("canvas")
    const [miniMessages, setMiniMessages] = useState<CanvasMiniMessage[]>([])
    const [miniInput, setMiniInput] = useState("")
    const [isTransforming, setIsTransforming] = useState(false)
    const [activeTab, setActiveTab] = useState<"chat" | "editor">("editor")
    const [currentContent, setCurrentContent] = useState(initialContent)
    const [sessionKey, setSessionKey] = useState(0)
    const miniChatEndRef = useRef<HTMLDivElement>(null)

    // Scroll mini-chat to bottom
    useEffect(() => {
        miniChatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [miniMessages])

    // Reset when dialog opens with new content
    useEffect(() => {
        if (open) {
            setMiniMessages([])
            setMiniInput("")
            setCurrentContent(initialContent)
            setActiveTab("editor")
            setSessionKey((k) => k + 1) // Force CanvasEditor remount with fresh content
        }
    }, [open, initialContent])

    const callTransformApi = useCallback(
        async (content: string, selection: string | null, instruction: string): Promise<string> => {
            setIsTransforming(true)
            try {
                const response = await fetch(buildApiUrl("/api/canvas/transform"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        content,
                        selection,
                        instruction,
                        language: userLanguage,
                        conversationId,
                    }),
                })

                const data = await response.json()
                if (!response.ok) {
                    throw new Error(data.error || t("transformError"))
                }
                return data.content
            } finally {
                setIsTransforming(false)
            }
        },
        [token, userLanguage, conversationId, t],
    )

    const handleTransformRequest = useCallback(
        async (content: string, selection: string | null, instruction: string): Promise<string> => {
            // Add user message to mini chat
            const userMsg: CanvasMiniMessage = {
                id: `user-${Date.now()}`,
                role: "user",
                content: selection
                    ? `[${t("selectedText")}]: "${selection.substring(0, 100)}${selection.length > 100 ? "..." : ""}"\n\n${instruction}`
                    : instruction,
            }
            setMiniMessages((prev) => [...prev, userMsg])

            const result = await callTransformApi(content, selection, instruction)

            // Add assistant ack to mini chat
            const assistantMsg: CanvasMiniMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: selection
                    ? `✅ ${t("selectedText")} ${t("applyChanges").toLowerCase()}.`
                    : `✅ ${t("fullDocument")} ${t("applyChanges").toLowerCase()}.`,
            }
            setMiniMessages((prev) => [...prev, assistantMsg])
            setCurrentContent(result)

            return result
        },
        [callTransformApi, t],
    )

    const handleMiniChatSubmit = useCallback(async () => {
        if (!miniInput.trim() || isTransforming) return
        const instruction = miniInput.trim()
        setMiniInput("")

        try {
            await handleTransformRequest(currentContent, null, instruction)
        } catch {
            const errorMsg: CanvasMiniMessage = {
                id: `error-${Date.now()}`,
                role: "assistant",
                content: `❌ ${t("transformError")}`,
            }
            setMiniMessages((prev) => [...prev, errorMsg])
        }
    }, [miniInput, isTransforming, currentContent, handleTransformRequest, t])

    const handleClose = useCallback(() => {
        onClose(currentContent)
    }, [currentContent, onClose])

    if (!open) return null

    const miniChatPanel = (
        <div className="flex h-full flex-col">
            <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">{t("tabChat")}</h3>
                <p className="text-xs text-muted-foreground">
                    {t("selectionInstruction")}
                </p>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                    {miniMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-2",
                                msg.role === "user" ? "justify-end" : "justify-start",
                            )}
                        >
                            {msg.role === "assistant" && (
                                <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                                        IA
                                    </AvatarFallback>
                                </Avatar>
                            )}
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted",
                                )}
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                            {msg.role === "user" && (
                                <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarFallback className="bg-[#94c120] text-white text-[10px]">
                                        {userInitials}
                                    </AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ))}
                    {isTransforming && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t("transforming")}
                        </div>
                    )}
                    <div ref={miniChatEndRef} />
                </div>
            </ScrollArea>

            <div className="border-t px-3 py-2">
                <div className="flex gap-2">
                    <Input
                        value={miniInput}
                        onChange={(e) => setMiniInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleMiniChatSubmit()
                            }
                        }}
                        placeholder={t("selectionPlaceholder")}
                        className="h-8 text-xs"
                        disabled={isTransforming}
                    />
                    <Button
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleMiniChatSubmit}
                        disabled={!miniInput.trim() || isTransforming}
                    >
                        <Send className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )

    const editorPanel = (
        <CanvasEditor
            key={sessionKey}
            initialContent={currentContent}
            onContentChange={setCurrentContent}
            onTransformRequest={handleTransformRequest}
            isTransforming={isTransforming}
            onClose={handleClose}
        />
    )

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
            {/* Mobile: tab bar */}
            <div className="flex items-center justify-between border-b px-4 py-2 md:hidden">
                <div className="flex gap-1">
                    <Button
                        variant={activeTab === "chat" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setActiveTab("chat")}
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t("tabChat")}
                    </Button>
                    <Button
                        variant={activeTab === "editor" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setActiveTab("editor")}
                    >
                        <PenLine className="h-3.5 w-3.5" />
                        {t("tabEditor")}
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                        {t("title")}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Mobile: active tab only */}
            <div className="flex flex-1 overflow-hidden md:hidden">
                {activeTab === "chat" ? (
                    <div className="w-full">{miniChatPanel}</div>
                ) : (
                    <div className="w-full">{editorPanel}</div>
                )}
            </div>

            {/* Desktop: split view */}
            <div className="hidden flex-1 overflow-hidden md:flex">
                {/* Left: mini chat (1/3) */}
                <div className="flex h-full w-1/3 min-w-[280px] max-w-[400px] flex-col border-r">
                    {miniChatPanel}
                </div>
                {/* Right: editor (2/3) */}
                <div className="flex h-full flex-1 flex-col">
                    {editorPanel}
                </div>
            </div>
        </div>
    )
}
