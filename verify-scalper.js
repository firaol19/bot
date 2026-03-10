require('ts-node').register();
const { ConfluenceStrategy } = require('./src/lib/trading/confluence-strategy');

async function runVerification() {
    console.log('--- Confluence Strategy Scalper Verification ---');
    const strategy = new ConfluenceStrategy();

    // Mock Exchange
    const mockExchange = {
        getKlines: async (symbol, tf, count) => {
            if (tf === '5m') {
                return Array(count).fill(0).map((_, i) => [Date.now(), 100, 101, 99, 100, 1000]);
            } else {
                return Array(count).fill(0).map((_, i) => [Date.now(), 100, 100.5, 99.5, 100, 500]);
            }
        },
        getFundingRate: async () => 0.0001,
        normalizeSymbol: (s) => s
    };

    console.log('\nTesting 5m Trend Detection (L1)...');
    let report = await strategy.getAnalysisReport('BTCUSDT', mockExchange);
    console.log(`Decision on Flat Price: ${report.decision} (Expected: WAITING_FOR_TREND)`);

    console.log('\nTesting Anti-Chasing Logic (L3)...');
    const bullishKlines5m = Array(100).fill(0).map((_, i) => [Date.now(), 100 + i, 101 + i, 99 + i, 100 + i, 1000]);

    const exhaustiveExchange = {
        getKlines: async (symbol, tf, count) => {
            if (tf === '5m') return bullishKlines5m.slice(-count);
            const k1m = Array(count - 1).fill(0).map((_, i) => [Date.now(), 110, 110.1, 109.9, 110, 500]);
            k1m.push([Date.now(), 110, 115, 110, 115, 2000]);
            return k1m;
        },
        getFundingRate: async () => 0.0001,
        normalizeSymbol: (s) => s
    };

    report = await strategy.getAnalysisReport('BTCUSDT', exhaustiveExchange);
    console.log(`Exhaustive Candle Decision: ${report.decision} (Expected: WAITING_FOR_ENTRY_SETUP)`);
    console.log(`Reason: ${report.reason}`);

    console.log('\nTesting EMA Pullback Entry (L3)...');
    const pullbackExchange = {
        getKlines: async (symbol, tf, count) => {
            if (tf === '5m') return bullishKlines5m.slice(-count);
            const k1m = Array(count).fill(0).map((_, i) => [Date.now(), 110, 110.1, 109.9, 110, 500]);
            k1m[k1m.length - 1] = [Date.now(), 111, 111.1, 110, 110.1, 500];
            return k1m;
        },
        getFundingRate: async () => 0.0001,
        normalizeSymbol: (s) => s
    };

    report = await strategy.getAnalysisReport('BTCUSDT', pullbackExchange);
    console.log(`Pullback Decision: ${report.decision} (Expected: SIGNAL_READY)`);
    if (report.decision === 'SIGNAL_READY') {
        console.log(`✅ Success: Found ${report.entrySetup} entry!`);
    } else {
        console.log(`❌ Failed: Decision was ${report.decision}. Reason: ${report.reason}`);
    }
}

runVerification().catch(console.error);
