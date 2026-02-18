import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { GridStrategy } from '@/lib/trading/grid-strategy';
import { MultiTimeframeStrategy } from '@/lib/trading/multi-timeframe-strategy';
import { RiskManager } from '@/lib/trading/risk-manager';
import { decrypt } from '@/lib/encryption';

export class BotEngine {
    private botId: string;
    private isRunning: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private analysisInterval: NodeJS.Timeout | null = null; // New: periodic analysis timer
    private exchange: BybitClient | null = null;
    private strategy: GridStrategy | MultiTimeframeStrategy;
    private riskManager: RiskManager;
    private ws: any = null;
    private lastProcessedPrice: number = 0;
    private isExecuting: boolean = false;
    private lastAnalysisTime: number = 0; // Track last analysis timestamp

    constructor(botId: string) {
        this.botId = botId;
        this.strategy = new GridStrategy(); // Default, will be updated in start()
        this.riskManager = new RiskManager();
    }

    async start() {
        if (this.isRunning) return;

        const bot = await prisma.bot.findUnique({ where: { id: this.botId } }) as any;
        if (!bot) throw new Error('Bot not found');

        // Initialize strategy based on bot type
        if (bot.type === 'FEATURES') {
            this.strategy = new MultiTimeframeStrategy();
        } else {
            this.strategy = new GridStrategy();
        }

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
                testnet: bot.mode === 'DEMO',
                defaultType: bot.type === 'FEATURES' ? 'linear' : 'spot'
            });

            // Validate connection
            const isConnected = await this.exchange.validateConnection();
            if (!isConnected) {
                await this.logError(bot.id, 'Failed to connect to exchange');
                throw new Error('Failed to connect to exchange');
            }

            // Set leverage if this is a FEATURES bot
            if (bot.type === 'FEATURES' && bot.leverage > 1) {
                try {
                    await this.exchange.setLeverage(bot.symbol, bot.leverage);
                } catch (e) {
                    // Log but continue
                }
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

        // Start periodic analysis for when no positions are open
        this.startPeriodicAnalysis();
    }

    async stop() {
        this.isRunning = false;
        if (this.checkInterval) clearTimeout(this.checkInterval);
        if (this.analysisInterval) clearTimeout(this.analysisInterval);
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

    private async startPeriodicAnalysis() {
        if (!this.isRunning) return;

        try {
            const bot = await prisma.bot.findUnique({
                where: { id: this.botId },
                include: { positions: { where: { status: 'OPEN' } } }
            }) as any;

            if (!bot || !bot.active) return;

            // Only perform analysis if no open positions (for Features bots)
            if (bot.type === 'FEATURES' && bot.positions.length === 0) {
                const now = Date.now();
                // Run analysis every 5 minutes
                if (now - this.lastAnalysisTime >= 5 * 60 * 1000) {
                    this.lastAnalysisTime = now;
                    await this.performPeriodicAnalysis(bot);
                }
            }
        } catch (error: any) {
            console.error('[BotEngine] Periodic analysis error:', error.message);
        }

        // Check again in 60 seconds
        this.analysisInterval = setTimeout(() => this.startPeriodicAnalysis(), 60000);
    }

    private async performPeriodicAnalysis(bot: any) {
        if (!this.exchange || bot.type !== 'FEATURES') return;

        try {
            const mfStrategy = this.strategy as MultiTimeframeStrategy;
            const report = await mfStrategy.getAnalysisReport(bot.symbol, this.exchange);

            // Store analysis in database (gracefully handle if table doesn't exist)
            try {
                await (prisma as any).marketAnalysis.create({
                    data: {
                        botId: bot.id,
                        decision: report.decision,
                        reason: report.reason,
                        data: report
                    }
                });
            } catch (dbError: any) {
                // If table doesn't exist yet, log to BotLog instead (silent fallback)
                if (dbError.code === 'P2021') {
                    await this.logAnalysis(bot.id, `MTF Analysis: ${report.decision}`, report);
                } else {
                    throw dbError;
                }
            }

            await this.logInfo(bot.id, `📊 Periodic Analysis Complete: ${report.decision}`);

            // If signal is ready, log detailed info
            if (report.decision === 'SIGNAL_READY') {
                await this.createAlert(bot.id, 'INFO', 'Trading signal detected! All timeframes aligned.');
            }
        } catch (error: any) {
            await this.logError(bot.id, `Failed to perform periodic analysis: ${error.message}`);
        }
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
            if (bot.type !== 'FEATURES' && (this.strategy as GridStrategy).shouldSell(currentPrice, position.entryPrice, bot.sellPercentage)) {
                await this.logInfo(bot.id, `Grid sell triggered for position ${position.id} at ${currentPrice} (Profit target reached)`);
                await this.sell(bot, position, currentPrice, 'GRID_SELL');
            }
        }

        // Check Buy Conditions
        const lastPosition = bot.positions[bot.positions.length - 1];
        const lastEntry = lastPosition ? lastPosition.entryPrice : 0;

        // Determine if we should buy
        const isFirstTrade = bot.positions.length === 0;
        let shouldBuy = false;

        if (bot.type === 'FEATURES') {
            const mfStrategy = this.strategy as MultiTimeframeStrategy;

            // 🚀 Stability Fix: Throttle strategy execution to every 60 seconds
            // This prevents overwhelming the exchange (especially demo servers) and rate limits
            const now = Date.now();
            const lastCheckTime = (this as any).lastStrategyCheckTime || 0;
            if (now - lastCheckTime < 60000) return; // Wait at least 60s between full strategy scans
            (this as any).lastStrategyCheckTime = now;

            // Periodic Analysis Logging (Every 5 minutes)
            const lastLogTime = (this as any).lastAnalysisLogTime || 0;
            if (now - lastLogTime > 5 * 60 * 1000) {
                (this as any).lastAnalysisLogTime = now;
                try {
                    const report = await mfStrategy.getAnalysisReport(bot.symbol, this.exchange);
                    await this.logAnalysis(bot.id, `MTF Analysis: ${report.decision}`, report);
                } catch (logError: any) {
                    console.error('[BotEngine] Failed to log periodic analysis:', logError.message);
                }
            }

            // 1. Check 15m Trend
            const klines15m = await this.exchange?.getKlines(bot.symbol, '15m', 100);
            const trend = mfStrategy.checkTrend(klines15m || []);

            if (trend !== 'NONE') {
                // 2. Check 5m Setup
                const klines5m = await this.exchange?.getKlines(bot.symbol, '5m', 100);
                const setupOk = mfStrategy.checkSetup(klines5m || [], trend);

                if (setupOk) {
                    // 3. Check 1m Entry
                    const klines1m = await this.exchange?.getKlines(bot.symbol, '1m', 50);
                    shouldBuy = mfStrategy.checkEntry(klines1m || [], trend);
                }
            }
        } else {
            // Original Grid Strategy Buy logic
            shouldBuy = isFirstTrade || (this.strategy as GridStrategy).shouldBuy(currentPrice, lastEntry, bot.buyDrop);
        }

        if (shouldBuy) {
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
                    // Unified / Linear balance check
                    if (bot.type === 'FEATURES') {
                        // For Linear, balance is often under 'USDT' in the 'total' or 'free' section of the contract wallet
                        exchangeFreeBalance = balance.total?.USDT || balance.USDT?.free || 0;
                    } else if (balance['USDT']) {
                        exchangeFreeBalance = balance['USDT'].free || 0;
                    }

                    // Sync capital for heart-beat
                    await prisma.bot.update({
                        where: { id: bot.id },
                        data: { lastActivityAt: new Date() }
                    });
                } catch (error: any) {
                    await this.logError(bot.id, `Failed to verify exchange balance: ${error.message}`);
                }
            }

            // Calculate cost for this trade
            // For Features, we use ALL capital. For Grid, we use buyPercentage.
            let tradeCost = bot.type === 'FEATURES' ? bot.capital : (bot.capital * (bot.buyPercentage / 100));

            // Adjust trade cost if available balance is lower
            if (tradeCost > exchangeFreeBalance) {
                if (exchangeFreeBalance >= 1.5) { // Increased min size to 1.5 to safely exceed Bybit's 1.10
                    await this.logWarning(bot.id, `Available balance ($${exchangeFreeBalance.toFixed(2)}) is less than target trade size ($${tradeCost.toFixed(2)}). Using remaining balance instead.`);
                    tradeCost = exchangeFreeBalance;
                } else {
                    await this.logError(bot.id, `Insufficient balance ($${exchangeFreeBalance.toFixed(2)}) to open new position.`);
                    return;
                }
            }

            if (isFirstTrade && bot.type !== 'FEATURES') {
                await this.logInfo(bot.id, `🚀 Initial buy triggered for ${bot.symbol} at market price`);
            }

            // Reverse calculate totalCapital for buy() logic or just update buy() calls
            const totalCapitalForBuy = bot.type === 'FEATURES' ? tradeCost : (tradeCost / (bot.buyPercentage / 100));
            await this.buy(bot, currentPrice, totalCapitalForBuy);
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

    private async logAnalysis(botId: string, message: string, data?: any) {
        try {
            await (prisma as any).botLog.create({
                data: {
                    botId,
                    level: 'ANALYSIS',
                    message,
                    data: data ? JSON.parse(JSON.stringify(data)) : undefined
                }
            });
        } catch (error) {
            console.error('Failed to log analysis to database:', error);
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
