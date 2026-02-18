-- CreateTable
CREATE TABLE `MarketAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `botId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decision` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `data` JSON NOT NULL,

    INDEX `MarketAnalysis_botId_idx`(`botId`),
    INDEX `MarketAnalysis_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MarketAnalysis` ADD CONSTRAINT `MarketAnalysis_botId_fkey` FOREIGN KEY (`botId`) REFERENCES `Bot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
