import ccxt from 'ccxt';
import { decrypt } from '../encryption';

interface BybitConfig {
    apiKey?: string;
    apiSecret?: string;
    testnet?: boolean;
    defaultType?: 'spot' | 'linear';
}

export class BybitClient {
    private client: any;

    constructor(config: BybitConfig = {}) {
        // ✅ CRITICAL FIX: Create the CCXT client instance FIRST
        this.client = new ccxt.bybit({
            apiKey: config.apiKey,
            secret: config.apiSecret,
            timeout: 60000, // 60s timeout
            enableRateLimit: true,
            options: {
                defaultType: config.defaultType || 'spot',
                recvWindow: 20000,
            },
        });

        // ✅ THEN configure URLs if needed (after client exists)
        if (config.testnet) {
            // NOTE: We do NOT call setSandboxMode(true) here.
            // Why? Because 'setSandboxMode' often implies Legacy Testnet rules/URLs.
            // The user is on "Demo Trading" (Unified) which lives on api-demo.bybit.com.
            // Authenticating here works best if CCXT thinks it's "Live" but we point it to the Demo URL.

            console.log(`[BybitClient] Initialized in Demo Trading Mode (Unified). Key Prefix: ${config.apiKey?.substring(0, 4)}***`);

            const demoUrl = 'https://api-demo.bybit.com';

            // Override all potential endpoints to use the Unified Demo server
            this.client.urls['api'] = {
                public: demoUrl,
                private: demoUrl,
                v5: demoUrl,
                spot: demoUrl,
                future: demoUrl,
                contract: demoUrl,
                inverse: demoUrl,
                option: demoUrl,
            };
        } else {
            console.log(`[BybitClient] Initialized in Real Trading Mode (Mainnet). Key Prefix: ${config.apiKey?.substring(0, 4)}***`);
        }
    }

    /**
     * Validate connection to Bybit API
     */
    async validateConnection(): Promise<boolean> {
        try {
            await this.client.fetchTime();
            return true;
        } catch (error: any) {
            console.error('[BybitClient] Connection validation failed:', error.message);
            return false;
        }
    }

    async getTicker(symbol: string) {
        return await this.client.fetchTicker(symbol);
    }

    async getBalance() {
        const isLinear = this.client.options['defaultType'] === 'linear';
        const params = isLinear ? { category: 'linear' } : { category: 'spot' };
        return await this.client.fetchBalance(params);
    }

    async createOrder(symbol: string, type: 'limit' | 'market', side: 'buy' | 'sell', amount: number, price?: number) {
        const isLinear = this.client.options['defaultType'] === 'linear';
        const category = isLinear ? 'linear' : 'spot';
        return await this.client.createOrder(symbol, type, side, amount, price, { category });
    }

    async getPositions(symbol?: string) {
        const isLinear = this.client.options['defaultType'] === 'linear';
        if (!isLinear) return [];

        const positions = await this.client.fetchPositions(symbol ? [symbol] : undefined, { category: 'linear' });
        return positions;
    }

    async getKlines(symbol: string, timeframe: string, limit?: number) {
        // ✅ FIX: In Bybit V5, market data needs category (spot, linear, inverse, option)
        // Defaulting to linear for futures if defaultType is linear
        const isLinear = this.client.options['defaultType'] === 'linear';
        const category = isLinear ? 'linear' : 'spot';

        // Format symbol for Bybit V5 if it has a slash
        const bybitSymbol = symbol.replace('/', '');

        try {
            // Use direct request or ohlcv depending on CCXT version stability for V5
            return await this.client.fetchOHLCV(symbol, timeframe, undefined, limit, {
                category: category
            });
        } catch (error: any) {
            console.error(`[BybitClient] Kline fetch failed for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Set leverage for a symbol (Linear Contract)
     */
    async setLeverage(symbol: string, leverage: number) {
        try {
            // Note: In Unified account, leverage is often set per category/symbol
            return await this.client.setLeverage(leverage, symbol);
        } catch (error: any) {
            // Some errors are acceptable (e.g., leverage already set)
            if (error.message.includes('not modified') || error.message.includes('leverage is same')) {
                return;
            }
            console.error('[BybitClient] Failed to set leverage:', error.message);
            throw error;
        }
    }

    amountToPrecision(symbol: string, amount: number): string {
        return this.client.amountToPrecision(symbol, amount);
    }

    priceToPrecision(symbol: string, price: number): string {
        return this.client.priceToPrecision(symbol, price);
    }

    /**
     * Subscribe to real-time ticker updates via WebSocket
     */
    async subscribeTicker(symbol: string, callback: (price: number) => void) {
        const WebSocket = require('ws');
        const isLinear = this.client.options['defaultType'] === 'linear';
        const typePath = isLinear ? 'linear' : 'spot';

        const baseUrl = this.client.urls['api'].public.includes('demo')
            ? `wss://stream-demo.bybit.com/v5/public/${typePath}`
            : `wss://stream.bybit.com/v5/public/${typePath}`;

        const ws = new WebSocket(baseUrl);
        const bybitSymbol = symbol.replace('/', '');

        ws.on('open', () => {
            console.log(`[BybitClient] WS Connected for ${symbol}`);
            ws.send(JSON.stringify({
                op: 'subscribe',
                args: [`tickers.${bybitSymbol}`]
            }));
        });

        ws.on('message', (data: any) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.topic === `tickers.${bybitSymbol}` && message.data) {
                    const price = parseFloat(message.data.lastPrice);
                    if (!isNaN(price)) {
                        callback(price);
                    }
                }
            } catch (error) {
                console.error('[BybitClient] WS Message Parse Error:', error);
            }
        });

        ws.on('error', (error: any) => {
            console.error(`[BybitClient] WS Error for ${symbol}:`, error.message);
        });

        ws.on('close', () => {
            console.log(`[BybitClient] WS Closed for ${symbol}, reconnecting in 5s...`);
            setTimeout(() => this.subscribeTicker(symbol, callback), 5000);
        });

        return ws;
    }

    async requestDemoFunds() {
        try {
            // Use generic request to bypass version-specific method naming issues
            // Endpoint: POST /v5/account/demo-apply-money
            // We use 'private' as the api type which is standard and mapped to api-demo
            return await this.client.request('v5/account/demo-apply-money', 'private', 'POST', {
                adjustType: 0 // 0: Add money
            });
        } catch (error: any) {
            console.error('Demo funds request failed:', error);
            throw new Error(`Failed to request demo funds: ${error.message}`);
        }
    }
}
