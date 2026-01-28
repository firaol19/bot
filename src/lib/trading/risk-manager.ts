export interface RiskConfig {
    stopLossPercentage?: number;
    takeProfitPercentage?: number;
    maxPositions?: number;
    maxDailyLoss?: number;
    trailingStopPercent?: number;
}

export interface Position {
    id: string;
    entryPrice: number;
    amount: number;
    currentPrice?: number;
    pnl?: number;
}

export class RiskManager {
    private config: RiskConfig;
    private dailyLoss: number = 0;
    private dailyLossResetTime: Date;

    constructor(config: RiskConfig = {}) {
        this.config = {
            stopLossPercentage: config.stopLossPercentage || 5, // Default 5% stop loss
            takeProfitPercentage: config.takeProfitPercentage || 10, // Default 10% take profit
            maxPositions: config.maxPositions || 10,
            maxDailyLoss: config.maxDailyLoss,
            trailingStopPercent: config.trailingStopPercent,
        };
        this.dailyLossResetTime = this.getNextDayStart();
    }

    /**
     * Calculate stop loss price for a position
     */
    calculateStopLoss(entryPrice: number): number | null {
        if (!this.config.stopLossPercentage) return null;
        return entryPrice * (1 - this.config.stopLossPercentage / 100);
    }

    /**
     * Calculate take profit price for a position
     */
    calculateTakeProfit(entryPrice: number): number | null {
        if (!this.config.takeProfitPercentage) return null;
        return entryPrice * (1 + this.config.takeProfitPercentage / 100);
    }

    /**
     * Calculate trailing stop price
     */
    calculateTrailingStop(highestPrice: number): number | null {
        if (!this.config.trailingStopPercent) return null;
        return highestPrice * (1 - this.config.trailingStopPercent / 100);
    }

    /**
     * Check if stop loss should trigger
     */
    shouldTriggerStopLoss(currentPrice: number, entryPrice: number): boolean {
        const stopLoss = this.calculateStopLoss(entryPrice);
        if (!stopLoss) return false;
        return currentPrice <= stopLoss;
    }

    /**
     * Check if take profit should trigger
     */
    shouldTriggerTakeProfit(currentPrice: number, entryPrice: number): boolean {
        const takeProfit = this.calculateTakeProfit(entryPrice);
        if (!takeProfit) return false;
        return currentPrice >= takeProfit;
    }

    /**
     * Check if trailing stop should trigger
     */
    shouldTriggerTrailingStop(currentPrice: number, highestPrice: number): boolean {
        const trailingStop = this.calculateTrailingStop(highestPrice);
        if (!trailingStop) return false;
        return currentPrice <= trailingStop;
    }

    /**
     * Validate if we can open a new position
     */
    canOpenPosition(currentPositions: number): boolean {
        if (!this.config.maxPositions) return true;
        return currentPositions < this.config.maxPositions;
    }

    /**
     * Validate if trade size is acceptable
     */
    validateTradeSize(tradeSize: number, availableBalance: number, minTradeSize: number = 1.1): {
        valid: boolean;
        reason?: string;
    } {
        if (tradeSize < minTradeSize) {
            return { valid: false, reason: `Trade size ($${tradeSize.toFixed(2)}) below minimum ($${minTradeSize})` };
        }

        if (tradeSize > availableBalance) {
            return { valid: false, reason: `Insufficient balance. Required: $${tradeSize.toFixed(2)}, Available: $${availableBalance.toFixed(2)}` };
        }

        return { valid: true };
    }

    /**
     * Record a loss and check daily loss limit
     */
    recordLoss(loss: number): boolean {
        // Reset daily loss if it's a new day
        if (new Date() >= this.dailyLossResetTime) {
            this.dailyLoss = 0;
            this.dailyLossResetTime = this.getNextDayStart();
        }

        this.dailyLoss += Math.abs(loss);

        // Check if we've exceeded daily loss limit
        if (this.config.maxDailyLoss && this.dailyLoss >= this.config.maxDailyLoss) {
            console.warn(`[RiskManager] Daily loss limit reached: $${this.dailyLoss.toFixed(2)} / $${this.config.maxDailyLoss}`);
            return false; // Cannot continue trading
        }

        return true; // Can continue trading
    }

    /**
     * Get current daily loss
     */
    getDailyLoss(): number {
        if (new Date() >= this.dailyLossResetTime) {
            this.dailyLoss = 0;
            this.dailyLossResetTime = this.getNextDayStart();
        }
        return this.dailyLoss;
    }

    /**
     * Calculate position P&L
     */
    calculatePnL(position: Position, currentPrice: number): number {
        return (currentPrice - position.entryPrice) * position.amount;
    }

    /**
     * Calculate position P&L percentage
     */
    calculatePnLPercentage(position: Position, currentPrice: number): number {
        return ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    }

    /**
     * Get risk summary for a position
     */
    getPositionRiskSummary(position: Position, currentPrice: number) {
        const pnl = this.calculatePnL(position, currentPrice);
        const pnlPercent = this.calculatePnLPercentage(position, currentPrice);
        const stopLoss = this.calculateStopLoss(position.entryPrice);
        const takeProfit = this.calculateTakeProfit(position.entryPrice);

        return {
            pnl,
            pnlPercent,
            stopLoss,
            takeProfit,
            shouldStopLoss: this.shouldTriggerStopLoss(currentPrice, position.entryPrice),
            shouldTakeProfit: this.shouldTriggerTakeProfit(currentPrice, position.entryPrice),
        };
    }

    /**
     * Update risk configuration
     */
    updateConfig(newConfig: Partial<RiskConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current risk configuration
     */
    getConfig(): RiskConfig {
        return { ...this.config };
    }

    /**
     * Get next day start time (midnight)
     */
    private getNextDayStart(): Date {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
    }
}
