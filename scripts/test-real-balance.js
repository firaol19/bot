const ccxt = require('ccxt');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- Testing Real Account Balance ---');

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
                if (trimmedKey === 'BYBIT_API_KEY') apiKey = trimmedValue;
                if (trimmedKey === 'BYBIT_API_SECRET') apiSecret = trimmedValue;
            }
        });
    }

    if (!apiKey || !apiSecret) {
        console.error('ERROR: BYBIT_API_KEY or BYBIT_API_SECRET not found in .env');
        console.log('Please ensure your .env file contains these keys.');
        return;
    }

    console.log('Keys found. masked:', apiKey.substring(0, 4) + '...');

    // 2. Initialize CCXT
    const exchange = new ccxt.bybit({
        apiKey: apiKey,
        secret: apiSecret,
        options: {
            defaultType: 'swap',
            recvWindow: 20000,
        },
        timeout: 10000, // 10 second timeout
    });

    // 3. Fetch Balance
    try {
        console.log('Fetching balance from Bybit...');
        const balance = await exchange.fetchBalance();

        const usdt = balance['USDT'];
        if (usdt) {
            console.log('--- SUCCESS ---');
            console.log(`USDT Total: ${usdt.total}`);
            console.log(`USDT Free : ${usdt.free}`);
            console.log(`USDT Used : ${usdt.used}`);
        } else {
            console.log('USDT balance not found in response.');
            console.log('Available assets:', Object.keys(balance).filter(k => balance[k].total > 0).join(', '));
        }

    } catch (error) {
        console.error('Failed to fetch balance:', error.message);
    }
}

main();
