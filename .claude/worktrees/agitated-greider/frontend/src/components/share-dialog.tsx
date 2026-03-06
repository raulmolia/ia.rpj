"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Users, Mail, Send, Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { buildApiUrl, cn } from "@/lib/utils"

type ShareMode = "user" | "email"

interface ShareDialogProps {
    open: boolean
    onClose: () => void
    messageContent: string
    conversationTitle: string
    token: string
}

export function ShareDialog({
    open,
    onClose,
    messageContent,
    conversationTitle,
    token,
}: ShareDialogProps) {
    const t = useTranslations()
    const [mode, setMode] = useState<ShareMode>("user")
    const [email, setEmail] = useState("")
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleClose = useCallback(() => {
        setEmail("")
        setResult(null)
        setSending(false)
        onClose()
    }, [onClose])

    const handleSend = useCallback(async () => {
        if (!email.trim()) return

        setSending(true)
        setResult(null)

        try {
            const endpoint = mode === "user" ? "/api/share/user" : "/api/share/email"
            const response = await fetch(buildApiUrl(endpoint), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: email.trim(),
                    messageContent,
                    conversationTitle,
                }),
            })

            const data = await response.json()

            if (response.ok) {
                setResult({ success: true, message: data.message })
                // Auto-cerrar después de éxito
                setTimeout(() => {
                    handleClose()
                }, 2500)
            } else {
                setResult({ success: false, message: data.error || t("share.errorGeneric") })
            }
        } catch {
            setResult({ success: false, message: t("share.errorGeneric") })
        } finally {
            setSending(false)
        }
    }, [email, mode, messageContent, conversationTitle, token, handleClose, t])

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        {t("share.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("share.description")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Selector de modo */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => { setMode("user"); setResult(null) }}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                                mode === "user"
                                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <Users className="h-4 w-4" />
                            {t("share.modeUser")}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode("email"); setResult(null) }}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                                mode === "email"
                                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <Mail className="h-4 w-4" />
                            {t("share.modeEmail")}
                        </button>
                    </div>

                    {/* Descripción del modo */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {mode === "user" ? t("share.modeUserDesc") : t("share.modeEmailDesc")}
                    </p>

                    {/* Campo de email */}
                    <div className="space-y-2">
                        <Label htmlFor="share-email">{t("share.emailLabel")}</Label>
                        <Input
                            id="share-email"
                            type="email"
                            placeholder={t("share.emailPlaceholder")}
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setResult(null) }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !sending && email.trim()) {
                                    handleSend()
                                }
                            }}
                            disabled={sending}
                            autoFocus
                        />
                    </div>

                    {/* Título de conversación */}
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">{t("share.contentLabel")}</p>
                        <p className="text-sm font-medium truncate">{conversationTitle}</p>
                    </div>

                    {/* Resultado */}
                    {result && (
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-lg p-3 text-sm",
                                result.success
                                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                    : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                            )}
                        >
                            {result.success ? (
                                <Check className="h-4 w-4 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            )}
                            <span>{result.message}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleClose} disabled={sending}>
                        {t("common.cancel")}
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={sending || !email.trim()}
                    >
                        {sending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("share.sending")}
                            </>
                        ) : (
                            <>
                                {mode === "user" ? <Users className="mr-2 h-4 w-4" /> : <Mail className="mr-2 h-4 w-4" />}
                                {mode === "user" ? t("share.sendToUser") : t("share.sendEmail")}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
