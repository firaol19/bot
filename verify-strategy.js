const { MultiTimeframeStrategy } = require('./src/lib/trading/multi-timeframe-strategy');

async function runVerification() {
    console.log('--- MTF Strategy Verification ---');
    const strategy = new MultiTimeframeStrategy();

    const baseCandles = Array(50).fill(0).map((_, i) => [
        Date.now() - (50 - i) * 60000,
        100, 105, 95, 100, 1000
    ]);

    console.log('Test Case 1: Price 1% away from EMAs (Should be rejected now)');
    const candlesFar = [...baseCandles];
    candlesFar[candlesFar.length - 1] = [Date.now(), 101, 102, 100.5, 101, 500];
    const setupFar = strategy.checkSetup(candlesFar, 'LONG');
    console.log(`Setup Check (1% dist): ${setupFar ? 'FAILED (Allowed)' : 'PASSED (Rejected)'}`);

    console.log('Test Case 2: Price 0.3% away from EMAs (Should be accepted)');
    const candlesNear = [...baseCandles];
    candlesNear[candlesNear.length - 1] = [Date.now(), 100.3, 100.5, 100.1, 100.3, 500];
    const setupNear = strategy.checkSetup(candlesNear, 'LONG');
    console.log(`Setup Check (0.3% dist): ${setupNear ? 'PASSED (Allowed)' : 'FAILED (Rejected)'}`);

    console.log('Test Case 3: 70% body candle (Should be rejected now)');
    const weakConfirmation = [
        [Date.now() - 60000, 98, 100, 96, 97, 1000],
        [Date.now(), 97, 105, 95, 104, 1000]
    ];
    const entryWeak = strategy.checkEntry(weakConfirmation, 'LONG');
    console.log(`Entry Check (70% body): ${entryWeak ? 'FAILED (Allowed)' : 'PASSED (Rejected)'}`);

    console.log('Test Case 4: 90% body candle (Should be accepted)');
    const strongConfirmation = [
        [Date.now() - 60000, 98, 100, 96, 97, 1000],
        [Date.now(), 95.5, 105, 95, 104.5, 1000]
    ];
    const entryStrong = strategy.checkEntry(strongConfirmation, 'LONG');
    console.log(`Entry Check (90% body): ${entryStrong ? 'PASSED (Allowed)' : 'FAILED (Rejected)'}`);
}

runVerification().catch(console.error);
