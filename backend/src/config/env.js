// Módulo de carga de variables de entorno.
// DEBE importarse como el PRIMER import en index.js para que
// process.env esté disponible cuando se carguen los demás módulos (ESM).
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });
