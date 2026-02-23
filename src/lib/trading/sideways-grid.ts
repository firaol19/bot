
export class SidewaysGridStrategy {
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

            const slice = prices.slice(-20);
            const sma = slice.reduce((a: number, b: number) => a + b, 0) / 20;
            const stdDev = this.calculateStdDev(slice);

            const upperBand = sma + (stdDev * 2);
            const lowerBand = sma - (stdDev * 2);
            const bandWidth = (upperBand - lowerBand) / sma;

            report.indicators = { currentPrice, upperBand, lowerBand, bandWidth };

            // Sideways check: Bollinger Band Width should be "narrow"
            // This is relative, but usually < 0.02 (2%) for a sideways market in crypto
            if (bandWidth < 0.03) {
                // In a sideways grid, we BUY at lower band and SELL at upper band
                // So if price is near lower band, we signal ready for LONG
                if (currentPrice < lowerBand * 1.005) {
                    report.decision = 'SIGNAL_READY';
                    report.trend = 'LONG';
                    report.reason = 'Sideways market detected. Price near lower band.';
                    return report;
                }

                if (currentPrice > upperBand * 0.995) {
                    report.decision = 'SIGNAL_READY';
                    report.trend = 'SHORT';
                    report.reason = 'Sideways market detected. Price near upper band.';
                    return report;
                }

                report.decision = 'WAITING_FOR_EDGE';
                report.reason = 'Sideways market confirmed, but price is in middle of range.';
                return report;
            }

            report.decision = 'WAITING_FOR_SIDEWAYS';
            report.reason = `Market is too volatile or trending (BandWidth: ${(bandWidth * 100).toFixed(2)}% > 3%). Grid bot paused.`;
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
