import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import prismaPackage from '@prisma/client';
import chromaService from '../src/services/chromaService.js';

dotenv.config();

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed de la base de datos...');

    const saltRounds = parseInt(process.env.AUTH_SALT_ROUNDS || '12', 10);
    const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!';

    const hashPassword = async (password) => {
        if (!password) {
            return undefined;
        }

        return bcrypt.hash(password, saltRounds);
    };

    const superAdminPasswordHash = await hashPassword(defaultPassword);
    const monitorPasswordHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD || defaultPassword);
    const documentadorPasswordHash = await hashPassword(process.env.SEED_DOCUMENTADOR_PASSWORD || defaultPassword);
    const usuarioPasswordHash = await hashPassword(process.env.SEED_USUARIO_PASSWORD || defaultPassword);

    // Crear usuario administrador por defecto
    const adminUser = await prisma.usuario.upsert({
        where: { email: 'admin@asistente-ia-juvenil.com' },
        update: {
            nombre: 'Administrador',
            apellidos: 'Sistema',
            nombreUsuario: 'admin',
            organizacion: 'Sistema',
            cargo: 'Administrador',
            experiencia: 5,
            emailVerificado: new Date(),
            rol: 'SUPERADMIN',
            passwordHash: superAdminPasswordHash,
        },
        create: {
            email: 'admin@asistente-ia-juvenil.com',
            nombre: 'Administrador',
            apellidos: 'Sistema',
            nombreUsuario: 'admin',
            organizacion: 'Sistema',
            cargo: 'Administrador',
            experiencia: 5,
            emailVerificado: new Date(),
            rol: 'SUPERADMIN',
            passwordHash: superAdminPasswordHash,
        },
    });

    console.log('✅ Usuario superadministrador creado:', adminUser.email);

    const extraSuperAdminEmail = process.env.SEED_SUPERADMIN_EMAIL?.trim();
    const extraSuperAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD;
    const extraSuperAdminHash = await hashPassword(extraSuperAdminPassword);

    if (extraSuperAdminEmail) {
        if (!extraSuperAdminHash) {
            console.warn('⚠️ SEED_SUPERADMIN_PASSWORD no definido; se omite la creación del superadministrador adicional.');
        } else {
            const extraSuperAdminData = {
                nombre: process.env.SEED_SUPERADMIN_NAME || 'Superadmin',
                apellidos: process.env.SEED_SUPERADMIN_LASTNAME || null,
                nombreUsuario: process.env.SEED_SUPERADMIN_USERNAME || extraSuperAdminEmail.split('@')[0],
                avatarUrl: process.env.SEED_SUPERADMIN_AVATAR || null,
                telefono: process.env.SEED_SUPERADMIN_PHONE || null,
                fechaNacimiento: process.env.SEED_SUPERADMIN_BIRTHDATE
                    ? new Date(process.env.SEED_SUPERADMIN_BIRTHDATE)
                    : null,
                emailVerificado: new Date(),
                rol: 'SUPERADMIN',
            };

            const updateData = { ...extraSuperAdminData, passwordHash: extraSuperAdminHash };
            const createData = { ...updateData, email: extraSuperAdminEmail };

            await prisma.usuario.upsert({
                where: { email: extraSuperAdminEmail },
                update: updateData,
                create: createData,
            });

            console.log('✅ Usuario superadministrador adicional sincronizado.');
        }
    }

    // Crear usuario de ejemplo
    const ejemploUser = await prisma.usuario.upsert({
        where: { email: 'monitor@ejemplo.com' },
        update: {
            nombre: 'María',
            apellidos: 'García López',
            nombreUsuario: 'maria_monitor',
            organizacion: 'Parroquia San José',
            cargo: 'Monitora de Juventud',
            experiencia: 3,
            telefono: '+34 666 777 888',
            fechaNacimiento: new Date('1995-05-15'),
            genero: 'FEMENINO',
            emailVerificado: new Date(),
            rol: 'ADMINISTRADOR',
            passwordHash: monitorPasswordHash,
        },
        create: {
            email: 'monitor@ejemplo.com',
            nombre: 'María',
            apellidos: 'García López',
            nombreUsuario: 'maria_monitor',
            organizacion: 'Parroquia San José',
            cargo: 'Monitora de Juventud',
            experiencia: 3,
            telefono: '+34 666 777 888',
            fechaNacimiento: new Date('1995-05-15'),
            genero: 'FEMENINO',
            emailVerificado: new Date(),
            rol: 'ADMINISTRADOR',
            passwordHash: monitorPasswordHash,
        },
    });

    console.log('✅ Usuario administrador de ejemplo creado:', ejemploUser.email);

    const documentadorUser = await prisma.usuario.upsert({
        where: { email: 'documentador@ejemplo.com' },
        update: {
            nombre: 'Carlos',
            apellidos: 'Díaz Romero',
            nombreUsuario: 'carlos_doc',
            organizacion: 'Centro Juvenil Horizonte',
            cargo: 'Documentador',
            experiencia: 2,
            telefono: '+34 644 555 222',
            rol: 'DOCUMENTADOR',
            passwordHash: documentadorPasswordHash,
        },
        create: {
            email: 'documentador@ejemplo.com',
            nombre: 'Carlos',
            apellidos: 'Díaz Romero',
            nombreUsuario: 'carlos_doc',
            organizacion: 'Centro Juvenil Horizonte',
            cargo: 'Documentador',
            experiencia: 2,
            telefono: '+34 644 555 222',
            rol: 'DOCUMENTADOR',
            passwordHash: documentadorPasswordHash,
        },
    });

    console.log('✅ Usuario documentador creado:', documentadorUser.email);

    const usuarioBasico = await prisma.usuario.upsert({
        where: { email: 'usuario@ejemplo.com' },
        update: {
            nombre: 'Lucía',
            apellidos: 'Fernández Soto',
            nombreUsuario: 'lucia_usuario',
            rol: 'USUARIO',
            passwordHash: usuarioPasswordHash,
        },
        create: {
            email: 'usuario@ejemplo.com',
            nombre: 'Lucía',
            apellidos: 'Fernández Soto',
            nombreUsuario: 'lucia_usuario',
            rol: 'USUARIO',
            passwordHash: usuarioPasswordHash,
        },
    });

    console.log('✅ Usuario básico creado:', usuarioBasico.email);

    // Crear actividades de ejemplo
    const actividadEjemplo1 = await prisma.actividad.upsert({
        where: { id: 'actividad_dinamica_nombre_creativo' },
        update: {
            usuarioId: ejemploUser.id,
            titulo: 'Dinámica del Nombre Creativo',
            descripcion: 'Una dinámica para que los jóvenes se presenten de manera creativa y memorable',
            contenido: JSON.stringify({
                objetivo: 'Romper el hielo y facilitar las presentaciones entre los participantes',
                desarrollo: [
                    'Cada participante dice su nombre con un adjetivo que empiece por la misma letra',
                    'Ejemplo: "Soy María la Marvillosa" o "Pedro el Paciente"',
                    'El siguiente debe repetir todos los nombres anteriores antes de decir el suyo',
                    'Continúa hasta que todos se hayan presentado'
                ],
                materiales: ['Ninguno necesario'],
                tiempo: '15-20 minutos',
                consejos: 'Ayuda a los participantes tímidos sugiriendo adjetivos positivos'
            }),
            tipoActividad: 'DINAMICA',
            edadMinima: 12,
            edadMaxima: 18,
            duracionMinutos: 20,
            numeroParticipantes: 15,
            categoria: 'Presentación',
            subcategoria: 'Rompe hielos',
            tags: 'presentacion,nombres,creatividad,participacion',
            dificultad: 'FACIL',
            promptOriginal: 'Crea una dinámica para presentaciones creativas para jóvenes de 12-18 años',
            modeloIA: 'gpt-3.5-turbo',
            parametrosIA: JSON.stringify({ temperature: 0.7, max_tokens: 500 }),
            estado: 'PUBLICADA',
            calificacion: 4.5,
            vecesUsada: 12,
        },
        create: {
            id: 'actividad_dinamica_nombre_creativo',
            usuarioId: ejemploUser.id,
            titulo: 'Dinámica del Nombre Creativo',
            descripcion: 'Una dinámica para que los jóvenes se presenten de manera creativa y memorable',
            contenido: JSON.stringify({
                objetivo: 'Romper el hielo y facilitar las presentaciones entre los participantes',
                desarrollo: [
                    'Cada participante dice su nombre con un adjetivo que empiece por la misma letra',
                    'Ejemplo: "Soy María la Marvillosa" o "Pedro el Paciente"',
                    'El siguiente debe repetir todos los nombres anteriores antes de decir el suyo',
                    'Continúa hasta que todos se hayan presentado'
                ],
                materiales: ['Ninguno necesario'],
                tiempo: '15-20 minutos',
                consejos: 'Ayuda a los participantes tímidos sugiriendo adjetivos positivos'
            }),
            tipoActividad: 'DINAMICA',
            edadMinima: 12,
            edadMaxima: 18,
            duracionMinutos: 20,
            numeroParticipantes: 15,
            categoria: 'Presentación',
            subcategoria: 'Rompe hielos',
            tags: 'presentacion,nombres,creatividad,participacion',
            dificultad: 'FACIL',
            promptOriginal: 'Crea una dinámica para presentaciones creativas para jóvenes de 12-18 años',
            modeloIA: 'gpt-3.5-turbo',
            parametrosIA: JSON.stringify({ temperature: 0.7, max_tokens: 500 }),
            estado: 'PUBLICADA',
            calificacion: 4.5,
            vecesUsada: 12,
        },
    });

    const actividadEjemplo2 = await prisma.actividad.upsert({
        where: { id: 'actividad_reflexion_valor_amistad' },
        update: {
            usuarioId: adminUser.id,
            titulo: 'Reflexión: El Valor de la Amistad',
            descripcion: 'Una actividad de reflexión profunda sobre la importancia de la amistad verdadera',
            contenido: JSON.stringify({
                objetivo: 'Reflexionar sobre las cualidades de una buena amistad y fortalecer los lazos del grupo',
                desarrollo: [
                    'Presentación del tema con una historia o video sobre amistad',
                    'Trabajo en pequeños grupos: definir qué es un buen amigo',
                    'Puesta en común de las conclusiones',
                    'Momento personal: escribir una carta a su mejor amigo',
                    'Cierre grupal compartiendo voluntariamente'
                ],
                materiales: ['Hojas de papel', 'Bolígrafos', 'Video o historia preparada'],
                tiempo: '45-60 minutos',
                consejos: 'Crear un ambiente de confianza y respeto para facilitar la apertura'
            }),
            tipoActividad: 'REFLEXION',
            edadMinima: 14,
            edadMaxima: 21,
            duracionMinutos: 50,
            numeroParticipantes: 20,
            categoria: 'Valores',
            subcategoria: 'Amistad',
            tags: 'amistad,valores,reflexion,compartir',
            dificultad: 'INTERMEDIO',
            promptOriginal: 'Diseña una reflexión sobre amistad para jóvenes adolescentes',
            modeloIA: 'gpt-4',
            parametrosIA: JSON.stringify({ temperature: 0.6, max_tokens: 800 }),
            estado: 'PUBLICADA',
            calificacion: 4.8,
            vecesUsada: 8,
        },
        create: {
            id: 'actividad_reflexion_valor_amistad',
            usuarioId: adminUser.id,
            titulo: 'Reflexión: El Valor de la Amistad',
            descripcion: 'Una actividad de reflexión profunda sobre la importancia de la amistad verdadera',
            contenido: JSON.stringify({
                objetivo: 'Reflexionar sobre las cualidades de una buena amistad y fortalecer los lazos del grupo',
                desarrollo: [
                    'Presentación del tema con una historia o video sobre amistad',
                    'Trabajo en pequeños grupos: definir qué es un buen amigo',
                    'Puesta en común de las conclusiones',
                    'Momento personal: escribir una carta a su mejor amigo',
                    'Cierre grupal compartiendo voluntariamente'
                ],
                materiales: ['Hojas de papel', 'Bolígrafos', 'Video o historia preparada'],
                tiempo: '45-60 minutos',
                consejos: 'Crear un ambiente de confianza y respeto para facilitar la apertura'
            }),
            tipoActividad: 'REFLEXION',
            edadMinima: 14,
            edadMaxima: 21,
            duracionMinutos: 50,
            numeroParticipantes: 20,
            categoria: 'Valores',
            subcategoria: 'Amistad',
            tags: 'amistad,valores,reflexion,compartir',
            dificultad: 'INTERMEDIO',
            promptOriginal: 'Diseña una reflexión sobre amistad para jóvenes adolescentes',
            modeloIA: 'gpt-4',
            parametrosIA: JSON.stringify({ temperature: 0.6, max_tokens: 800 }),
            estado: 'PUBLICADA',
            calificacion: 4.8,
            vecesUsada: 8,
        },
    });

    console.log('✅ Actividades de ejemplo creadas');

    // Sincronizar actividades con ChromaDB si está disponible
    const chromaReady = await chromaService.initialize();

    if (chromaReady) {
        const actividades = [actividadEjemplo1, actividadEjemplo2];

        const documentos = actividades.map((actividad) => {
            let contenidoVector;

            try {
                const contenidoParseado = typeof actividad.contenido === 'string'
                    ? JSON.parse(actividad.contenido)
                    : actividad.contenido;

                contenidoVector = JSON.stringify({
                    titulo: actividad.titulo,
                    descripcion: actividad.descripcion,
                    contenido: contenidoParseado,
                });
            } catch (error) {
                contenidoVector = JSON.stringify({
                    titulo: actividad.titulo,
                    descripcion: actividad.descripcion,
                    contenido: actividad.contenido,
                });
            }

            return {
                id: actividad.id,
                document: contenidoVector,
                metadata: {
                    tipoActividad: actividad.tipoActividad,
                    edadMinima: actividad.edadMinima,
                    edadMaxima: actividad.edadMaxima,
                    tags: actividad.tags ? actividad.tags.split(',').map((tag) => tag.trim()) : [],
                    dificultad: actividad.dificultad,
                },
            };
        });

        for (const doc of documentos) {
            const agregado = await chromaService.addDocument(doc.id, doc.document, doc.metadata);
            if (agregado) {
                console.log(`📚 Documento ${doc.id} agregado a ChromaDB`);
            }
        }

        const count = await chromaService.getDocumentCount();
        console.log(`📈 Documentos en ChromaDB: ${count}`);
    } else {
        console.log('⚠️ No se pudo conectar con ChromaDB durante el seed.');
    }

    // Crear configuraciones de usuario
    await prisma.configuracionUsuario.createMany({
        data: [
            {
                usuarioId: ejemploUser.id,
                clave: 'edad_preferida',
                valor: '14-17',
                tipo: 'string',
            },
            {
                usuarioId: ejemploUser.id,
                clave: 'tipos_actividad_preferidos',
                valor: JSON.stringify(['DINAMICA', 'JUEGO', 'REFLEXION']),
                tipo: 'json',
            },
            {
                usuarioId: ejemploUser.id,
                clave: 'duracion_preferida',
                valor: '30',
                tipo: 'number',
            },
        ],
        skipDuplicates: true,
    });

    console.log('✅ Configuraciones de usuario creadas');

    // Crear favoritos
    await prisma.actividadFavorita.upsert({
        where: { id: 'favorito_maria_dinamica' },
        update: {
            usuarioId: ejemploUser.id,
            actividadId: actividadEjemplo1.id,
        },
        create: {
            id: 'favorito_maria_dinamica',
            usuarioId: ejemploUser.id,
            actividadId: actividadEjemplo1.id,
        },
    });

    console.log('✅ Favoritos creados');

    console.log('\n[INFO] Usuarios iniciales sincronizados. Consulta las variables de entorno de seed para conocer las credenciales configuradas.');

    console.log('🌟 Seed completado exitosamente!');
}

main()
    .catch((e) => {
        console.error('❌ Error durante el seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });