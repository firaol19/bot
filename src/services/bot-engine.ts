import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { GridStrategy } from '@/lib/trading/grid-strategy';
import { RiskManager } from '@/lib/trading/risk-manager';
import { decrypt } from '@/lib/encryption';

export class BotEngine {
    private botId: string;
    private isRunning: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private exchange: BybitClient | null = null;
    private strategy: GridStrategy;
    private riskManager: RiskManager;
    private ws: any = null;
    private lastProcessedPrice: number = 0;
    private isExecuting: boolean = false;

    constructor(botId: string) {
        this.botId = botId;
        this.strategy = new GridStrategy();
        this.riskManager = new RiskManager(); // Will be updated with bot-specific config
    }

    async start() {
        if (this.isRunning) return;

        const bot = await prisma.bot.findUnique({ where: { id: this.botId } }) as any;
        if (!bot) throw new Error('Bot not found');

        // Initialize risk manager with bot configuration
        this.riskManager = new RiskManager({
            stopLossPercentage: bot.stopLossPercentage || undefined,
            takeProfitPercentage: bot.takeProfitPercentage || undefined,
            maxPositions: bot.maxPositions,
            maxDailyLoss: bot.maxDailyLoss || undefined,
            trailingStopPercent: bot.trailingStopPercent || undefined,
        });

        // Initialize exchange client
        if (bot.apiKey && bot.apiSecret) {
            this.exchange = new BybitClient({
                apiKey: decrypt(bot.apiKey),
                apiSecret: decrypt(bot.apiSecret),
                testnet: bot.mode === 'DEMO'
            });

            // Validate connection
            const isConnected = await this.exchange.validateConnection();
            if (!isConnected) {
                await this.logError(bot.id, 'Failed to connect to exchange');
                throw new Error('Failed to connect to exchange');
            }

            await this.logInfo(bot.id, `Connected to ${bot.mode} mode successfully`);
        } else {
            // Public data only (no trading possible)
            this.exchange = new BybitClient({ testnet: true });
            await this.logWarning(bot.id, 'No API keys configured - public data only');
        }

        this.isRunning = true;
        await prisma.bot.update({ where: { id: this.botId }, data: { status: 'RUNNING' } });
        await this.logInfo(bot.id, `🚀 Bot starting in ${bot.mode} mode for ${bot.symbol}`);

        // Start WebSocket subscription for real-time data
        if (this.exchange) {
            this.ws = await this.exchange.subscribeTicker(bot.symbol, (price: number) => {
                this.onPriceUpdate(price);
            });
        }

        // Keep a slow heartbeat loop for non-price status updates
        this.heartbeat();
    }

    async stop() {
        this.isRunning = false;
        if (this.checkInterval) clearTimeout(this.checkInterval);
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }

