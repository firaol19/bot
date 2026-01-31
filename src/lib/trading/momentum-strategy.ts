/**
 * Momentum/Trend Following Strategy
 * Uses moving averages and price momentum to identify trends
 */
export class MomentumStrategy {
    /**
     * Calculate Simple Moving Average (SMA)
     */
    calculateSMA(prices: number[], period: number): number {
        if (prices.length < period) return 0;

        const recentPrices = prices.slice(-period);
        const sum = recentPrices.reduce((a, b) => a + b, 0);
        return sum / period;
    }

    /**
     * Calculate Exponential Moving Average (EMA)
     */
    calculateEMA(prices: number[], period: number): number {
        if (prices.length < period) return 0;

        const multiplier = 2 / (period + 1);
        let ema = prices[0]; // Start with first price

        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * Check if price is in uptrend (bullish)
     * Price above both short and long moving averages
     */
    isUptrend(currentPrice: number, shortMA: number, longMA: number): boolean {
        return currentPrice > shortMA && shortMA > longMA;
    }

    /**
     * Check if price is in downtrend (bearish)
     */
    isDowntrend(currentPrice: number, shortMA: number, longMA: number): boolean {
        return currentPrice < shortMA && shortMA < longMA;
    }

    /**
     * Detect golden cross (bullish signal)
     * Short MA crosses above long MA
     */
    isGoldenCross(shortMA: number, longMA: number, prevShortMA: number, prevLongMA: number): boolean {
        return prevShortMA <= prevLongMA && shortMA > longMA;
    }

    /**
     * Detect death cross (bearish signal)
     * Short MA crosses below long MA
     */
    isDeathCross(shortMA: number, longMA: number, prevShortMA: number, prevLongMA: number): boolean {
        return prevShortMA >= prevLongMA && shortMA < longMA;
    }

    /**
     * Calculate RSI (Relative Strength Index)
     * Values: 0-100, >70 overbought, <30 oversold
     */
    calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50; // Neutral if not enough data

        const changes: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }

        const recentChanges = changes.slice(-period);
        const gains = recentChanges.filter(c => c > 0);
        const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));

        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return rsi;
    }

    /**
     * Calculate price momentum (rate of change)
     */
    calculateMomentum(currentPrice: number, pastPrice: number): number {
        return ((currentPrice - pastPrice) / pastPrice) * 100;
    }

    /**
     * Check if we should buy based on momentum
     */
    shouldBuyMomentum(
        currentPrice: number,
        shortMA: number,
        longMA: number,
        rsi: number
    ): boolean {
        // Buy conditions:
        // 1. Price in uptrend
        // 2. RSI not overbought (< 70)
        // 3. Price above short MA
        return this.isUptrend(currentPrice, shortMA, longMA) &&
            rsi < 70 &&
            currentPrice > shortMA;
    }

    /**
     * Check if we should sell based on momentum
     */
    shouldSellMomentum(
        currentPrice: number,
        shortMA: number,
        longMA: number,
        rsi: number,
        entryPrice: number,
        minProfitPercent: number = 0
    ): boolean {
        const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Sell conditions:
        // 1. Price below short MA (trend reversal)
        // 2. OR RSI overbought (> 70) and we have profit
        // 3. OR downtrend detected
        return currentPrice < shortMA ||
            (rsi > 70 && profitPercent > minProfitPercent) ||
            this.isDowntrend(currentPrice, shortMA, longMA);
    }

    /**
     * Calculate volatility (standard deviation)
     */
    calculateVolatility(prices: number[], period: number = 20): number {
        if (prices.length < period) return 0;

        const recentPrices = prices.slice(-period);
        const mean = recentPrices.reduce((a, b) => a + b, 0) / period;

        const squaredDiffs = recentPrices.map(price => Math.pow(price - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;

        return Math.sqrt(variance);
    }

    /**
     * Get trend strength (0-100)
     */
    getTrendStrength(currentPrice: number, shortMA: number, longMA: number): number {
        const shortDiff = Math.abs(currentPrice - shortMA) / currentPrice;
        const longDiff = Math.abs(shortMA - longMA) / shortMA;

        const strength = (shortDiff + longDiff) * 100;
        return Math.min(100, strength * 10); // Scale and cap at 100
    }

    /**
     * Suggest position size based on trend strength
     * Stronger trend = larger position
     */
    calculateMomentumPositionSize(
        totalCapital: number,
        basePercentage: number,
        trendStrength: number
    ): number {
        // Adjust position size based on trend strength
        // Strong trend (>70): use full allocation
        // Medium trend (40-70): use 70% allocation
        // Weak trend (<40): use 50% allocation
        let multiplier = 0.5;
        if (trendStrength > 70) multiplier = 1.0;
        else if (trendStrength > 40) multiplier = 0.7;

        return totalCapital * (basePercentage / 100) * multiplier;
    }
}
