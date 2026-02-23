
export class FundingRateStrategy {
    async getAnalysisReport(symbol: string, exchange: any): Promise<any> {
        const report: any = {
            timestamp: new Date().toISOString(),
            decision: 'SCANNING',
            reason: '',
            indicators: {}
        };

        try {
            const fundingRate = await exchange.getFundingRate(symbol);
            const openInterest = await exchange.getOpenInterest(symbol);

            const klines = await exchange.getKlines(symbol, '15m', 2);
            const lastPrice = klines[klines.length - 1][4];
            const prevPrice = klines[klines.length - 2][4];
            const priceChange = ((lastPrice - prevPrice) / prevPrice) * 100;

            report.indicators = { fundingRate, openInterest, priceChange };

            // Bias logic:
            // Extremely negative funding + price start to pump = Short Squeeze potential (BUY)
            if (fundingRate < -0.01 && priceChange > 0.1) {
                report.decision = 'SIGNAL_READY';
                report.trend = 'LONG';
                report.reason = `Extreme negative funding (${(fundingRate * 100).toFixed(4)}%) and positive price action. Potential short squeeze.`;
                return report;
            }

            // Extremely positive funding + price start to drop = Long Squeeze potential (SELL)
            if (fundingRate > 0.01 && priceChange < -0.1) {
                report.decision = 'SIGNAL_READY';
                report.trend = 'SHORT';
                report.reason = `Extreme positive funding (${(fundingRate * 100).toFixed(4)}%) and negative price action. Potential long squeeze.`;
                return report;
            }

            report.decision = 'WAITING_FOR_EXCESS';
            report.reason = 'Funding rates are neutral or not aligned with price movement indicators.';
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
