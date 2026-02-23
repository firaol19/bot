
export class MeanReversionStrategy {
    calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50;
        let gains = 0;
        let losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return 100 - (100 / (1 + rs));
    }

    calculateStdDev(prices: number[]): number {
        const mean = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
        const variance = prices.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / prices.length;
        return Math.sqrt(variance);
    }


    async getAnalysisReport(symbol: string, exchange: any): Promise<any> {
        const report: any = {
            timestamp: new Date().toISOString(),
            decision: 'SCANNING',
            reason: '',
            indicators: {}
        };

        try {
            const klines = await exchange.getKlines(symbol, '15m', 50);
            const prices = klines.map((k: any) => k[4]);
            const currentPrice = prices[prices.length - 1];

            const rsi = this.calculateRSI(prices);

            const slice = prices.slice(-20);
            const sma = slice.reduce((a: number, b: number) => a + b, 0) / 20;
            const stdDev = this.calculateStdDev(slice);
            const upperBand = sma + (stdDev * 2);
            const lowerBand = sma - (stdDev * 2);

            report.indicators = { currentPrice, rsi, upperBand, lowerBand };

            // Mean reversion is for ranging markets. Check if bands are relative flat or narrow?
            // For now, focus on standard RSI + BB overextension
            if (rsi < 30 && currentPrice < lowerBand) {
                report.decision = 'SIGNAL_READY';
                report.trend = 'LONG';
                report.reason = 'Oversold condition (RSI < 30) outside lower Bollinger Band.';
                return report;
            }

            if (rsi > 70 && currentPrice > upperBand) {
                report.decision = 'SIGNAL_READY';
                report.trend = 'SHORT';
                report.reason = 'Overbought condition (RSI > 70) outside upper Bollinger Band.';
                return report;
            }

            report.decision = 'WAITING_FOR_REVERSION';
            report.reason = 'Market not in overextended state for mean reversion.';
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
