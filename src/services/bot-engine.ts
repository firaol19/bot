import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { GridStrategy } from '@/lib/trading/grid-strategy';
import { MultiTimeframeStrategy } from '@/lib/trading/multi-timeframe-strategy';
import { RiskManager } from '@/lib/trading/risk-manager';
import { decrypt } from '@/lib/encryption';
import { TrendFollowingStrategy } from '@/lib/trading/trend-following';
import { BreakoutStrategy } from '@/lib/trading/breakout-volume';
import { MeanReversionStrategy } from '@/lib/trading/mean-reversion';
import { FundingRateStrategy } from '@/lib/trading/funding-oi-bias';
import { SidewaysGridStrategy } from '@/lib/trading/sideways-grid';
import { ConfluenceStrategy } from '@/lib/trading/confluence-strategy';


export class BotEngine {
    private botId: string;
    private isRunning: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private analysisInterval: NodeJS.Timeout | null = null; // New: periodic analysis timer
    private exchange: BybitClient | null = null;
    private strategy: any; // Dynamic strategy instance


    private riskManager: RiskManager;
    private ws: any = null;
    private lastProcessedPrice: number = 0;
    private isExecuting: boolean = false;
    private isBuying: boolean = false; // Add buying lock
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
        // Initialize strategy based on bot type and strategy name
        if (bot.type === 'FEATURES') {
            switch (bot.strategyName) {
                case 'TrendFollowing':
                    this.strategy = new TrendFollowingStrategy();
                    break;
                case 'Breakout':
                    this.strategy = new BreakoutStrategy();
                    break;
                case 'MeanReversion':
                    this.strategy = new MeanReversionStrategy();
                    break;
                case 'FundingBias':
                    this.strategy = new FundingRateStrategy();
                    break;
                case 'SidewaysGrid':
                    this.strategy = new SidewaysGridStrategy();
                    break;
                case 'Confluence':
                    this.strategy = new ConfluenceStrategy();
                    break;
                default:
                    this.strategy = new MultiTimeframeStrategy();
            }
        } else {
            this.strategy = new GridStrategy();
        }


        // Initialize risk manager with bot configuration
        this.riskManager = new RiskManager({
            stopLossPercentage: bot.stopLossPercentage || undefined,
            takeProfitPercentage: bot.takeProfitPercentage || undefined,
            maxPositions: bot.maxPositions,
            maxDailyLoss: bot.maxDailyLoss || undefined,
            maxDailyTrades: bot.maxDailyTrades || undefined,
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

            // Synchronize positions with exchange
            await this.syncPositionsWithExchange();
        } catch (error: any) {
            console.error('[BotEngine] Heartbeat error:', error.message);
        }

        this.checkInterval = setTimeout(() => this.heartbeat(), 30000); // 30 second heartbeat
    }

