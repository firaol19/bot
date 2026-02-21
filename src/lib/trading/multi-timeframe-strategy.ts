/**
 * Multi-Timeframe Analysis Strategy
 * 15m Trend, 5m Setup, 1m Entry
 */
export class MultiTimeframeStrategy {
    /**
     * Calculate Exponential Moving Average (EMA)
     */
    calculateEMA(prices: number[], period: number): number {
        if (prices.length < period) return 0;

        const multiplier = 2 / (period + 1);
        let ema = prices[0];

        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * TREND RULE (15m):
     * - LONG only if EMA20 is above EMA50 and price is above both
     * - SHORT only if EMA20 is below EMA50 and price is below both
     * - If EMAs are flat or crossing → NO TRADE
     */
    checkTrend(candles: any[]): 'LONG' | 'SHORT' | 'NONE' {
        if (candles.length < 50) return 'NONE';

        const prices = candles.map(c => c[4]); // Closing prices
        const currentPrice = prices[prices.length - 1];
        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);

        // Long only if EMA20 is above EMA50 and price is above both
        if (ema20 > ema50 && currentPrice > ema20) {
            return 'LONG';
        }

        // Short only if EMA20 is below EMA50 and price is below both
        if (ema20 < ema50 && currentPrice < ema20) {
            return 'SHORT';
        }

        return 'NONE';
    }

    /**
     * SETUP RULE (5m):
     * - Price must pull back toward EMA20 or EMA50
     * - Pullback candles must be small and weak
     * - Volume should decrease during pullback
     * - If price is far from EMAs → NO TRADE
     */
    checkSetup(candles: any[], trend: 'LONG' | 'SHORT'): boolean {
        if (candles.length < 50) return false;

        const prices = candles.map(c => c[4]);
        const volumes = candles.map(c => c[5]);
        const currentPrice = prices[prices.length - 1];
        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);

        // Distance check: price must be near EMAs (relaxed to 0.5% threshold)
        const dist20 = Math.abs(currentPrice - ema20) / ema20;
        const dist50 = Math.abs(currentPrice - ema50) / ema50;

        if (dist20 > 0.005 && dist50 > 0.005) return false; // Too far (0.5% threshold)

        // Volume check: volume should be decreasing or lower than average during pullback
        const avgVolume = volumes.slice(-10, -1).reduce((a, b) => a + b, 0) / 9;
        const currentVolume = volumes[volumes.length - 1];

        if (currentVolume > avgVolume * 1.2) return false; // Volume spike during pullback is bad

        // Pullback check (we simplify "small and weak" to candles with small body/wick relative to ATR or just small size)
        const lastCandle = candles[candles.length - 1];
        const bodySize = Math.abs(lastCandle[1] - lastCandle[4]);
        const rangeSize = lastCandle[2] - lastCandle[3];

        if (bodySize > rangeSize * 0.7) return false; // Body too large relative to range (too strong)

