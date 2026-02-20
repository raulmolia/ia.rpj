"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, ExternalLink, Smartphone, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { useTranslations } from "next-intl"

export default function GuiaDeUsoPage() {
    const router = useRouter()
    const t = useTranslations("usageGuide")

    const bold = (chunks: React.ReactNode) => (
        <strong className="font-semibold text-foreground">{chunks}</strong>
    )

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
                        {/* Main usage tips */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground first:mt-0">
                            {t("mainTitle")}
                        </h2>
                        <ul className="my-6 ml-6 space-y-5 list-disc marker:text-primary">
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t.rich("tip1", { bold })}
                            </li>
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t.rich("tip2", { bold })}
                            </li>
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t.rich("tip3", { bold })}
                            </li>
                            <li className="pl-2 text-muted-foreground leading-relaxed">
                                {t.rich("tip4", { bold })}
                                {" "}
                                <a
                                    href="mailto:redpj@rpj.es"
                                    className="group inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary transition-all hover:bg-primary/20 hover:underline"
                                >
                                    redpj@rpj.es
                                    <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                                </a>
                            </li>
                        </ul>

                        {/* Mobile section */}
                        <h2 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground">
                            <Smartphone className="inline-block h-8 w-8 mr-2 align-text-bottom text-primary" />
                            {t("mobileTitle")}
                        </h2>
                        <p className="mb-4 leading-relaxed text-muted-foreground">
                            {t("mobileIntro")}
                        </p>
                        <p className="mb-8 leading-relaxed text-muted-foreground font-medium italic">
                            {t("mobileAppNote")}
                        </p>

                        {/* Android */}
                        <div className="mb-8 rounded-xl border border-border/60 bg-muted/20 p-6">
                            <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
                                <Monitor className="h-5 w-5 text-green-600 dark:text-green-400" />
                                {t("androidTitle")}
                            </h3>
                            <ol className="ml-6 space-y-2 list-decimal marker:text-primary marker:font-semibold">
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("androidStep1")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("androidStep2")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("androidStep3")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("androidStep4")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("androidStep5")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("androidStep6")}
                                </li>
                            </ol>
                            <p className="mt-4 text-sm leading-relaxed text-muted-foreground/80 italic">
                                {t("androidNote")}
                            </p>
                        </div>

                        {/* iOS */}
                        <div className="mb-8 rounded-xl border border-border/60 bg-muted/20 p-6">
                            <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
                                <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                {t("iosTitle")}
                            </h3>
                            <p className="mb-4 text-sm font-medium text-amber-600 dark:text-amber-400">
                                ⚠️ {t("iosImportant")}
                            </p>
                            <ol className="ml-6 space-y-2 list-decimal marker:text-primary marker:font-semibold">
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("iosStep1")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("iosStep2")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("iosStep3")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("iosStep4")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("iosStep5")}
                                </li>
                                <li className="pl-2 text-muted-foreground leading-relaxed">
                                    {t("iosStep6")}
                                </li>
                            </ol>
                            <p className="mt-4 text-sm leading-relaxed text-muted-foreground/80 italic">
                                {t("iosNote")}
                            </p>
                        </div>
                    </article>
                </div>
            </main>
        </div>
    )
}