    /**
     * Synchronize bot's open positions with Bybit
     * This handles cases where TP/SL was hit on exchange but bot didn't process it yet.
     */
    private async syncPositionsWithExchange() {
        if (!this.exchange) return;

        try {
            const bot = await prisma.bot.findUnique({
                where: { id: this.botId },
                include: { positions: { where: { status: 'OPEN' } } }
            }) as any;

            if (!bot || bot.positions.length === 0) return;

            // ✅ FIX: Skip exchange sync entirely for DEMO mode.
            // In DEMO mode, no real orders are placed on the exchange, so
            // querying for positions will always return empty, causing the bot
            // to immediately close freshly-opened local positions.
            if (bot.mode === 'DEMO') {
                // In DEMO mode, just update the PnL in DB using the last known price
                const lastPrice = bot.lastPrice || 0;
                if (lastPrice > 0) {
                    for (const position of bot.positions) {
                        const profit = position.side === 'SHORT'
                            ? (position.entryPrice - lastPrice) * position.amount
                            : (lastPrice - position.entryPrice) * position.amount;
                        await prisma.position.update({
                            where: { id: position.id },
                            data: { currentPrice: lastPrice, pnl: profit }
                        });
                    }
                }
                return;
            }

            // Fetch positions from exchange for this SYMBOL (REAL mode only)
            const exchangePositions = await this.exchange.getPositions(bot.symbol);

            // ✅ FIX: Grace period — do NOT sync a position that was JUST opened.
            // Wait at least 2 minutes after creation before treating it as "missing".
            const GRACE_PERIOD_MS = 2 * 60 * 1000;
            const now = Date.now();

            for (const position of bot.positions) {
                // Skip newly-opened positions during grace period
                const ageMs = now - new Date(position.createdAt).getTime();
                if (ageMs < GRACE_PERIOD_MS) {
                    await this.logInfo(bot.id, `Sync: Skipping position ${position.id} — within ${Math.round((GRACE_PERIOD_MS - ageMs) / 1000)}s grace period.`);
                    continue;
                }

                // Find matching position on exchange (same symbol and side)
                const exPos = exchangePositions.find((p: any) =>
                    p.symbol === this.exchange!.normalizeSymbol(bot.symbol) &&
                    p.side?.toUpperCase() === position.side?.toUpperCase()
                );

                const currentPrice = exPos?.markPrice || exPos?.lastPrice || bot.lastPrice || 0;

                // If position is missing on exchange or size is 0, it means it was CLOSED (TP/SL/Manual)
                const isStillOpen = exPos && parseFloat(exPos.contracts || exPos.size || 0) > 0;

                if (!isStillOpen) {
                    await this.logInfo(bot.id, `Sync: Position ${position.id} (${position.side}) found closed on exchange. Syncing DB state...`);
                    // Locally close the position without sending another close order to Bybit
                    await this.sell(bot, position, currentPrice, 'EXCHANGE_SYNC_CLOSED', true);
                } else {
                    // Update current price and PnL in DB for UI
                    const profit = position.side === 'SHORT'
                        ? (position.entryPrice - currentPrice) * position.amount
                        : (currentPrice - position.entryPrice) * position.amount;

                    await prisma.position.update({
                        where: { id: position.id },
                        data: {
                            currentPrice: currentPrice,
                            pnl: profit
                        }
                    });
                }
            }
        } catch (error: any) {
            console.error(`[BotEngine] Sync positions failed: ${error.message}`);
        }
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
                // Check strategy type for interval
                const isExistingStrategy = !bot.strategyName || bot.strategyName === 'MultiTimeframe';
                const isScalpingStrategy = bot.strategyName === 'Confluence';
                const interval = isScalpingStrategy ? 1 * 60 * 1000 : (isExistingStrategy ? 5 * 60 * 1000 : 10 * 60 * 1000);

                if (now - this.lastAnalysisTime >= interval) {
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
            // ✅ EXTRA SAFETY: Check if a position is ALREADY open on Bybit for this symbol
            // This prevents "open then close" loops if local DB is out of sync.
            try {
                const existingPositions = await this.exchange.getPositions(bot.symbol);
                const hasOpenPosition = existingPositions.some((p: any) =>
                    parseFloat(p.contracts || p.info?.size || 0) > 0
                );

                if (hasOpenPosition) {
                    await this.logInfo(bot.id, `Periodic Analysis: Skipping — a position is already open on Bybit for ${bot.symbol}.`);
                    // If DB thinks we have 0, but exchange has 1, let sync heartbeat fix it (or force sync now)
                    if (bot.positions.length === 0) {
                        await this.syncPositionsWithExchange();
                    }
                    return;
                }
            } catch (pError: any) {
                await this.logWarning(bot.id, `Pre-analysis position check failed: ${pError.message}`);
            }

            // Call strategy analysis report
            const report = await this.strategy.getAnalysisReport(bot.symbol, this.exchange);

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

            // 🚀 Re-entry Cooldown Fix for Periodic Analysis
            const now = Date.now();
            const lastClosedTrade = await prisma.trade.findFirst({
                where: { botId: bot.id },
                orderBy: { timestamp: 'desc' }
            });
            if (lastClosedTrade && now - lastClosedTrade.timestamp.getTime() < 5 * 60 * 1000) {
                return;
            }

            // ✅ FIX: If signal is ready, extract trend and execute a trade
            if (report.decision === 'SIGNAL_READY') {
                // Read trend directly from report (set in getAnalysisReport when SIGNAL_READY)
                const trend: 'LONG' | 'SHORT' = report.trend === 'SHORT' ? 'SHORT' : 'LONG';

                // Prevent immediate re-entry in the Exact Same Direction if we just closed one in the same trend recently
                if (lastClosedTrade && now - lastClosedTrade.timestamp.getTime() < 15 * 60 * 1000) {
                    // Wait at least 15 min before blindly jumping back into the exact same trend signal
                    if (lastClosedTrade.side === (trend === 'LONG' ? 'SELL' : 'BUY')) { // Opposite trade side closes the position
                        await this.logInfo(bot.id, `Skipping duplicate SIGNAL_READY for ${trend}. Cooldown active after recent close.`);
                        return;
                    }
                }

                await this.createAlert(bot.id, 'INFO', 'Trading signal detected! All timeframes aligned. Executing trade...');

                // Get current price from exchange
                const ticker = await this.exchange!.getKlines(bot.symbol, '1m', 2);
                const currentPrice: number = ticker?.[ticker.length - 1]?.[4] || 0;

                if (currentPrice <= 0) {
                    await this.logError(bot.id, 'Could not determine current price for SIGNAL_READY trade.');
                    return;
                }

                // Check position limit
                if (!this.riskManager.canOpenPosition(bot.positions?.length || 0)) {
                    await this.logWarning(bot.id, `Position limit reached. Cannot open new ${trend} position.`);
                    return;
                }

                // ✅ FIX: Concurrent buy protection
                if (this.isBuying) {
                    await this.logInfo(bot.id, 'Trade already in progress, skipping duplicate buy signal.');
                    return;
                }

                // Check daily trade limit
                if (!this.riskManager.canTradeToday()) {
                    await this.logWarning(bot.id, `Daily trade limit reached (${bot.maxDailyTrades}). Cannot open new ${trend} position.`);
                    return;
                }


                // Calculate trade cost
                let exchangeFreeBalance = bot.capital;
                try {
                    const balance = await this.exchange!.getBalance();
                    exchangeFreeBalance = balance.total?.USDT || balance.USDT?.free || bot.capital;
                } catch (e: any) {
                    await this.logWarning(bot.id, `Could not fetch balance, using configured capital: ${e.message}`);
                }

                let tradeCost = bot.capital;
                if (tradeCost > exchangeFreeBalance) {
                    if (exchangeFreeBalance >= 1.5) {
                        tradeCost = exchangeFreeBalance;
                    } else {
                        await this.logError(bot.id, `Insufficient balance ($${exchangeFreeBalance.toFixed(2)}) to open ${trend} position.`);
                        return;
                    }
                }

                await this.logInfo(bot.id, `🚀 SIGNAL_READY: Opening ${trend} position at $${currentPrice.toFixed(2)}`);
                await this.buy(bot, currentPrice, tradeCost, trend);
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

        // 1. Check Risk Management for all positions
        for (const position of bot.positions) {
            const riskSummary = this.riskManager.getPositionRiskSummary(
                { ...position, currentPrice },
                currentPrice
            );

            const isFeatures = bot.type === 'FEATURES';

            if (isFeatures) {
                // ✅ FIX: For FEATURES bots in DEMO mode, simulate SL/TP locally.
                // In REAL mode, Bybit handles SL/TP via exchange orders set at open.
                // In DEMO mode there are no real exchange orders, so we must check locally.
                if (bot.mode === 'DEMO') {
                    const isLong = position.side !== 'SHORT';

                    // Use stored SL/TP prices — these were computed and saved at position open time.
                    // Never recalculate here to avoid mismatch.
                    const slPrice: number | null = position.stopLossPrice ?? null;
                    const tpPrice: number | null = position.takeProfitPrice ?? null;

                    // Check Stop Loss
                    const slHit = slPrice !== null && (isLong ? currentPrice <= slPrice : currentPrice >= slPrice);
                    if (slHit) {
                        await this.logWarning(bot.id, `[DEMO] Stop loss triggered for position ${position.id} at ${currentPrice} (SL: ${slPrice?.toFixed(2)})`);
                        await this.createAlert(bot.id, 'STOP_LOSS', `[DEMO] Stop loss triggered at $${currentPrice.toFixed(2)}. Loss: $${riskSummary.pnl.toFixed(2)}`);
                        await this.sell(bot, position, currentPrice, 'STOP_LOSS', true);
                        continue;
                    }

                    // Check Take Profit
                    const tpHit = tpPrice !== null && (isLong ? currentPrice >= tpPrice : currentPrice <= tpPrice);
                    if (tpHit) {
                        await this.logInfo(bot.id, `[DEMO] Take profit triggered for position ${position.id} at ${currentPrice} (TP: ${tpPrice?.toFixed(2)})`);
                        await this.createAlert(bot.id, 'TAKE_PROFIT', `[DEMO] Take profit triggered at $${currentPrice.toFixed(2)}. Profit: $${riskSummary.pnl.toFixed(2)}`);
                        await this.sell(bot, position, currentPrice, 'TAKE_PROFIT', true);
                        continue;
                    }

                    // Update PnL in DB for UI
                    await prisma.position.update({
                        where: { id: position.id },
                        data: { currentPrice, pnl: riskSummary.pnl }
                    });
                }
                // In REAL mode: Bybit handles SL/TP — sync heartbeat detects closures via getPositions().

            } else {
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
                if ((this.strategy as GridStrategy).shouldSell(currentPrice, position.entryPrice, bot.sellPercentage)) {
                    await this.logInfo(bot.id, `Grid sell triggered for position ${position.id} at ${currentPrice} (Profit target reached)`);
                    await this.sell(bot, position, currentPrice, 'GRID_SELL');
                }
            }
        }

        // 2. Check Buy Conditions
        const isFirstTrade = bot.positions.length === 0;
        let shouldBuy = false;
        let detectedTrend: 'LONG' | 'SHORT' | 'NONE' = 'NONE';

        if (bot.type === 'FEATURES') {
            // 🚀 STRATEGY FIX: Features bots ONLY enter trades via the performPeriodicAnalysis loop.
            // This ensures they always use a fresh getAnalysisReport() and prevents duplicate/race entries.
            // We update the ticker price here but skip the signal detection.
            await prisma.bot.update({
                where: { id: bot.id },
                data: { lastPrice: currentPrice } as any
            });
            return;
        } else {
            // Original Grid Strategy Buy logic for Spot bots
            const lastPosition = bot.positions[bot.positions.length - 1];
            const lastEntry = lastPosition ? lastPosition.entryPrice : 0;
            shouldBuy = isFirstTrade || (this.strategy as GridStrategy).shouldBuy(currentPrice, lastEntry, bot.buyDrop);
            if (shouldBuy) detectedTrend = 'LONG';
        }

        if (shouldBuy) {
            // Check position limit
            if (!this.riskManager.canOpenPosition(bot.positions.length)) {
                await this.logWarning(bot.id, `Position limit reached (${bot.positions.length}/${bot.maxPositions})`);
                await this.createAlert(bot.id, 'POSITION_LIMIT', `Maximum positions (${bot.maxPositions}) reached`);
                return;
            }

            // ✅ FIX: Concurrent buy protection
            if (this.isBuying) {
                await this.logInfo(bot.id, 'Trade already in progress, skipping duplicate buy signal.');
                return;
            }

            // Check daily trade limit
            if (!this.riskManager.canTradeToday()) {
                await this.logWarning(bot.id, `Daily trade limit reached (${bot.maxDailyTrades})`);
                await this.createAlert(bot.id, 'TRADE_LIMIT', `Maximum daily trades (${bot.maxDailyTrades}) reached`);
                return;
            }


            // Verify we have enough balance on exchange (Safety Check)
            let exchangeFreeBalance = bot.capital;
            if (this.exchange) {
                try {
                    const balance = await this.exchange.getBalance();
                    if (bot.type === 'FEATURES') {
                        exchangeFreeBalance = balance.total?.USDT || balance.USDT?.free || 0;
                    } else if (balance['USDT']) {
                        exchangeFreeBalance = balance['USDT'].free || 0;
                    }

                    // Sync activity
                    await prisma.bot.update({
                        where: { id: bot.id },
                        data: { lastActivityAt: new Date() }
                    });
                } catch (error: any) {
                    await this.logError(bot.id, `Failed to verify exchange balance: ${error.message}`);
                }
            }

            // Calculate cost for this trade
            let tradeCost = bot.type === 'FEATURES' ? bot.capital : (bot.capital * (bot.buyPercentage / 100));

            // Adjust trade cost if available balance is lower
            if (tradeCost > exchangeFreeBalance) {
                if (exchangeFreeBalance >= 1.5) {
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

            const totalCapitalForBuy = bot.type === 'FEATURES' ? tradeCost : (tradeCost / (bot.buyPercentage / 100));
            await this.buy(bot, currentPrice, totalCapitalForBuy, detectedTrend as 'LONG' | 'SHORT');
        }

        // Update last seen price
        await prisma.bot.update({
            where: { id: bot.id },
            data: { lastPrice: currentPrice } as any
        });
    }

    private async buy(bot: any, price: number, totalCapital: number, trend: 'LONG' | 'SHORT' = 'LONG') {
        // Calculate amount, passing leverage for FEATURES bots
        const amount = bot.type === 'FEATURES'
            ? this.strategy.calculatePositionSize(totalCapital, bot.buyPercentage, price, bot.leverage)
            : this.strategy.calculatePositionSize(totalCapital, bot.buyPercentage, price);

        const tradeValue = amount * price;

        // Validate trade size
        const leverage = bot.type === 'FEATURES' ? (bot.leverage || 1) : 1;
        const validation = this.riskManager.validateTradeSize(tradeValue, totalCapital, leverage);
        if (!validation.valid) {
            await this.logWarning(bot.id, `Trade validation failed: ${validation.reason}`);
            return;
        }

        // ✅ FIX: Mandatory SL/TP for Features bots
        if (bot.type === 'FEATURES') {
            if (!bot.stopLossPercentage || bot.stopLossPercentage <= 0 || !bot.takeProfitPercentage || bot.takeProfitPercentage <= 0) {
                await this.logError(bot.id, 'Trade aborted: Stop Loss and Take Profit must be configured for Features bots.');
                await this.createAlert(bot.id, 'ERROR', 'Mandatory Stop Loss and Take Profit are missing. Please update bot settings.');
                return;
            }
        }

        this.isBuying = true; // Set lock
        try {

            // Execute Real Trade
            let orderId: string | undefined;
            let finalAmount = amount;

            if (this.exchange) {
                try {
                    // Check market limits (minQty, minNotional)
                    const limits = await this.exchange.getMarketLimits(bot.symbol);
                    if (limits) {
                        const minQty = limits.minQty || 0;
                        const minNotional = limits.minNotional || 0;

                        if (finalAmount < minQty) {
                            await this.logInfo(bot.id, `Order quantity (${finalAmount}) is below minimum (${minQty}). Adjusting to minimum.`);
                            finalAmount = minQty;
                        }

                        const estimatedNotional = finalAmount * price;
                        if (estimatedNotional < minNotional) {
                            const requiredAmount = minNotional / price;
                            await this.logInfo(bot.id, `Order value ($${estimatedNotional.toFixed(2)}) is below minimum notional ($${minNotional}). Adjusting quantity to ${requiredAmount.toFixed(6)}.`);
                            finalAmount = requiredAmount;
                        }

                        const finalValue = finalAmount * price;
                        if (finalValue > totalCapital * 1.5 && bot.type !== 'FEATURES') {
                            await this.logError(bot.id, `Adjusted trade value ($${finalValue.toFixed(2)}) exceeds allocation safety limit. Skipping trade.`);
                            return;
                        }
                    }

                    // Apply exchange precision
                    const precisionAmount = parseFloat(this.exchange.amountToPrecision(bot.symbol, finalAmount));

                    if (precisionAmount <= 0) {
                        await this.logError(bot.id, `Trade quantity ${precisionAmount} is invalid after precision adjustment.`);
                        return;
                    }

                    // Determine order side for Features (Buy for LONG, Sell for SHORT)
                    const side = bot.type === 'FEATURES'
                        ? (trend === 'LONG' ? 'buy' : 'sell')
                        : 'buy';

                    // Setup Bybit SL/TP params
                    const params: any = {};
                    if (bot.type === 'FEATURES' && (bot.stopLossPercentage || bot.takeProfitPercentage)) {
                        // Calculate absolute prices for SL/TP
                        if (bot.stopLossPercentage) {
                            const rawSl = trend === 'LONG'
                                ? (price * (1 - bot.stopLossPercentage / 100))
                                : (price * (1 + bot.stopLossPercentage / 100));
                            params.stopLoss = this.exchange.priceToPrecision(bot.symbol, rawSl);
                            params.slTriggerBy = 'MarkPrice';
                        }
                        if (bot.takeProfitPercentage) {
                            const rawTp = trend === 'LONG'
                                ? (price * (1 + bot.takeProfitPercentage / 100))
                                : (price * (1 - bot.takeProfitPercentage / 100));
                            params.takeProfit = this.exchange.priceToPrecision(bot.symbol, rawTp);
                            params.tpTriggerBy = 'MarkPrice';
                        }
                    }

                    if (bot.mode === 'REAL') {
                        await this.logInfo(bot.id, `Executing ${bot.mode} ${side.toUpperCase()} order: ${precisionAmount} ${bot.symbol} (Value: $${(precisionAmount * price).toFixed(2)})`);
                        const order = await this.exchange.createOrder(bot.symbol, 'market', side, precisionAmount, undefined, params);

                        if (!order || !order.id) {
                            throw new Error('Exchange returned successfully but order ID is missing.');
                        }

                        orderId = order.id;
                        await this.logInfo(bot.id, `Order executed successfully. Order ID: ${orderId}`);

                        // ✅ FIX 1: Confirm position actually opened on Bybit before recording locally.
                        // Poll up to 5 times (2s apart) for the position to appear (Total 10s wait).
                        let confirmedPosition: any = null;
                        const positionSide: 'LONG' | 'SHORT' = trend === 'LONG' ? 'LONG' : 'SHORT';

                        await this.logInfo(bot.id, `Waiting for position ${positionSide} to appear on Bybit for ${bot.symbol}...`);

                        for (let attempt = 1; attempt <= 5; attempt++) {
                            await new Promise(r => setTimeout(r, 2000));
                            try {
                                confirmedPosition = await this.exchange.getPosition(bot.symbol, positionSide);
                                if (confirmedPosition) {
                                    await this.logInfo(bot.id, `Attempt ${attempt}: Position confirmed via positions list.`);
                                    break;
                                }
                            } catch (e: any) {
                                await this.logWarning(bot.id, `Attempt ${attempt}: Could not verify position on exchange: ${e.message}`);
                            }
                        }

                        // ✅ FALLBACK: If position still not in list, check if the ORDER was filled.
                        // Sometimes Bybit's positions list lags longer than the order execution.
                        if (!confirmedPosition && orderId) {
                            try {
                                const orderStatus = await this.exchange.fetchOrder(bot.symbol, orderId);
                                if (orderStatus && (orderStatus.status === 'closed' || orderStatus.status === 'filled')) {
                                    await this.logInfo(bot.id, `Fallback: Order ${orderId} is FILLED. Proceeding even if position list is lagging.`);

                                    // Construct a "virtual" position from order data
                                    confirmedPosition = {
                                        entryPrice: orderStatus.average || orderStatus.price || price,
                                        contracts: orderStatus.filled || precisionAmount,
                                        side: positionSide,
                                        stopLossPrice: params.stopLoss,
                                        takeProfitPrice: params.takeProfit
                                    };
                                }
                            } catch (fetchError: any) {
                                await this.logWarning(bot.id, `Fallback check failed for order ${orderId}: ${fetchError.message}`);
                            }
                        }

                        if (!confirmedPosition) {
                            await this.logError(bot.id, `⚠️ Order ${orderId} was submitted but position was NOT confirmed open on Bybit after 5 attempts + fallback. Skipping local DB record to prevent ghost positions.`);
                            await this.createAlert(bot.id, 'ERROR', `Order placed but position not confirmed on exchange. Please check Bybit manually for order ${orderId}.`);
                            return; // Do NOT write to DB
                        }

                        // ✅ FIX 2: Use Bybit's actual fill price and SL/TP — NOT our estimated values.
                        const actualEntryPrice = parseFloat(confirmedPosition.entryPrice || price);
                        const actualAmount = parseFloat(confirmedPosition.contracts || confirmedPosition.size || confirmedPosition.amount || finalAmount);

                        // Extract SL/TP from confirmed position (might be string or number depending on CCXT/Bybit V5)
                        const rawSl = confirmedPosition.stopLossPrice || confirmedPosition.info?.stopLoss || '0';
                        const rawTp = confirmedPosition.takeProfitPrice || confirmedPosition.info?.takeProfit || '0';
                        const actualSlPrice = parseFloat(rawSl) || null;
                        const actualTpPrice = parseFloat(rawTp) || null;

                        await this.logInfo(bot.id, `✅ Position confirmed. Entry: $${actualEntryPrice}, SL: $${actualSlPrice ?? 'none'}, TP: $${actualTpPrice ?? 'none'}`);

                        finalAmount = actualAmount > 0 ? actualAmount : finalAmount;

                        // Record in DB with Bybit-confirmed values
                        try {
                            const finalTradeValue = finalAmount * actualEntryPrice;
                            await prisma.$transaction([
                                prisma.position.create({
                                    data: {
                                        botId: bot.id,
                                        symbol: bot.symbol,
                                        amount: finalAmount,
                                        entryPrice: actualEntryPrice,
                                        side: positionSide,
                                        status: 'OPEN',
                                        stopLossPrice: actualSlPrice,
                                        takeProfitPrice: actualTpPrice,
                                    } as any
                                }),
                                prisma.trade.create({
                                    data: {
                                        botId: bot.id,
                                        symbol: bot.symbol,
                                        side: positionSide === 'LONG' ? 'BUY' : 'SELL',
                                        amount: finalAmount,
                                        price: actualEntryPrice,
                                        total: finalTradeValue,
                                        orderId: orderId
                                    }
                                }),
                                prisma.bot.update({
                                    where: { id: bot.id },
                                    data: { totalBuys: { increment: 1 } } as any
                                })
                            ]);

                            this.riskManager.recordTrade();
                            await this.logInfo(bot.id, `[REAL] Opened ${trend} position: ${finalAmount.toFixed(6)} ${bot.symbol} at $${actualEntryPrice.toFixed(2)} (SL: $${actualSlPrice?.toFixed(2) ?? 'none'}, TP: $${actualTpPrice?.toFixed(2) ?? 'none'})`);
                        } catch (dbError: any) {
                            await this.logError(bot.id, `Failed to record confirmed trade in database: ${dbError.message}`);
                        }

                        return; // REAL mode: recording is done inline above, skip the generic block below
                    } else {
                        finalAmount = precisionAmount;
                    }
                } catch (error: any) {
                    const errorMsg = error.message || 'Unknown exchange error';
                    console.error(`[BotEngine] Trade failed: ${errorMsg}`);
                    await this.logError(bot.id, `Trade failed: ${errorMsg}`);
                    await this.createAlert(bot.id, 'ERROR', `Failed to execute buy order: ${errorMsg}`);
                    return;
                }
            }

            // Record in DB for DEMO mode (or bots with no exchange configured)
            try {
                const finalTradeValue = finalAmount * price;
                const positionSide = bot.type === 'FEATURES' ? (trend === 'LONG' ? 'LONG' : 'SHORT') : 'LONG';
                const isLong = trend === 'LONG';

                // Calculate local SL/TP prices for DEMO simulation
                const demoSlPrice = bot.stopLossPercentage
                    ? parseFloat(this.exchange?.priceToPrecision(bot.symbol, isLong
                        ? price * (1 - bot.stopLossPercentage / 100)
                        : price * (1 + bot.stopLossPercentage / 100)) || '0') || null
                    : null;
                const demoTpPrice = bot.takeProfitPercentage
                    ? parseFloat(this.exchange?.priceToPrecision(bot.symbol, isLong
                        ? price * (1 + bot.takeProfitPercentage / 100)
                        : price * (1 - bot.takeProfitPercentage / 100)) || '0') || null
                    : null;

                await prisma.$transaction([
                    prisma.position.create({
                        data: {
                            botId: bot.id,
                            symbol: bot.symbol,
                            amount: finalAmount,
                            entryPrice: price,
                            side: positionSide,
                            status: 'OPEN',
                            stopLossPrice: demoSlPrice,
                            takeProfitPrice: demoTpPrice,
                        } as any
                    }),
                    prisma.trade.create({
                        data: {
                            botId: bot.id,
                            symbol: bot.symbol,
                            side: bot.type === 'FEATURES' ? (trend === 'LONG' ? 'BUY' : 'SELL') : 'BUY',
                            amount: finalAmount,
                            price: price,
                            total: finalTradeValue,
                            orderId: orderId
                        }
                    }),
                    prisma.bot.update({
                        where: { id: bot.id },
                        data: { totalBuys: { increment: 1 } } as any
                    })
                ]);

                this.riskManager.recordTrade();
                await this.logInfo(bot.id, `[${bot.mode}] Opened ${trend} position: ${finalAmount.toFixed(6)} ${bot.symbol} at $${price.toFixed(2)} (SL: $${demoSlPrice?.toFixed(2) ?? 'none'}, TP: $${demoTpPrice?.toFixed(2) ?? 'none'})`);

            } catch (error: any) {
                await this.logError(bot.id, `Failed to record trade in database: ${error.message}`);
            }
        } finally {
            this.isBuying = false; // Release lock
        }
    }

    private async sell(bot: any, position: any, price: number, reason: string = 'GRID_SELL', localOnly: boolean = false) {
        // 🚀 HARDENING: For FEATURES bots, always force local-only exit.
        // The bot should ONLY open positions. Closures are handled by Bybit (SL/TP) or Manual UI action.
        // Sync heartbeat will detect the Bybit closure and call this with localOnly=true anyway.
        let finalLocalOnly = localOnly;
        if (bot.type === 'FEATURES') {
            finalLocalOnly = true;
        }

        const isLong = position.side !== 'SHORT';
        const profit = isLong
            ? (price - position.entryPrice) * position.amount
            : (position.entryPrice - price) * position.amount;

        // Execute Real Trade
        let orderId: string | undefined;
        if (!finalLocalOnly && bot.mode === 'REAL' && this.exchange) {
            try {
                // To close a LONG, we SELL. To close a SHORT, we BUY.
                const side = isLong ? 'sell' : 'buy';
                await this.logInfo(bot.id, `Executing REAL ${side.toUpperCase()} order to close ${position.side} position (${reason})`);

                const params: any = {};
                if (bot.type === 'FEATURES') {
                    params.reduceOnly = true;
                }

                const order = await this.exchange.createOrder(bot.symbol, 'market', side, position.amount, undefined, params);
                orderId = order.id;

                await this.logInfo(bot.id, `Real close order executed successfully. Order ID: ${orderId}`);
            } catch (error: any) {
                await this.logError(bot.id, `Real close order failed: ${error.message}`);
                await this.createAlert(bot.id, 'ERROR', `Failed to execute close order: ${error.message}`);
                return;
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
                        side: isLong ? 'SELL' : 'BUY',
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
