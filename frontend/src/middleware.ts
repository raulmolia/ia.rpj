import { NextRequest, NextResponse } from "next/server"

/**
 * Middleware para corregir la falta del header `origin` en entornos con proxy
 * (Plesk / nginx). Next.js 14 rechaza las Server Actions cuando no hay `origin`,
 * lanzando internamente `null` como error y causando
 * `TypeError: Cannot read properties of null (reading 'message')`.
 *
 * Este middleware reconstruye el header `origin` a partir de `x-forwarded-host`
 * (que Plesk sí reenvía) antes de que Next.js procese la petición.
 */
export function middleware(request: NextRequest) {
    const requestHeaders = new Headers(request.headers)

    if (!requestHeaders.get("origin")) {
        const forwardedHost = requestHeaders.get("x-forwarded-host")
        const host = forwardedHost || requestHeaders.get("host")
        const proto = requestHeaders.get("x-forwarded-proto") || "https"

        if (host) {
            requestHeaders.set("origin", `${proto}://${host.split(",")[0].trim()}`)
        }
    }

    return NextResponse.next({
        request: { headers: requestHeaders },
    })
}

export const config = {
    // Aplica a todas las rutas excepto activos estáticos y recursos de Next.js
    matcher: [
        "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
    ],
}
