
/**
 * Confluence Strategy
 * 
 * A high-conviction intraday scalp strategy combining 4 signal layers:
 *   Layer 1 — 5m Macro Trend (EMA21 / EMA55) — HARD GATE
 *   Layer 2 — Funding Rate Bias — SOFT FILTER (blocks on contradiction only)
 *   Layer 3 — 1m Entry Trigger: Breakout OR Pullback — HARD GATE
 *   Layer 4 — 5m RSI Gate — SOFT GATE (blocks only at exhaustion extremes)
 * 
 * Target: 3-6 trades/day, ~70% win rate, 2:1 R:R (1.5% TP / 0.75% SL recommended)
 */

export class ConfluenceStrategy {

    // ── EMA ──────────────────────────────────────────────────────────────────
    private calculateEMA(prices: number[], period: number): number {
        if (prices.length < period) return 0;
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }
        return ema;
    }

    // ── RSI ──────────────────────────────────────────────────────────────────
    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return 100 - (100 / (1 + rs));
    }

    // ── Bollinger Bands ───────────────────────────────────────────────────────
    private calculateBB(prices: number[], period: number = 20, mult: number = 2) {
        const slice = prices.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return { sma, upper: sma + mult * stdDev, lower: sma - mult * stdDev };
    }

    // ── Market Structure ─────────────────────────────────────────────────────
    private checkStructure(klines: any[], trend: 'LONG' | 'SHORT'): boolean {
        const highs = klines.map((k: any) => k[2]).slice(-5);
        const lows = klines.map((k: any) => k[3]).slice(-5);
        if (trend === 'LONG') return highs[4] > highs[2] && lows[4] > lows[2];
        return lows[4] < lows[2] && highs[4] < highs[2];
    }

    async getAnalysisReport(symbol: string, exchange: any): Promise<any> {
        const report: any = {
            timestamp: new Date().toISOString(),
            decision: 'SCANNING',
            reason: '',
            indicators: {},
            // UI compatibility — populate dummy timeframes so MarketDataPanel renders
            timeframes: {
                '5m': { status: 'ANALYZING', indicators: {} },
                '1m': { status: 'ANALYZING', indicators: {} },
            }
        };

        try {
            // ═══════════════════════════════════════════════════════════════
            // LAYER 1 — 5m MACRO TREND  (HARD GATE)
            // ═══════════════════════════════════════════════════════════════
            const klines5m = await exchange.getKlines(symbol, '5m', 100);
            const prices5m = klines5m.map((k: any) => k[4]);
            const currentPrice = prices5m[prices5m.length - 1];

            const ema21 = this.calculateEMA(prices5m, 21);
            const ema55 = this.calculateEMA(prices5m, 55);
            const rsi5m = this.calculateRSI(prices5m, 14);
            const bb5m = this.calculateBB(prices5m, 20, 2);

            let trendBias: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
            if (ema21 > ema55 && currentPrice > ema21) trendBias = 'LONG';
            else if (ema21 < ema55 && currentPrice < ema21) trendBias = 'SHORT';

            report.indicators = { currentPrice, ema21, ema55, rsi5m, ...bb5m };
            report.timeframes['5m'] = {
                status: 'READY',
                indicators: { ema21, ema55, rsi: rsi5m, price: currentPrice }
            };

            if (trendBias === 'NONE') {
                // Try market structure on 5m before giving up — EMA may lag on choppy open
                const structureUp = this.checkStructure(klines5m, 'LONG');
                const structureDown = this.checkStructure(klines5m, 'SHORT');
                if (structureUp) trendBias = 'LONG';
                else if (structureDown) trendBias = 'SHORT';
            }

            if (trendBias === 'NONE') {
                report.decision = 'WAITING_FOR_TREND';
                report.reason = `5m EMAs not aligned (EMA21=${ema21.toFixed(2)}, EMA55=${ema55.toFixed(2)}).`;
                return report;
            }

            // ═══════════════════════════════════════════════════════════════
            // LAYER 2 — FUNDING RATE BIAS  (SOFT FILTER — blocks contradiction)
            // ═══════════════════════════════════════════════════════════════
            let fundingRate = 0;
            try {
                fundingRate = await exchange.getFundingRate(symbol);
                report.indicators.fundingRate = fundingRate;

                // BLOCK only if funding strongly contradicts our trend bias
                // Threshold: > 0.005% (half of the original strategy's 0.01%)
                const FUNDING_BLOCK_THRESHOLD = 0.005;
                const fundingContradicts =
                    (trendBias === 'LONG' && fundingRate > FUNDING_BLOCK_THRESHOLD) ||
                    (trendBias === 'SHORT' && fundingRate < -FUNDING_BLOCK_THRESHOLD);

                if (fundingContradicts) {
                    report.decision = 'WAITING_FOR_FUNDING_ALIGNMENT';
                    report.reason = `Trend bias is ${trendBias} but funding rate (${(fundingRate * 100).toFixed(4)}%) contradicts it — crowd is against us.`;
                    return report;
                }
            } catch (_) {
                // Funding fetch failed — treat as neutral, do not block
                report.indicators.fundingRate = 'N/A';
            }

            // ═══════════════════════════════════════════════════════════════
            // LAYER 3 — 1m ENTRY TRIGGER: BREAKOUT  or  PULLBACK  (HARD GATE)
            // ═══════════════════════════════════════════════════════════════
            const klines1m = await exchange.getKlines(symbol, '1m', 30);
            const prices1m = klines1m.map((k: any) => k[4]);
            const volumes1m = klines1m.map((k: any) => k[5]);
            const price1m = prices1m[prices1m.length - 1];
            const rsi1m = this.calculateRSI(prices1m, 14);
            const bb1m = this.calculateBB(prices1m, 20, 2);

            const avgVol1m = volumes1m.slice(-11, -1).reduce((a: number, b: number) => a + b, 0) / 10;
            const currentVol1m = volumes1m[volumes1m.length - 1];
            const volumeSpike = currentVol1m > avgVol1m * 1.4; // 1.4× spike threshold

            report.indicators = { ...report.indicators, rsi1m, bb1m_upper: bb1m.upper, bb1m_lower: bb1m.lower, volumeMultiple: currentVol1m / (avgVol1m || 1) };
            report.timeframes['1m'] = {
                status: 'READY',
                indicators: { rsi: rsi1m, upper: bb1m.upper, lower: bb1m.lower, price: price1m }
            };

            let entrySetup: 'BREAKOUT' | 'PULLBACK' | null = null;

            // Setup A — Breakout: price pierces BB in trend direction + volume confirmation
            if (trendBias === 'LONG' && price1m > bb1m.upper && volumeSpike) entrySetup = 'BREAKOUT';
            if (trendBias === 'SHORT' && price1m < bb1m.lower && volumeSpike) entrySetup = 'BREAKOUT';

            // Setup B — Pullback: price dipped into opposite BB zone (buy the dip / sell the rip)
            //   LONG pullback:  price near lower band AND RSI oversold on 1m (< 38)
            //   SHORT pullback: price near upper band AND RSI overbought on 1m (> 62)
            if (!entrySetup) {
                const nearLower = price1m <= bb1m.lower * 1.003; // within 0.3% of lower band
                const nearUpper = price1m >= bb1m.upper * 0.997; // within 0.3% of upper band
                if (trendBias === 'LONG' && nearLower && rsi1m < 38) entrySetup = 'PULLBACK';
                if (trendBias === 'SHORT' && nearUpper && rsi1m > 62) entrySetup = 'PULLBACK';
            }

            if (!entrySetup) {
                report.decision = 'WAITING_FOR_ENTRY_SETUP';
                report.reason = `Trend ${trendBias} confirmed, but no breakout or pullback entry on 1m (RSI=${rsi1m.toFixed(1)}, vol=${(currentVol1m / (avgVol1m || 1)).toFixed(2)}x).`;
                return report;
            }

            // ═══════════════════════════════════════════════════════════════
            // LAYER 4 — RSI EXHAUSTION GATE  (SOFT GATE)
            // Blocks only if 5m RSI is at extreme exhaustion — prevents entering at the top/bottom
            // ═══════════════════════════════════════════════════════════════
            const rsiExhausted =
                (trendBias === 'LONG' && rsi5m > 82) ||  // overbought extreme
                (trendBias === 'SHORT' && rsi5m < 18);     // oversold extreme

            if (rsiExhausted) {
                report.decision = 'WAITING_FOR_RSI_GATE';
                report.reason = `${trendBias} setup ready but 5m RSI (${rsi5m.toFixed(1)}) is at exhaustion — high reversal risk.`;
                return report;
            }

            // ═══════════════════════════════════════════════════════════════
            // ALL LAYERS PASSED  🎯
            // ═══════════════════════════════════════════════════════════════
            const fundingLabel = typeof fundingRate === 'number'
                ? `${(fundingRate * 100).toFixed(4)}%`
                : 'N/A';

            report.decision = 'SIGNAL_READY';
            report.trend = trendBias;
            report.entrySetup = entrySetup;
            report.reason = [
                `✅ L1 Trend: ${trendBias} (EMA21=${ema21.toFixed(2)} vs EMA55=${ema55.toFixed(2)})`,
                `✅ L2 Funding: ${fundingLabel} — aligned or neutral`,
                `✅ L3 Entry: ${entrySetup} on 1m (RSI=${rsi1m.toFixed(1)}, vol=${report.indicators.volumeMultiple.toFixed(2)}x)`,
                `✅ L4 RSI gate: 5m RSI ${rsi5m.toFixed(1)} — not exhausted`
            ].join(' | ');

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
