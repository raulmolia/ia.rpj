// Wrapper to force HOSTNAME=0.0.0.0 so Next.js listens on all interfaces
// including 127.0.0.1 (needed for the Apache reverse proxy).
// This is necessary because the system HOSTNAME env var on Plesk resolves
// to the public IP, and PM2 cannot reliably override it.
process.env.HOSTNAME = '0.0.0.0';

// ─── Parche: reconstruir header `origin` eliminado por Apache/Plesk ─────────
// Apache actúa como proxy inverso y elimina el header `origin` en peticiones
// hacia Next.js. Sin este header, Next.js 14 registra "Missing origin header"
// y puede lanzar errores internos en Server Actions (incluyendo las de next-intl).
//
// Interceptamos a nivel de http.Server.prototype.emit antes de que Next.js
// cree su servidor, para añadir el header antes de que sea procesado.
const http = require('http');

const _addOriginHeader = (req) => {
    if (req && req.headers && !req.headers['origin']) {
        const forwardedHost = req.headers['x-forwarded-host'];
        const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['host'];
        const originHost = (
            (forwardedHost || host || 'ia.rpj.es')
                .split(',')[0]
                .trim()
        );
        req.headers['origin'] = forwardedProto + '://' + originHost;
    }
};

// Parchear el prototype antes de que Next.js cargue y cree su servidor HTTP
const _origEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, req, res) {
    if (event === 'request') {
        _addOriginHeader(req);
    }
    return _origEmit.apply(this, arguments);
};
// ────────────────────────────────────────────────────────────────────────────

require('./.next/standalone/server.js');
