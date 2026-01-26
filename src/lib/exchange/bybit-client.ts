import ccxt from 'ccxt';
import { decrypt } from '../encryption';

interface BybitConfig {
    apiKey?: string;
    apiSecret?: string;
    testnet?: boolean;
}

export class BybitClient {
    private client: any;

    constructor(config: BybitConfig = {}) {
        const exchangeConfig: any = {
            apiKey: config.apiKey,
            secret: config.apiSecret,
            timeout: 30000, // 30s timeout
            enableRateLimit: true,
            options: {
                defaultType: 'swap', // Use perpetual swaps by default
                recvWindow: 20000, // Increase window to 20s to tolerate clock drift
            },
        };

        if (config.testnet) {
            // NOTE: We do NOT call setSandboxMode(true) here.
            // Why? Because 'setSandboxMode' often implies Legacy Testnet rules/URLs.
            // The user is on "Demo Trading" (Unified) which lives on api-demo.bybit.com.
            // Authenticating here works best if CCXT thinks it's "Live" but we point it to the Demo URL.

            console.log(`[BybitClient] Initialized in Demo Trading Mode (Unified). Key Prefix: ${config.apiKey?.substring(0, 4)}***`);

            const demoUrl = 'https://api-demo.bybit.com';

            // Override all potential endpoints to use the Unified Demo server
            // @ts-ignore
            this.client.urls['api']['public'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['private'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['v5'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['spot'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['future'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['contract'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['inverse'] = demoUrl;
            // @ts-ignore
            this.client.urls['api']['option'] = demoUrl;
        }

        // If we didn't set custom URLs (Mainnet), we don't need to do anything special.
        // If we did (Demo), 'urls' config handles it.
    }

    async getTicker(symbol: string) {
        return await this.client.fetchTicker(symbol);
    }

    async getBalance() {
        return await this.client.fetchBalance();
    }

    async createOrder(symbol: string, type: 'limit' | 'market', side: 'buy' | 'sell', amount: number, price?: number) {
        return await this.client.createOrder(symbol, type, side, amount, price);
    }

    async getPositions(symbol?: string) {
        const positions = await this.client.fetchPositions(symbol ? [symbol] : undefined);
        return positions;
    }

    async getKlines(symbol: string, timeframe: string, limit?: number) {
        return await this.client.fetchOHLCV(symbol, timeframe, undefined, limit);
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
