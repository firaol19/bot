import { BotEngine } from '@/services/bot-engine';
import { prisma } from '@/lib/db';

/**
 * Bot Manager Service - Singleton
 * Manages all bot instances and ensures 24/7 execution
 */
class BotManager {
    private static instance: BotManager;
    private bots: Map<string, BotEngine> = new Map();
    private initialized: boolean = false;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): BotManager {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
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

        console.log('[BotManager] Initializing and restarting bots...');

        try {
            // Find all bots that were running before server restart
            const runningBots = await prisma.bot.findMany({
                where: { status: 'RUNNING' }
            });

            console.log(`[BotManager] Found ${runningBots.length} running bots to resume`);

            // Restart each bot
            for (const bot of runningBots) {
                try {
                    // Create engine instance
                    const engine = new BotEngine(bot.id);
                    // Update start time to now for new session
                    await prisma.bot.update({
                        where: { id: bot.id },
                        data: { startedAt: new Date() }
                    });
                    // Start bot
                    await engine.start();
                    this.bots.set(bot.id, engine);

                    console.log(`[BotManager] Successfully resumed bot: ${bot.name} (${bot.id})`);
                } catch (error: any) {
                    console.error(`[BotManager] Failed to resume bot ${bot.id}:`, error.message);
                    // Mark bot as stopped if restart fails to avoid infinite restart loops
                    await prisma.bot.update({
                        where: { id: bot.id },
                        data: { status: 'STOPPED' }
                    });
                }
            }

            this.initialized = true;
            console.log('[BotManager] Initialization complete. All bots running in background.');
        } catch (error) {
            console.error('[BotManager] Initialization failed:', error);
        }
    }

    /**
     * Start a bot
     */
    async startBot(botId: string): Promise<void> {
        // Check if bot is already running in memory
        if (this.bots.has(botId)) {
            console.log(`[BotManager] Bot ${botId} is already running in memory. Syncing DB status.`);
            await prisma.bot.update({
                where: { id: botId },
                data: { status: 'RUNNING' }
            });
            return;
        }

        try {
            const engine = new BotEngine(botId);

            // Set status and startedAt in DB BEFORE starting engine
            await prisma.bot.update({
                where: { id: botId },
                data: {
                    status: 'RUNNING',
                    startedAt: new Date(),
                    lastActivityAt: new Date()
                }
            });

            await engine.start();
            this.bots.set(botId, engine);

            console.log(`[BotManager] Started bot instance: ${botId}`);
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
            // Even if not in memory, we should try to mark it as STOPPED in DB
            console.log(`[BotManager] Bot ${botId} not found in memory, marking as STOPPED in DB`);
            await prisma.bot.update({
                where: { id: botId },
                data: { status: 'STOPPED', startedAt: null }
            });
            return;
        }

        try {
            await engine.stop();
            this.bots.delete(botId);
            console.log(`[BotManager] Stopped bot instance: ${botId}`);
        } catch (error: any) {
            console.error(`[BotManager] Error during bot stop ${botId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get running bot instance
     */
    getBotInstance(botId: string): BotEngine | undefined {
        return this.bots.get(botId);
    }

    /**
     * Check if bot is running in memory
     */
    isRunning(botId: string): boolean {
        return this.bots.has(botId);
    }

    /**
     * Get count of running bots
     */
    getRunningCount(): number {
        return this.bots.size;
    }

    /**
     * Stop all bots gracefully
     */
    async stopAll(): Promise<void> {
        console.log('[BotManager] Gracefully stopping all bots...');
        const botIds = Array.from(this.bots.keys());
        for (const id of botIds) {
            await this.stopBot(id).catch(e => console.error(e));
        }
    }
}

// Use globalThis to persist the singleton across HMR in development
const globalForBotManager = globalThis as unknown as {
    botManager: BotManager | undefined;
};

export const botManager = globalForBotManager.botManager ?? BotManager.getInstance();

if (process.env.NODE_ENV !== 'production') {
    globalForBotManager.botManager = botManager;
}

// Auto-initialize on server
if (typeof window === 'undefined') {
    botManager.initialize().catch(err => {
        console.error('[BotManager] Server initialization failed:', err);
    });
}
