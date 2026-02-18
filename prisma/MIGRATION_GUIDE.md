# Quick Migration Guide

## Apply the MarketAnalysis Table Migration

The app is currently running with backward compatibility, but to unlock full functionality, you need to create the `MarketAnalysis` table.

### Option 1: Using MySQL Workbench or phpMyAdmin

1. Open your MySQL client
2. Connect to your database
3. Select the `trading_bot` database
4. Run this SQL:

```sql
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

ALTER TABLE `MarketAnalysis` ADD CONSTRAINT `MarketAnalysis_botId_fkey` 
FOREIGN KEY (`botId`) REFERENCES `Bot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Option 2: Using Command Line

```bash
# Connect to MySQL
mysql -u your_username -p trading_bot

# Paste the SQL from add_market_analysis.sql
source c:/Users/win-10/OneDrive/Desktop/bot/prisma/add_market_analysis.sql
```

### Verify Migration

```sql
-- Check if table was created
SHOW TABLES LIKE 'MarketAnalysis';

-- View table structure  
DESCRIBE MarketAnalysis;
```

After running the migration, the app will automatically start storing analysis data in the new table!
