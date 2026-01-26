import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { GridStrategy } from '@/lib/trading/grid-strategy';
import { decrypt } from '@/lib/encryption';

export class BotEngine {
    private botId: string;
    private isRunning: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private exchange: BybitClient | null = null;
    private strategy: GridStrategy;

    constructor(botId: string) {
        this.botId = botId;
        this.strategy = new GridStrategy();
    }

    async start() {
        if (this.isRunning) return;

        const bot = await prisma.bot.findUnique({ where: { id: this.botId } });
        if (!bot) throw new Error('Bot not found');

        // Initialize exchange client
        // Use keys if available, regardless of mode (allows Testnet with keys)
        if (bot.apiKey && bot.apiSecret) {
            this.exchange = new BybitClient({
                apiKey: decrypt(bot.apiKey),
                apiSecret: decrypt(bot.apiSecret),
                testnet: bot.mode === 'DEMO' || false
            });
        } else {
            // Public data only (no trading possible)
            this.exchange = new BybitClient({ testnet: true });
        }

        this.isRunning = true;
        await prisma.bot.update({ where: { id: this.botId }, data: { status: 'RUNNING' } });

        // Start loop
        this.loop();
    }

    async stop() {
        this.isRunning = false;
        if (this.checkInterval) clearTimeout(this.checkInterval);
        await prisma.bot.update({ where: { id: this.botId }, data: { status: 'STOPPED' } });
    }

    private async loop() {
        if (!this.isRunning) return;

        try {
            await this.executeStrategy();
        } catch (error) {
            console.error('Bot loop error:', error);
        }

        // Schedule next run
        this.checkInterval = setTimeout(() => this.loop(), 5000); // 5 second interval
    }

    private async executeStrategy() {
        const bot = await prisma.bot.findUnique({
            where: { id: this.botId },
            include: { positions: { where: { status: 'OPEN' } } }
        });

        if (!bot || !bot.active) {
            await this.stop();
            return;
        }

        // Get current price
        let currentPrice = 0;
        if (this.exchange) {
            const ticker = await this.exchange.getTicker(bot.symbol);
            currentPrice = ticker.last || 0;
        }

        if (currentPrice === 0) return;

        // Check Sell Conditions (for open positions)
        for (const position of bot.positions) {
            if (this.strategy.shouldSell(currentPrice, position.entryPrice, bot.sellPercentage)) {
                await this.sell(bot, position, currentPrice);
            }
        }

        // Check Buy Conditions
        // If no positions, buy immediately or if price dropped enough from last buy
        const lastPosition = bot.positions[bot.positions.length - 1]; // Naive last position
        const lastEntry = lastPosition ? lastPosition.entryPrice : 0; // 0 implies first buy (if allow immediate buy)

        // Simple logic: if no position, buy. If has position, check drop.
        // NOTE: This logic might need refinement for "first buy" trigger preference (immediate vs wait for drop)
        // For this example, we'll assume we want to enter immediately if empty, or DCA if price drops.
        const shouldBuy = bot.positions.length === 0 || this.strategy.shouldBuy(currentPrice, lastEntry, bot.buyDrop);

        if (shouldBuy) {
            // Get available balance (USDT)
            let availableBalance = bot.capital;
            if (this.exchange) {
                try {
                    const balance = await this.exchange.getBalance();
                    // Assuming 'USDT' is the quote currency. Adjust if needed.
                    // Bybit unified account often uses 'total', 'free'
                    if (balance['USDT']) {
                        availableBalance = balance['USDT'].free || 0;

                        // Update bot capital in DB for UI visibility
                        await prisma.bot.update({
                            where: { id: bot.id },
                            data: { capital: availableBalance }
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch balance, using stored capital:', error);
                }
            }

            // Check if we have enough capital allocation left (simple check: max positions?)
            // For now, infinite grid until capital runs out or some limit
            await this.buy(bot, currentPrice, availableBalance);
        }

        // Update last seen price
        await prisma.bot.update({
            where: { id: bot.id },
            data: { lastPrice: currentPrice }
        });
    }

    private async buy(bot: any, price: number, totalCapital: number) {
        const amount = this.strategy.calculatePositionSize(totalCapital, bot.buyPercentage, price);

        if (amount <= 0) {
            console.log(`[${bot.mode}] Insufficient capital to buy ${bot.symbol}`);
            return;
        }

        // Execute Trade found

        // Execute Trade found
        if (bot.mode === 'REAL' && this.exchange) {
            // await this.exchange.createOrder(bot.symbol, 'market', 'buy', amount);
            // Note: Real execution needs careful handling of precision and errors
        }

        // Record in DB (Demo logic applies here too)
        await prisma.$transaction([
            prisma.position.create({
                data: {
                    botId: bot.id,
                    symbol: bot.symbol,
                    amount: amount,
                    entryPrice: price,
                    status: 'OPEN'
                }
            }),
            prisma.trade.create({
                data: {
                    botId: bot.id,
                    symbol: bot.symbol,
                    side: 'BUY',
                    amount: amount,
                    price: price,
                    total: amount * price
                }
            })
        ]);

        console.log(`[${bot.mode}] Bought ${bot.symbol} at ${price}`);
    }

    private async sell(bot: any, position: any, price: number) {
        // Execute Trade
        if (bot.mode === 'REAL' && this.exchange) {
            // await this.exchange.createOrder(bot.symbol, 'market', 'sell', position.amount);
        }

        const profit = (price - position.entryPrice) * position.amount;

        await prisma.$transaction([
            prisma.position.update({
                where: { id: position.id },
                data: {
                    status: 'CLOSED',
                    currentPrice: price,
                    pnl: profit
                }
            }),
            prisma.trade.create({
                data: {
                    botId: bot.id,
                    symbol: bot.symbol,
                    side: 'SELL',
                    amount: position.amount,
                    price: price,
                    total: position.amount * price,
                    profit: profit
                }
            }),
            prisma.bot.update({
                where: { id: bot.id },
                data: {
                    totalProfit: { increment: profit }
                }
            })
        ]);

        console.log(`[${bot.mode}] Sold ${bot.symbol} at ${price} (Profit: ${profit})`);
    }
}
