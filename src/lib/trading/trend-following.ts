
export class TrendFollowingStrategy {
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
     * Check Market Structure (Higher Highs / Lower Lows)
     */
    checkStructure(klines: any[], trend: 'LONG' | 'SHORT'): boolean {
        // Simple structure check: last 3 highs/lows
        const highs = klines.map(k => k[2]).slice(-5);
        const lows = klines.map(k => k[3]).slice(-5);

        if (trend === 'LONG') {
            // Check if last high is higher than previous significant high
            return highs[4] > highs[2] && lows[4] > lows[2];
        } else {
            // Check if last low is lower than previous significant low
            return lows[4] < lows[2] && highs[4] < highs[2];
        }
    }

    async getAnalysisReport(symbol: string, exchange: any): Promise<any> {
        const report: any = {
            timestamp: new Date().toISOString(),
            decision: 'SCANNING',
            reason: '',
            indicators: {}
        };

        try {
            const klines = await exchange.getKlines(symbol, '15m', 250);
            const prices = klines.map((k: any) => k[4]);
            const currentPrice = prices[prices.length - 1];

            const ema50 = this.calculateEMA(prices, 50);
            const ema200 = this.calculateEMA(prices, 200);

            report.indicators = { currentPrice, ema50, ema200 };

            let trend: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
            if (ema50 > ema200 && currentPrice > ema50) {
                trend = 'LONG';
            } else if (ema50 < ema200 && currentPrice < ema50) {
                trend = 'SHORT';
            }

            if (trend === 'NONE') {
                report.decision = 'WAITING_FOR_TREND';
                report.reason = 'EMAs not aligned for trend following.';
                return report;
            }

            const structureOk = this.checkStructure(klines, trend);
            if (!structureOk) {
                report.decision = 'WAITING_FOR_STRUCTURE';
                report.reason = `Trend is ${trend} but market structure (HH/LL) is not confirmed.`;
                return report;
            }

            report.decision = 'SIGNAL_READY';
            report.trend = trend;
            report.reason = `Confirmed ${trend} trend with EMA alignment and structure.`;
            return report;

        } catch (error: any) {
            report.decision = 'ERROR';
            report.reason = error.message;
            return report;
        }
    }

    calculatePositionSize(capital: number, buyPercentage: number, currentPrice: number, leverage: number = 1): number {
        const totalPositionValue = capital * leverage;
        if (totalPositionValue <= 0 || currentPrice <= 0) return 0;
        return totalPositionValue / currentPrice;
    }
}
