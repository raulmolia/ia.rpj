"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggleButton } from "@/components/theme-toggle"

export default function AcercaDePage() {
    const router = useRouter()
    const [content, setContent] = useState<string>("")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/acercade.md")
            .then((res) => res.text())
            .then((text) => {
                // Quitar el "# Acerca de..." del inicio
                const cleanedText = text.replace(/^#\s*Acerca de[^\n]*\n\n/, "")
                setContent(cleanedText)
                setLoading(false)
            })
            .catch((error) => {
                console.error("Error cargando acercade.md:", error)
                setLoading(false)
            })
    }, [])

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20">
            {/* Header */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/95 px-8 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/")}
                    className="gap-2 hover:bg-primary/10"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al chat
                </Button>
                <ThemeToggleButton />
            </header>

            {/* Content */}
            <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-12">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Logo */}
                        <div className="flex justify-center">
                            <div className="relative h-64 w-64">
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

                        {/* Content */}
                        <article className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({ node, ...props }) => (
                                        <h2 
                                            className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground first:mt-0" 
                                            {...props} 
                                        />
                                    ),
                                    p: ({ node, ...props }) => (
                                        <p 
                                            className="mb-6 leading-relaxed text-muted-foreground" 
                                            {...props} 
                                        />
                                    ),
                                    a: ({ node, href, children, ...props }) => {
                                        // Verificar si es el enlace destacado (contiene la flecha →)
                                        const childrenArray = Array.isArray(children) ? children : [children]
                                        const text = childrenArray.map(c => typeof c === 'string' ? c : '').join('')
                                        const isHighlighted = text.includes('→')
                                        
                                        if (isHighlighted) {
                                            return (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group my-4 inline-flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 text-base font-semibold text-primary shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:scale-[1.02]"
                                                    {...props}
                                                >
                                                    {children}
                                                    <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                                </a>
                                            )
                                        }
                                        
                                        return (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary transition-all hover:bg-primary/20 hover:underline"
                                                {...props}
                                            >
                                                {children}
                                                <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                                            </a>
                                        )
                                    },
                                    ul: ({ node, ...props }) => (
                                        <ul 
                                            className="my-6 ml-6 space-y-3 list-disc marker:text-primary" 
                                            {...props} 
                                        />
                                    ),
                                    li: ({ node, ...props }) => (
                                        <li 
                                            className="pl-2 text-muted-foreground leading-relaxed" 
                                            {...props} 
                                        />
                                    ),
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </article>
                    </div>
                )}
            </main>
        </div>
    )
}
