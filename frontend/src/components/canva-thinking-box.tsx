'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolStep {
    tool: string;
    status: 'success' | 'error';
    summary: string;
}

interface CanvaThinkingBoxProps {
    /** true mientras el backend procesa (isThinking + canvaToolEnabled) */
    isActive: boolean;
    /** Pasos ya completados (se llenan cuando llega la respuesta) */
    toolSteps?: ToolStep[];
}

/**
 * Caja colapsable que muestra el progreso de Canva.
 * - Mientras isActive: abierta con animación de puntos.
 * - Al terminar (isActive → false y hay toolSteps): se colapsa automáticamente mostrando resumen.
 */
export function CanvaThinkingBox({ isActive, toolSteps }: CanvaThinkingBoxProps) {
    const [isOpen, setIsOpen] = useState(true);
    const wasActive = useRef(false);

    // Auto-colapsar cuando termina
    useEffect(() => {
        if (wasActive.current && !isActive && toolSteps && toolSteps.length > 0) {
            const timer = setTimeout(() => setIsOpen(false), 1200);
            return () => clearTimeout(timer);
        }
        if (isActive) {
            wasActive.current = true;
            setIsOpen(true);
        }
    }, [isActive, toolSteps]);

    // No renderizar si nunca estuvo activo
    if (!isActive && (!toolSteps || toolSteps.length === 0)) return null;

    const hasSteps = toolSteps && toolSteps.length > 0;
    const summaryText = hasSteps
        ? toolSteps.map(s => s.summary).join(' · ')
        : 'Trabajando con Canva...';

    return (
        <div className="my-2 rounded-lg border border-border/60 bg-muted/30 text-sm overflow-hidden transition-all">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            >
                {/* Icono Canva simplificado */}
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 text-purple-500" fill="currentColor">
                    <circle cx="12" cy="12" r="10" opacity={0.2} />
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5c-2.49 0-4.5-2.01-4.5-4.5s2.01-4.5 4.5-4.5c1.24 0 2.36.5 3.17 1.32l-1.29 1.29A2.98 2.98 0 0010.5 9.5 2.5 2.5 0 008 12a2.5 2.5 0 002.5 2.5c1.16 0 2.13-.79 2.41-1.86h-2.41v-1.79h4.41c.06.3.09.6.09.93 0 2.64-1.98 4.72-4.5 4.72z" />
                </svg>

                {isActive ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '120ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '240ms' }} />
                        Trabajando con Canva...
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground truncate">{summaryText}</span>
                )}

                <ChevronDown
                    className={cn(
                        'ml-auto h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {isOpen && (
                <div className="border-t border-border/40 px-3 py-2 space-y-1">
                    {isActive && !hasSteps && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                            Creando diseños en Canva...
                        </div>
                    )}
                    {hasSteps && toolSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            {step.status === 'success' ? (
                                <span className="text-green-500">✓</span>
                            ) : (
                                <span className="text-red-500">✗</span>
                            )}
                            <span className="text-muted-foreground">{step.summary}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
