'use client';

import { ExternalLink, Palette, LayoutTemplate } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface CanvaDesign {
    id: string;
    title: string;
    edit_url: string;
    thumbnail_url?: string | null;
    type: string;
    type_label?: string;
    is_blank_canvas?: boolean;
    created_at?: number;
}

interface CanvaDesignCardsProps {
    designs: CanvaDesign[];
    templateSearchUrl?: string;
}

/** Tarjetas de diseños de Canva con thumbnail y enlace para editar */
export function CanvaDesignCards({ designs, templateSearchUrl }: CanvaDesignCardsProps) {
    if (!designs || designs.length === 0) return null;

    return (
        <div className="mt-3 space-y-3">
            {/* Enlace a plantillas de Canva */}
            {templateSearchUrl && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                    <LayoutTemplate className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary">¿Prefieres empezar con una plantilla?</p>
                        <p className="text-xs text-muted-foreground">Busca plantillas profesionales relacionadas en Canva</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                        asChild
                    >
                        <a href={templateSearchUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver plantillas
                        </a>
                    </Button>
                </div>
            )}

            {/* Grid de diseños */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {designs.map((design, index) => (
                    <Card
                        key={design.id || index}
                        className="overflow-hidden transition-shadow hover:shadow-md"
                    >
                        {/* Thumbnail / placeholder */}
                        <div className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                            {design.thumbnail_url ? (
                                <img
                                    src={design.thumbnail_url}
                                    alt={design.title || 'Diseño de Canva'}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <Palette className="h-10 w-10 opacity-30" />
                                    <span className="text-xs font-medium">Lienzo preparado</span>
                                    <span className="text-[10px] opacity-60">Listo para diseñar</span>
                                </div>
                            )}
                            {/* Badge de tipo */}
                            <Badge
                                variant="secondary"
                                className="absolute top-2 right-2 text-[10px] bg-background/80 backdrop-blur-sm"
                            >
                                {design.type_label || design.type}
                            </Badge>
                            {/* Badge de opción */}
                            <Badge
                                className="absolute top-2 left-2 text-[10px] bg-primary/90 backdrop-blur-sm"
                            >
                                Opción {index + 1}
                            </Badge>
                        </div>

                        <CardContent className="p-3">
                            <p className="text-sm font-medium truncate mb-2" title={design.title}>
                                {design.title || 'Sin título'}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-1.5 text-xs"
                                asChild
                            >
                                <a
                                    href={design.edit_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Editar en Canva
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