        // Update runtime on stop
        const bot = await prisma.bot.findUnique({ where: { id: this.botId } }) as any;
        if (bot && bot.startedAt) {
            const SessionRuntime = Math.floor((Date.now() - bot.startedAt.getTime()) / 1000);
            await prisma.bot.update({
                where: { id: this.botId },
                data: {
                    status: 'STOPPED',
                    totalRuntime: { increment: SessionRuntime },
                    startedAt: null
                } as any
            });
        } else {
            await prisma.bot.update({ where: { id: this.botId }, data: { status: 'STOPPED' } });
        }
    }

    private async heartbeat() {
        if (!this.isRunning) return;

        try {
            // Update last activity heartbeat in DB
            await prisma.bot.update({
                where: { id: this.botId },
                data: { lastActivityAt: new Date() } as any
            });
        } catch (error: any) {
            console.error('[BotEngine] Heartbeat error:', error.message);
        }

        this.checkInterval = setTimeout(() => this.heartbeat(), 30000); // 30 second heartbeat
    }

    private async onPriceUpdate(price: number) {
        if (!this.isRunning || this.isExecuting) return;

        // Throttle: only process if price changed significantly or 5 seconds passed
        // This prevents overwhelming the DB/Exchange on high volatility
        const timeSinceLastActivity = Date.now() - (this.lastProcessedPrice ? 0 : 0); // Placeholder for advanced throttling

        this.isExecuting = true;
        try {
            await this.executeStrategy(price);
            this.lastProcessedPrice = price;
        } catch (error: any) {
            await this.logError(this.botId, `Strategy execution error: ${error.message}`);
        } finally {
            this.isExecuting = false;
        }
    }

    private async executeStrategy(currentPrice: number) {
        const bot = await prisma.bot.findUnique({
            where: { id: this.botId },
            include: {
                positions: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'asc' }
                }
            }
        }) as any;

        if (!bot || !bot.active) {
            await this.logWarning(this.botId, 'Bot is inactive or removed, stopping engine');
            await this.stop();
            return;
        }

        // Update highest price for trailing stop
        const botData = bot as any;
        const newHighestPrice = Math.max(botData.highestPrice || 0, currentPrice);
        if (newHighestPrice > (botData.highestPrice || 0)) {
            await prisma.bot.update({
                where: { id: bot.id },
                data: { highestPrice: newHighestPrice } as any
            });
        }

        // Check Risk Management for all positions
        for (const position of bot.positions) {
            const riskSummary = this.riskManager.getPositionRiskSummary(
                { ...position, currentPrice },
                currentPrice
            );

            // Check Stop Loss
            if (riskSummary.shouldStopLoss) {
                await this.logWarning(bot.id, `Stop loss triggered for position ${position.id} at ${currentPrice}`);
                await this.createAlert(bot.id, 'STOP_LOSS', `Stop loss triggered at $${currentPrice.toFixed(2)}. Loss: $${riskSummary.pnl.toFixed(2)}`);
                await this.sell(bot, position, currentPrice, 'STOP_LOSS');
                continue;
            }

            // Check Take Profit
            if (riskSummary.shouldTakeProfit) {
                await this.logInfo(bot.id, `Take profit triggered for position ${position.id} at ${currentPrice}`);
                await this.createAlert(bot.id, 'TAKE_PROFIT', `Take profit triggered at $${currentPrice.toFixed(2)}. Profit: $${riskSummary.pnl.toFixed(2)}`);
                await this.sell(bot, position, currentPrice, 'TAKE_PROFIT');
                continue;
            }

            // Check Trailing Stop
            if (bot.trailingStopPercent && bot.highestPrice) {
                if (this.riskManager.shouldTriggerTrailingStop(currentPrice, bot.highestPrice)) {
                    await this.logInfo(bot.id, `Trailing stop triggered for position ${position.id}`);
                    await this.createAlert(bot.id, 'TRAILING_STOP', `Trailing stop triggered at $${currentPrice.toFixed(2)}`);
                    await this.sell(bot, position, currentPrice, 'TRAILING_STOP');
                    continue;
                }
            }

            // Check regular sell conditions (grid strategy)
            if (this.strategy.shouldSell(currentPrice, position.entryPrice, bot.sellPercentage)) {
                await this.logInfo(bot.id, `Grid sell triggered for position ${position.id} at ${currentPrice} (Profit target reached)`);
                await this.sell(bot, position, currentPrice, 'GRID_SELL');
            }
        }

        // Check Buy Conditions
        const lastPosition = bot.positions[bot.positions.length - 1];
        const lastEntry = lastPosition ? lastPosition.entryPrice : 0;

        // Determine if we should buy
        const isFirstTrade = bot.positions.length === 0;
        const shouldBuy = isFirstTrade || this.strategy.shouldBuy(currentPrice, lastEntry, bot.buyDrop);

        if (shouldBuy) {
            if (isFirstTrade) {
                await this.logInfo(bot.id, `🚀 Initial buy triggered for ${bot.symbol} at market price to start trading session`);
            }

            // Check position limit
            if (!this.riskManager.canOpenPosition(bot.positions.length)) {
                await this.logWarning(bot.id, `Position limit reached (${bot.positions.length}/${bot.maxPositions})`);
                await this.createAlert(bot.id, 'POSITION_LIMIT', `Maximum positions (${bot.maxPositions}) reached`);
                return;
            }

            // Verify we have enough balance on exchange (Safety Check)
            let exchangeFreeBalance = bot.capital;
            if (this.exchange) {
                try {
                    const balance = await this.exchange.getBalance();
                    if (balance['USDT']) {
                        exchangeFreeBalance = balance['USDT'].free || 0;

                        // Sync capital for display purposes if wanted, but bot.capital is our calculation base
                        await prisma.bot.update({
                            where: { id: bot.id },
                            data: { lastActivityAt: new Date() } // Just update heart-beat
                        });
                    }
                } catch (error: any) {
                    await this.logError(bot.id, `Failed to verify exchange balance: ${error.message}`);
                }
            }

            // Calculate cost for this trade (based on ALLOCATED capital, not current wallet)
            let tradeCost = bot.capital * (bot.buyPercentage / 100);

            // Adjust trade cost if available balance is lower (due to previous losses)
            // but ensure it's still worth trading (Bybit min is ~$1.00)
            if (tradeCost > exchangeFreeBalance) {
                if (exchangeFreeBalance >= 1.1) {
                    await this.logWarning(bot.id, `Available balance ($${exchangeFreeBalance.toFixed(2)}) is less than target trade size ($${tradeCost.toFixed(2)}). Using remaining balance instead.`);
                    tradeCost = exchangeFreeBalance;
                } else {
                    await this.logError(bot.id, `Insufficient balance ($${exchangeFreeBalance.toFixed(2)}) to open new position even at minimum size.`);
                    return;
                }
            }

            await this.buy(bot, currentPrice, tradeCost / (bot.buyPercentage / 100)); // Reverse calculate to keep buy() logic or just update buy()
        }

        // Update last seen price
        await prisma.bot.update({
            where: { id: bot.id },
            data: { lastPrice: currentPrice } as any
        });
    }

    private async buy(bot: any, price: number, totalCapital: number) {
        const amount = this.strategy.calculatePositionSize(totalCapital, bot.buyPercentage, price);
        const tradeValue = amount * price;

        // Validate trade size
        const validation = this.riskManager.validateTradeSize(tradeValue, totalCapital);
        if (!validation.valid) {
            await this.logWarning(bot.id, `Trade validation failed: ${validation.reason}`);
            return;
        }

        // Execute Real Trade
        let orderId: string | undefined;
        if (bot.mode === 'REAL' && this.exchange) {
            try {
                // Apply exchange precision
                const precisionAmount = parseFloat(this.exchange.amountToPrecision(bot.symbol, amount));

                await this.logInfo(bot.id, `Executing ${bot.mode} BUY order: ${precisionAmount} ${bot.symbol} (Value: $${tradeValue.toFixed(2)})`);

                const order = await this.exchange.createOrder(bot.symbol, 'market', 'buy', precisionAmount);
                orderId = order.id;

                await this.logInfo(bot.id, `Order executed successfully. Order ID: ${orderId}`);
            } catch (error: any) {
                const errorMsg = error.message || 'Unknown exchange error';
                console.error(`[BotEngine] Trade failed: ${errorMsg}`);
                await this.logError(bot.id, `Trade failed: ${errorMsg}`);
                await this.createAlert(bot.id, 'ERROR', `Failed to execute buy order: ${errorMsg}`);
                return; // Don't record in DB if real order failed
            }
        }

        // Record in DB (for both Demo and Real modes)
        try {
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
                        total: tradeValue,
                        orderId: orderId
                    }
                }),
                prisma.bot.update({
                    where: { id: bot.id },
                    data: {
                        totalBuys: { increment: 1 }
                    } as any
                })
            ]);

            await this.logInfo(bot.id, `[${bot.mode}] Bought ${amount.toFixed(6)} ${bot.symbol} at $${price.toFixed(2)} (Total: $${tradeValue.toFixed(2)})`);
        } catch (error: any) {
            await this.logError(bot.id, `Failed to record trade in database: ${error.message}`);
        }
    }

    private async sell(bot: any, position: any, price: number, reason: string = 'GRID_SELL') {
        const profit = (price - position.entryPrice) * position.amount;

        // Execute Real Trade
        let orderId: string | undefined;
        if (bot.mode === 'REAL' && this.exchange) {
            try {
                await this.logInfo(bot.id, `Executing REAL SELL order: ${position.amount} ${bot.symbol} at $${price} (${reason})`);

                const order = await this.exchange.createOrder(bot.symbol, 'market', 'sell', position.amount);
                orderId = order.id;

                await this.logInfo(bot.id, `Real sell order executed successfully. Order ID: ${orderId}`);
            } catch (error: any) {
                await this.logError(bot.id, `Real sell order failed: ${error.message}`);
                await this.createAlert(bot.id, 'ERROR', `Failed to execute sell order: ${error.message}`);
                return; // Don't record in DB if real order failed
            }
        }

        // Check daily loss limit if this is a loss
        if (profit < 0) {
            const canContinue = this.riskManager.recordLoss(profit);
            if (!canContinue) {
                await this.logError(bot.id, 'Daily loss limit reached - stopping bot');
                await this.createAlert(bot.id, 'DAILY_LOSS_LIMIT', `Daily loss limit reached. Bot stopped. Loss: $${this.riskManager.getDailyLoss().toFixed(2)}`);
                await this.stop();
                return;
            }
        }

        // Record in DB
        try {
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
                        profit: profit,
                        orderId: orderId
                    }
                }),
                prisma.bot.update({
                    where: { id: bot.id },
                    data: {
                        totalProfit: { increment: profit },
                        totalSells: { increment: 1 }
                    } as any
                })
            ]);

            await this.logInfo(bot.id, `[${bot.mode}] Sold ${position.amount.toFixed(6)} ${bot.symbol} at $${price.toFixed(2)} (${reason}) - Profit: $${profit.toFixed(2)}`);
        } catch (error: any) {
            await this.logError(bot.id, `Failed to record sell in database: ${error.message}`);
        }
    }

    // Logging helpers
    private async logInfo(botId: string, message: string, data?: any) {
        console.log(`[INFO] [${botId}] ${message}`);
        try {
            await (prisma as any).botLog.create({
                data: {
                    botId,
                    level: 'INFO',
                    message,
                    data: data ? JSON.parse(JSON.stringify(data)) : undefined
                }
            });
        } catch (error) {
            console.error('Failed to log to database:', error);
        }
    }

    private async logWarning(botId: string, message: string, data?: any) {
        console.warn(`[WARNING] [${botId}] ${message}`);
        try {
            await (prisma as any).botLog.create({
                data: {
                    botId,
                    level: 'WARNING',
                    message,
                    data: data ? JSON.parse(JSON.stringify(data)) : undefined
                }
            });
        } catch (error) {
            console.error('Failed to log to database:', error);
        }
    }

    private async logError(botId: string, message: string, data?: any) {
        console.error(`[ERROR] [${botId}] ${message}`);
        try {
            await (prisma as any).botLog.create({
                data: {
                    botId,
                    level: 'ERROR',
                    message,
                    data: data ? JSON.parse(JSON.stringify(data)) : undefined
                }
            });
        } catch (error) {
            console.error('Failed to log to database:', error);
        }
    }

    private async createAlert(botId: string, type: string, message: string) {
        try {
            await (prisma as any).alert.create({
                data: {
                    botId,
                    type,
                    message
                }
            });
        } catch (error) {
            console.error('Failed to create alert:', error);
        }
    }
}
