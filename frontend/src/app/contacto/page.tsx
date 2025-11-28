"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggleButton } from "@/components/theme-toggle"

export default function ContactoPage() {
    const router = useRouter()

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
                    <article className="text-center space-y-8">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Contacto
                        </h1>
                        
                        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            Contáctanos para cualquier comentario, aportación o pregunta en:
                        </p>

                        <div className="flex justify-center">
                            <a
                                href="mailto:redpj@rpj.es"
                                className="group inline-flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-8 py-4 text-xl font-semibold text-primary shadow-sm transition-all hover:border-primary/50 hover:shadow-lg hover:scale-[1.02]"
                            >
                                <Mail className="h-6 w-6 transition-transform group-hover:scale-110" />
                                redpj@rpj.es
                            </a>
                        </div>
                    </article>
                </div>
            </main>
        </div>
    )
}
