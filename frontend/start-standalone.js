// Wrapper to force HOSTNAME=0.0.0.0 so Next.js listens on all interfaces
// including 127.0.0.1 (needed for the Apache reverse proxy).
// This is necessary because the system HOSTNAME env var on Plesk resolves
// to the public IP, and PM2 cannot reliably override it.
process.env.HOSTNAME = '0.0.0.0';
require('./.next/standalone/server.js');