        return true;
    }

    /**
     * ENTRY RULE (1m):
     * - Enter only after confirmation candle:
     *   - Bullish engulfing or strong bullish close for LONG
     *   - Bearish engulfing or strong bearish close for SHORT
     */
    checkEntry(candles: any[], trend: 'LONG' | 'SHORT'): boolean {
        if (candles.length < 2) return false;

        const current = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        // Format: [timestamp, open, high, low, close, volume]
        const currOpen = current[1];
        const currClose = current[4];
        const prevOpen = previous[1];
        const prevClose = previous[4];

        if (trend === 'LONG') {
            // Bullish Engulfing
            const isEngulfing = currClose > prevOpen && currOpen < prevClose && currClose > currOpen;
            // Strong bullish close
            const isStrongClose = currClose > currOpen && (currClose - currOpen) > (current[2] - current[3]) * 0.6;

            return isEngulfing || isStrongClose;
        } else if (trend === 'SHORT') {
            // Bearish Engulfing
            const isEngulfing = currClose < prevOpen && currOpen > prevClose && currClose < currOpen;
            // Strong bearish close
            const isStrongClose = currClose < currOpen && (currOpen - currClose) > (current[2] - current[3]) * 0.6;

            return isEngulfing || isStrongClose;
        }

        return false;
    }

    /**
     * Get full analysis report for logging and UI
     */
    async getAnalysisReport(symbol: string, exchange: any): Promise<any> {
        const report: any = {
            timestamp: new Date().toISOString(),
            timeframes: {
                '15m': { status: 'PENDING', detail: '' },
                '5m': { status: 'PENDING', detail: '' },
                '1m': { status: 'PENDING', detail: '' }
            },
            decision: 'SCANNING',
            reason: ''
        };

        try {
            // 1. 15m Trend
            const klines15m = await exchange.getKlines(symbol, '15m', 100);
            const trend = this.checkTrend(klines15m);
            const prices15m = klines15m.map((c: any) => c[4]);
            const ema20_15m = this.calculateEMA(prices15m, 20);
            const ema50_15m = this.calculateEMA(prices15m, 50);

            report.timeframes['15m'].status = trend !== 'NONE' ? 'READY' : 'WAITING';
            report.timeframes['15m'].detail = trend !== 'NONE' ? `Trend: ${trend}` : 'No clear trend (EMA 20/50 flat)';
            report.timeframes['15m'].indicators = {
                price: prices15m[prices15m.length - 1],
                ema20: ema20_15m,
                ema50: ema50_15m
            };

            if (trend === 'NONE') {
                report.decision = 'WAITING_FOR_TREND';
                const trendDesc = ema20_15m > ema50_15m ? 'EMA20 > EMA50 (Bullish bias)' : (ema20_15m < ema50_15m ? 'EMA20 < EMA50 (Bearish bias)' : 'EMAs flat');
                report.reason = `15m Rule: ${trendDesc}, but price ($${prices15m[prices15m.length - 1].toFixed(2)}) is not yet aligned with the EMAs.`;
                return report;
            }

            // 2. 5m Setup
            const klines5m = await exchange.getKlines(symbol, '5m', 100);
            const setupOk = this.checkSetup(klines5m, trend);
            const prices5m = klines5m.map((c: any) => c[4]);
            const volumes5m = klines5m.map((c: any) => c[5]);
            const ema20_5m = this.calculateEMA(prices5m, 20);
            const ema50_5m = this.calculateEMA(prices5m, 50);
            const avgVol5m = volumes5m.slice(-10, -1).reduce((a: number, b: number) => a + b, 0) / 9;

            report.timeframes['5m'].status = setupOk ? 'READY' : 'WAITING';
            report.timeframes['5m'].detail = setupOk ? 'Pullback detected near EMA' : 'Waiting for pullback to EMA20/50';
            report.timeframes['5m'].indicators = {
                price: prices5m[prices5m.length - 1],
                ema20: ema20_5m,
                ema50: ema50_5m,
                volume: volumes5m[volumes5m.length - 1],
                avgVolume: avgVol5m
            };

            if (!setupOk) {
                report.decision = 'WAITING_FOR_SETUP';
                const dist20 = (Math.abs(prices5m[prices5m.length - 1] - ema20_5m) / ema20_5m * 100).toFixed(2);
                const dist50 = (Math.abs(prices5m[prices5m.length - 1] - ema50_5m) / ema50_5m * 100).toFixed(2);

                if (parseFloat(dist20) > 0.5 && parseFloat(dist50) > 0.5) {
                    report.reason = `5m Rule: Price is too far from EMAs (Dist: ${dist20}% / ${dist50}%). Waiting for pullback to within 0.5%.`;
                } else if (volumes5m[volumes5m.length - 1] > avgVol5m * 1.2) {
                    report.reason = `5m Rule: Volume spike detected (${volumes5m[volumes5m.length - 1].toFixed(2)} > ${avgVol5m.toFixed(2)} avg). Waiting for volume to decrease.`;
                } else {
                    report.reason = '5m Rule: Waiting for candle confirmation or weak pullback signal.';
                }
                return report;
            }

            // 3. 1m Entry
            const klines1m = await exchange.getKlines(symbol, '1m', 10);
            const entryOk = this.checkEntry(klines1m, trend);
            const lastCandle = klines1m[klines1m.length - 1];

            report.timeframes['1m'].status = entryOk ? 'READY' : 'WAITING';
            report.timeframes['1m'].detail = entryOk ? 'Confirmation candle found' : 'Waiting for engulfing/strong close';
            report.timeframes['1m'].indicators = {
                open: lastCandle[1],
                close: lastCandle[4],
                high: lastCandle[2],
                low: lastCandle[3]
            };

            if (!entryOk) {
                report.decision = 'MONITORING_ENTRY';
                const last = klines1m[klines1m.length - 1];
                const type = last[4] > last[1] ? 'Bullish' : 'Bearish';
                report.reason = `1m Rule: Setup confirmed. Waiting for ${trend === 'LONG' ? 'Bullish' : 'Bearish'} Engulfing or strong close. Current candle: ${type}.`;
                return report;
            }

            report.decision = 'SIGNAL_READY';
            report.reason = 'All signals aligned. Ready to execute trade.';
            return report;
        } catch (error: any) {
            report.decision = 'ERROR';
            report.reason = error.message;
            return report;
        }
    }

    /**
     * Calculate Position Size (Use ALL allocated capital * leverage)
     */
    calculatePositionSize(capital: number, stopLossPercent: number, currentPrice: number, leverage: number = 1): number {
        // User requested to use ALL capital
        const totalPositionValue = capital * leverage;

        // Safety check: ensure we don't return 0 or negative
        if (totalPositionValue <= 0 || currentPrice <= 0) return 0;

        return totalPositionValue / currentPrice;
    }
}
