-- CreateTable
CREATE TABLE `fuentes_web` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `url` VARCHAR(191) NOT NULL,
    `dominio` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `etiquetas` JSON NOT NULL,
    `tipoFuente` ENUM('PAGINA', 'DOMINIO', 'SITEMAP') NOT NULL DEFAULT 'PAGINA',
    `estadoProcesamiento` ENUM('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR') NOT NULL DEFAULT 'PENDIENTE',
    `mensajeError` VARCHAR(191) NULL,
    `fechaProcesamiento` DATETIME(3) NULL,
    `contenidoExtraido` LONGTEXT NULL,
    `vectorDocumentoId` VARCHAR(191) NULL,
    `coleccionVectorial` VARCHAR(191) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL,

    INDEX `idx_fuentes_web_dominio`(`dominio`),
    INDEX `idx_fuentes_web_estado`(`estadoProcesamiento`),
    INDEX `idx_fuentes_web_activa`(`activa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fuentes_web` ADD CONSTRAINT `fuentes_web_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
