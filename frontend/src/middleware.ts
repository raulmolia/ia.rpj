import { NextRequest, NextResponse } from "next/server"

/**
 * Middleware para corregir la falta del header `origin` en entornos con proxy
 * (Plesk / nginx). Next.js 14 rechaza las Server Actions cuando no hay `origin`,
 * lanzando internamente `null` como error y causando
 * `TypeError: Cannot read properties of null (reading 'message')`.
 *
 * Estrategia:
 * 1. Si ya hay `origin`, no hacer nada.
 * 2. Si hay `x-forwarded-host`, usarlo para reconstruir el origin.
 * 3. Si hay `host`, usarlo como fallback.
 * 4. Fallback final: dominio de producción conocido.
 */
export function middleware(request: NextRequest) {
    const requestHeaders = new Headers(request.headers)

    if (!requestHeaders.get("origin")) {
        const forwardedHost = requestHeaders.get("x-forwarded-host")
        const host = requestHeaders.get("host")
        const proto = requestHeaders.get("x-forwarded-proto") || "https"

        let originHost: string | null = null

        if (forwardedHost) {
            originHost = forwardedHost.split(",")[0].trim()
        } else if (host) {
            originHost = host.split(",")[0].trim()
        } else {
            // Fallback absoluto al dominio de producción
            originHost = "ia.rpj.es"
        }

        requestHeaders.set("origin", `${proto}://${originHost}`)
    }

    return NextResponse.next({
        request: { headers: requestHeaders },
    })
}

export const config = {
    // Aplica a todas las rutas excepto activos estáticos
    matcher: [
        "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
    ],
}
