"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { useTranslations } from "next-intl"

export default function AcercaDePage() {
    const router = useRouter()
    const t = useTranslations("about")

    const ExternalLinkStyled = ({ href, children, highlighted = false }: { href: string; children: React.ReactNode; highlighted?: boolean }) => {
        if (highlighted) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group my-4 inline-flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 text-base font-semibold text-primary shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:scale-[1.02]"
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
            >
                {children}
                <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
            </a>
        )
    }

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
                    {t("backToChat")}
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
                    <article className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                        {/* Section 1 - Para quién */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground first:mt-0">
                            {t("section1Title")}
                        </h2>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section1Content")}
                        </p>

                        {/* Section 2 - Por qué */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground">
                            {t("section2Title")}
                        </h2>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section2Content1")}
                        </p>
                        <ul className="my-6 ml-6 space-y-3 list-disc marker:text-primary">
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t("section2List1")}
                            </li>
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t("section2List2")}
                            </li>
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t("section2List3")}
                            </li>
                        </ul>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section2Content2")}
                        </p>

                        {/* Section 3 - Cómo se creó */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground">
                            {t("section3Title")}
                        </h2>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section3Content1")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section3Content2")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section3Content3")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section3Content4")}
                        </p>

                        {/* Section 4 - Cómo utilizar */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground">
                            {t("section4Title")}
                        </h2>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section4Content1")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section4Content2")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section4Content3")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section4Content4")}
                        </p>

                        {/* Section 5 - Quiénes somos */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground">
                            {t("section5Title")}
                        </h2>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section5Content1")}
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section5Content2")}
                        </p>
                        <p className="mb-4 leading-relaxed text-muted-foreground font-medium">
                            {t("section5Institutions")}
                        </p>
                        <p className="mb-6">
                            <ExternalLinkStyled href="https://redpastoraljovenrpj.org/somos/" highlighted>
                                → redpastoraljovenrpj.org/somos/
                            </ExternalLinkStyled>
                        </p>
                        <p className="mb-4 leading-relaxed text-muted-foreground font-medium">
                            {t("section5Teams")}
                        </p>
                        <p className="mb-6">
                            <ExternalLinkStyled href="https://redpastoraljovenrpj.org" highlighted>
                                → redpastoraljovenrpj.org
                            </ExternalLinkStyled>
                        </p>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            {t("section5Content3")}
                        </p>
                    </article>
                </div>
            </main>
        </div>
    )
}
