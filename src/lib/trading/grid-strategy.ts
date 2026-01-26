export class GridStrategy {
    /**
     * Calculate next buy targets based on current price and settings
     */
    calculateBuyLevels(basePrice: number, dropPercentage: number, levels: number = 3) {
        const buyLevels = [];
        for (let i = 1; i <= levels; i++) {
            buyLevels.push(basePrice * (1 - (dropPercentage / 100) * i));
        }
        return buyLevels;
    }

    /**
     * Check if we should buy based on price drop
     */
    shouldBuy(currentPrice: number, lastEntryPrice: number, dropPercentage: number): boolean {
        if (!lastEntryPrice) return true; // First buy
        const triggerPrice = lastEntryPrice * (1 - dropPercentage / 100);
        return currentPrice <= triggerPrice;
    }

    /**
     * Check if we should sell a position based on profit percentage
     */
    shouldSell(currentPrice: number, entryPrice: number, profitPercentage: number): boolean {
        const targetPrice = entryPrice * (1 + profitPercentage / 100);
        return currentPrice >= targetPrice;
    }

    /**
     * Calculate position size based on capital and allocation percentage
     */
    calculatePositionSize(totalCapital: number, buyPercentage: number, currentPrice: number): number {
        const amountToSpend = totalCapital * (buyPercentage / 100);
        return amountToSpend / currentPrice;
    }
}
