import { BotEngine } from '../services/bot-engine';

class BotManager {
    private bots: Map<string, BotEngine> = new Map();
    private static instance: BotManager;

    private constructor() { }

    public static getInstance(): BotManager {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
    }

    async startBot(botId: string) {
        let bot = this.bots.get(botId);
        if (!bot) {
            bot = new BotEngine(botId);
            this.bots.set(botId, bot);
        }
        await bot.start();
    }

    async stopBot(botId: string) {
        const bot = this.bots.get(botId);
        if (bot) {
            await bot.stop();
            // Optional: remove from map if we want to clear memory, 
            // but keeping it allows resuming with same state object if needed
            // this.bots.delete(botId); 
        }
    }

    getBotInstance(botId: string) {
        return this.bots.get(botId);
    }
}

export const botManager = BotManager.getInstance();
