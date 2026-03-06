import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function resolveApiBaseUrl(): string {
    if (typeof window !== "undefined" && window.location) {
        return window.location.origin.replace(/\/$/, "")
    }

    const envUrl = process.env.NEXT_PUBLIC_API_URL

    if (typeof envUrl === "string" && envUrl.trim().length > 0) {
        return envUrl.trim().replace(/\/$/, "")
    }

    return ""
}

export function buildApiUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    const baseUrl = resolveApiBaseUrl()

    if (!baseUrl) {
        return normalizedPath
    }

    return `${baseUrl}${normalizedPath}`
}

// Utilidades específicas del proyecto
export function formatearFecha(fecha: Date, formato: 'corto' | 'largo' = 'corto'): string {
    if (formato === 'corto') {
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    return fecha.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export function formatearDuracion(minutos: number): string {
    if (minutos < 60) {
        return `${minutos} min`;
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    if (minutosRestantes === 0) {
        return `${horas}h`;
    }

    return `${horas}h ${minutosRestantes}min`;
}

export function capitalizarPrimeraLetra(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

export function truncarTexto(texto: string, longitud: number = 100): string {
    if (texto.length <= longitud) return texto;
    return texto.substring(0, longitud) + '...';
}

export function generarColorPorTipo(tipo: string): string {
    const colores: Record<string, string> = {
        'DINAMICA': 'bg-blue-100 text-blue-800',
        'JUEGO': 'bg-green-100 text-green-800',
        'REFLEXION': 'bg-purple-100 text-purple-800',
        'ORACION': 'bg-yellow-100 text-yellow-800',
        'TALLER': 'bg-orange-100 text-orange-800',
        'DEBATE': 'bg-red-100 text-red-800',
        'COMPETICION': 'bg-pink-100 text-pink-800',
        'CREATIVA': 'bg-indigo-100 text-indigo-800',
        'DEPORTIVA': 'bg-cyan-100 text-cyan-800',
        'MUSICAL': 'bg-violet-100 text-violet-800',
    };

    return colores[tipo] || 'bg-gray-100 text-gray-800';
}

export function validarEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

export function calcularEdadDesdeRango(rangoEdad: string): { min: number; max: number } {
    const [min, max] = rangoEdad.split('-').map(Number);
    return { min: min || 0, max: max || 100 };
}

export function formatearRangoEdad(edadMin: number, edadMax: number): string {
    if (edadMin === edadMax) {
        return `${edadMin} años`;
    }
    return `${edadMin}-${edadMax} años`;
}