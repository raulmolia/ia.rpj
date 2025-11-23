-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NULL,
    `nombreUsuario` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `fechaNacimiento` DATETIME(3) NULL,
    `genero` ENUM('MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERO_NO_DECIR') NULL,
    `rol` ENUM('SUPERADMIN', 'ADMINISTRADOR', 'DOCUMENTADOR', 'USUARIO') NOT NULL DEFAULT 'USUARIO',
    `emailVerificado` DATETIME(3) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `organizacion` VARCHAR(191) NULL,
    `cargo` VARCHAR(191) NULL,
    `experiencia` INTEGER NULL,
    `temaPreferido` VARCHAR(191) NOT NULL DEFAULT 'light',
    `idioma` VARCHAR(191) NOT NULL DEFAULT 'es',
    `notificaciones` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    UNIQUE INDEX `usuarios_nombreUsuario_key`(`nombreUsuario`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sesiones` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `tipoDispositivo` VARCHAR(191) NULL,
    `navegador` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `ubicacion` VARCHAR(191) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaExpiracion` DATETIME(3) NOT NULL,
    `ultimoAcceso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sesiones_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividades` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `contenido` VARCHAR(191) NOT NULL,
    `tipoActividad` ENUM('DINAMICA', 'JUEGO', 'REFLEXION', 'ORACION', 'TALLER', 'DEBATE', 'COMPETICION', 'CREATIVA', 'DEPORTIVA', 'MUSICAL') NOT NULL,
    `edadMinima` INTEGER NOT NULL,
    `edadMaxima` INTEGER NOT NULL,
    `duracionMinutos` INTEGER NOT NULL,
    `numeroParticipantes` INTEGER NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `subcategoria` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `dificultad` ENUM('MUY_FACIL', 'FACIL', 'INTERMEDIO', 'DIFICIL', 'MUY_DIFICIL') NOT NULL,
    `promptOriginal` VARCHAR(191) NOT NULL,
    `modeloIA` VARCHAR(191) NOT NULL,
    `parametrosIA` VARCHAR(191) NOT NULL,
    `versionIA` VARCHAR(191) NULL,
    `estado` ENUM('BORRADOR', 'PUBLICADA', 'ARCHIVADA', 'ELIMINADA') NOT NULL DEFAULT 'BORRADOR',
    `calificacion` DOUBLE NULL,
    `vecesUsada` INTEGER NOT NULL DEFAULT 0,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividades_favoritas` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `actividadId` VARCHAR(191) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `actividades_favoritas_usuarioId_actividadId_key`(`usuarioId`, `actividadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuraciones_usuario` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `clave` VARCHAR(191) NOT NULL,
    `valor` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    UNIQUE INDEX `configuraciones_usuario_usuarioId_clave_key`(`usuarioId`, `clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `nombreOriginal` VARCHAR(191) NOT NULL,
    `rutaArchivo` VARCHAR(191) NOT NULL,
    `tamanoBytes` INTEGER NOT NULL,
    `tipoMime` VARCHAR(191) NOT NULL,
    `etiquetas` JSON NOT NULL,
    `descripcionGenerada` VARCHAR(191) NULL,
    `estadoProcesamiento` ENUM('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR') NOT NULL DEFAULT 'PENDIENTE',
    `mensajeError` VARCHAR(191) NULL,
    `fechaProcesamiento` DATETIME(3) NULL,
    `contenidoExtraido` LONGTEXT NULL,
    `vectorDocumentoId` VARCHAR(191) NULL,
    `coleccionVectorial` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    INDEX `idx_documentos_fecha`(`fechaCreacion`),
    INDEX `idx_documentos_estado`(`estadoProcesamiento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sesiones` ADD CONSTRAINT `sesiones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividades` ADD CONSTRAINT `actividades_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividades_favoritas` ADD CONSTRAINT `actividades_favoritas_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividades_favoritas` ADD CONSTRAINT `actividades_favoritas_actividadId_fkey` FOREIGN KEY (`actividadId`) REFERENCES `actividades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configuraciones_usuario` ADD CONSTRAINT `configuraciones_usuario_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

