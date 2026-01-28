import { BotEngine } from './bot-engine';
import { prisma } from '@/lib/db';

/**
 * Bot Manager Service - Singleton
 * Manages all bot instances and ensures 24/7 execution
 */
class BotManagerService {
    private static instance: BotManagerService;
    private bots: Map<string, BotEngine> = new Map();
    private initialized: boolean = false;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): BotManagerService {
        if (!BotManagerService.instance) {
            BotManagerService.instance = new BotManagerService();
        }
        return BotManagerService.instance;
    }

    /**
     * Initialize bot manager and auto-start all RUNNING bots
     * Call this on server startup
     */
    async initialize() {
        if (this.initialized) {
            console.log('[BotManager] Already initialized');
            return;
        }

        console.log('[BotManager] Initializing...');

        try {
            // Find all bots that were running before server restart
            const runningBots = await prisma.bot.findMany({
                where: { status: 'RUNNING' }
            });

            console.log(`[BotManager] Found ${runningBots.length} running bots`);

            // Restart each bot
            for (const bot of runningBots) {
                try {
                    await this.startBot(bot.id);
                    console.log(`[BotManager] Restarted bot: ${bot.name} (${bot.id})`);
                } catch (error: any) {
                    console.error(`[BotManager] Failed to restart bot ${bot.id}:`, error.message);
                    // Mark bot as stopped if restart fails
                    await prisma.bot.update({
                        where: { id: bot.id },
                        data: { status: 'STOPPED' }
                    });
                }
            }

            this.initialized = true;
            console.log('[BotManager] Initialization complete');
        } catch (error) {
            console.error('[BotManager] Initialization failed:', error);
        }
    }

    /**
     * Start a bot
     */
    async startBot(botId: string): Promise<void> {
        // Check if bot is already running
        if (this.bots.has(botId)) {
            console.log(`[BotManager] Bot ${botId} is already running`);
            return;
        }

        try {
            const engine = new BotEngine(botId);
            await engine.start();
            this.bots.set(botId, engine);

            // Update last started time
            await prisma.bot.update({
                where: { id: botId },
                data: {
                    startedAt: new Date(),
                    lastActivityAt: new Date()
                }
            });

            console.log(`[BotManager] Started bot: ${botId}`);
        } catch (error: any) {
            console.error(`[BotManager] Failed to start bot ${botId}:`, error.message);
            throw error;
        }
    }

    /**
     * Stop a bot
     */
    async stopBot(botId: string): Promise<void> {
        const engine = this.bots.get(botId);

        if (!engine) {
            console.log(`[BotManager] Bot ${botId} is not running`);
            return;
        }

        try {
            await engine.stop();
            this.bots.delete(botId);
            console.log(`[BotManager] Stopped bot: ${botId}`);
        } catch (error: any) {
            console.error(`[BotManager] Failed to stop bot ${botId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get running bot instance
     */
    getBot(botId: string): BotEngine | undefined {
        return this.bots.get(botId);
    }

    /**
     * Check if bot is running
     */
    isRunning(botId: string): boolean {
        return this.bots.has(botId);
    }

    /**
     * Get all running bot IDs
     */
    getRunningBotIds(): string[] {
        return Array.from(this.bots.keys());
    }

    /**
     * Get count of running bots
     */
    getRunningCount(): number {
        return this.bots.size;
    }

    /**
     * Stop all bots (for graceful shutdown)
     */
    async stopAll(): Promise<void> {
        console.log('[BotManager] Stopping all bots...');

        const stopPromises = Array.from(this.bots.keys()).map(botId =>
            this.stopBot(botId).catch(err =>
                console.error(`Failed to stop bot ${botId}:`, err)
            )
        );

        await Promise.all(stopPromises);
        console.log('[BotManager] All bots stopped');
    }
}

// Export singleton instance
export const botManager = BotManagerService.getInstance();

// Initialize on module load (server startup)
if (typeof window === 'undefined') {
    // Only run on server side
    botManager.initialize().catch(err => {
        console.error('[BotManager] Failed to initialize:', err);
    });
}
