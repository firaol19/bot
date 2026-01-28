/**
 * Dollar Cost Averaging (DCA) Strategy
 * Buys at regular intervals regardless of price to average down the entry price
 */
export class DCAStrategy {
    /**
     * Check if it's time to buy based on interval
     * @param lastBuyTime - Timestamp of last buy
     * @param intervalMinutes - Minutes between buys
     */
    shouldBuyByTime(lastBuyTime: Date | null, intervalMinutes: number): boolean {
        if (!lastBuyTime) return true; // First buy

        const now = new Date();
        const timeDiff = now.getTime() - lastBuyTime.getTime();
        const minutesPassed = timeDiff / (1000 * 60);

        return minutesPassed >= intervalMinutes;
    }

    /**
     * Check if we should buy more based on price drop (DCA on dips)
     * @param currentPrice - Current market price
     * @param averageEntryPrice - Average entry price of all positions
     * @param dipPercentage - Percentage drop to trigger additional buy
     */
    shouldBuyOnDip(currentPrice: number, averageEntryPrice: number, dipPercentage: number): boolean {
        if (!averageEntryPrice) return true; // First buy

        const dropFromAverage = ((averageEntryPrice - currentPrice) / averageEntryPrice) * 100;
        return dropFromAverage >= dipPercentage;
    }

    /**
     * Calculate average entry price from positions
     */
    calculateAverageEntry(positions: Array<{ entryPrice: number; amount: number }>): number {
        if (positions.length === 0) return 0;

        const totalValue = positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.amount), 0);
        const totalAmount = positions.reduce((sum, pos) => sum + pos.amount, 0);

        return totalValue / totalAmount;
    }

    /**
     * Calculate position size for DCA
     * Can use fixed amount or percentage of capital
     */
    calculateDCASize(
        totalCapital: number,
        fixedAmount?: number,
        percentageOfCapital?: number,
        currentPrice?: number
    ): number {
        if (fixedAmount) {
            return fixedAmount / (currentPrice || 1);
        }

        if (percentageOfCapital && currentPrice) {
            const amountToSpend = totalCapital * (percentageOfCapital / 100);
            return amountToSpend / currentPrice;
        }

        return 0;
    }

    /**
     * Check if we should sell based on profit from average entry
     */
    shouldSellDCA(currentPrice: number, averageEntryPrice: number, profitPercentage: number): boolean {
        if (!averageEntryPrice) return false;

        const profitPercent = ((currentPrice - averageEntryPrice) / averageEntryPrice) * 100;
        return profitPercent >= profitPercentage;
    }

    /**
     * Calculate total profit/loss for all positions
     */
    calculateTotalPnL(positions: Array<{ entryPrice: number; amount: number }>, currentPrice: number): number {
        return positions.reduce((total, pos) => {
            return total + ((currentPrice - pos.entryPrice) * pos.amount);
        }, 0);
    }

    /**
     * Determine optimal DCA interval based on volatility
     * Higher volatility = shorter intervals
     */
    suggestInterval(volatilityPercent: number): number {
        if (volatilityPercent > 10) return 15; // 15 minutes for high volatility
        if (volatilityPercent > 5) return 60; // 1 hour for medium volatility
        if (volatilityPercent > 2) return 240; // 4 hours for low volatility
        return 1440; // 24 hours for very low volatility
    }
}
