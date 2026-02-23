
export class BreakoutStrategy {
    /**
     * Calculate Standard Deviation
     */
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
            const volumes = klines.map((k: any) => k[5]);
            const currentPrice = prices[prices.length - 1];
            const currentVolume = volumes[volumes.length - 1];

            // simple 20-period BB
            const period = 20;
            const slice = prices.slice(-period);
            const sma = slice.reduce((a: number, b: number) => a + b, 0) / period;
            const stdDev = this.calculateStdDev(slice);
            const upperBand = sma + (stdDev * 2);
            const lowerBand = sma - (stdDev * 2);

            // Volume confirmation: current volume > 1.5x average of last 10
            const avgVolume = volumes.slice(-11, -1).reduce((a: number, b: number) => a + b, 0) / 10;

            const volumeOK = currentVolume > avgVolume * 1.5;

            report.indicators = { currentPrice, upperBand, lowerBand, currentVolume, avgVolume };

            if (currentPrice > upperBand) {
                if (volumeOK) {
                    report.decision = 'SIGNAL_READY';
                    report.trend = 'LONG';
                    report.reason = 'Bullish breakout with high volume confirmation.';
                } else {
                    report.decision = 'WAITING_FOR_VOLUME';
                    report.reason = 'Price broke upper band, but volume confirmation is missing.';
                }
                return report;
            }

            if (currentPrice < lowerBand) {
                if (volumeOK) {
                    report.decision = 'SIGNAL_READY';
                    report.trend = 'SHORT';
                    report.reason = 'Bearish breakout with high volume confirmation.';
                } else {
                    report.decision = 'WAITING_FOR_VOLUME';
                    report.reason = 'Price broke lower band, but volume confirmation is missing.';
                }
                return report;
            }

            report.decision = 'WAITING_FOR_BREAKOUT';
            report.reason = 'Price is within Bollinger Bands.';
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
