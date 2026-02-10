-- CreateTable
CREATE TABLE `conversaciones` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `intencionPrincipal` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    INDEX `idx_conversaciones_usuario`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensajes_conversacion` (
    `id` VARCHAR(191) NOT NULL,
    `conversacionId` VARCHAR(191) NOT NULL,
    `rol` ENUM('USUARIO', 'ASISTENTE', 'SISTEMA') NOT NULL,
    `contenido` LONGTEXT NOT NULL,
    `intencion` VARCHAR(191) NULL,
    `tokensEntrada` INTEGER NULL,
    `tokensSalida` INTEGER NULL,
    `duracionMs` INTEGER NULL,
    `metadatos` JSON NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_mensajes_conversacion_conversacionId`(`conversacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `conversaciones` ADD CONSTRAINT `conversaciones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensajes_conversacion` ADD CONSTRAINT `mensajes_conversacion_conversacionId_fkey` FOREIGN KEY (`conversacionId`) REFERENCES `conversaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
