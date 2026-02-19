const ccxt = require('ccxt');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- Testing Bybit Market Limits ---');

    // 1. Load .env manually
    const envPath = path.join(__dirname, '..', '.env');
    let apiKey = '';
    let apiSecret = '';

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                const trimmedKey = key.trim();
                const trimmedValue = value.trim();
                const cleanValue = trimmedValue.replace(/^["']|["']$/g, '');
                if (trimmedKey === 'BYBIT_API_KEY') apiKey = cleanValue;
                if (trimmedKey === 'BYBIT_API_SECRET') apiSecret = cleanValue;
            }
        });
    }

    const exchange = new ccxt.bybit({
        apiKey: apiKey,
        secret: apiSecret,
        options: {
            defaultType: 'linear', // Similar to FEATURES bot
        },
    });

    try {
        console.log('Loading markets...');
        await exchange.loadMarkets();

        const symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT'];

        for (const symbol of symbols) {
            console.log(`\nLimits for ${symbol}:`);
            const market = exchange.market(symbol);
            console.log(`- Min Qty: ${market.limits.amount.min}`);
            console.log(`- Min Notional: ${market.limits.cost ? market.limits.cost.min : 'N/A'}`);
            console.log(`- Precision (Amount): ${market.precision.amount}`);
        }

    } catch (error) {
        console.error('Failed:', error.message);
    }
}

main();
