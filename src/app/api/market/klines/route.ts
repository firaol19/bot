import { NextResponse } from 'next/server';
import { BybitClient } from '@/lib/exchange/bybit-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC/USDT';
    const interval = searchParams.get('interval') || '60'; // 1 hour default (CCXT uses minutes usually)

    try {
        // We use a public client for market data (no keys needed usually, but our wrapper might require them in constructor)
        // We can instantiate with just testnet flag
        const client = new BybitClient({ testnet: true });

        // CCXT fetchOHLCV(symbol, timeframe, since, limit, params)
        // Map our interval to ccxt timeframe
        // '60' -> '1h', 'D' -> '1d' or let the client pass string
        // Let's assume frontend passes '1m', '5m', '1h', '1d'
        const timeframe = interval;

        const ohlcv = await client.getKlines(symbol, timeframe, 100); // 100 candles

        // Transform for Recharts: { time: string, open, high, low, close, volume }
        const formatted = ohlcv.map((candle: any) => ({
            time: new Date(candle[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: candle[0],
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5]
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Error fetching klines:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
