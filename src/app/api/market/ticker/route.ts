import { NextResponse } from 'next/server';
import { BybitClient } from '@/lib/exchange/bybit-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC/USDT';

    try {
        const client = new BybitClient({ testnet: true });
        const ticker = await client.getTicker(symbol);

        return NextResponse.json({
            symbol: ticker.symbol,
            price: ticker.last,
            change24h: ticker.percentage,
            high24h: ticker.high,
            low24h: ticker.low,
            volume24h: ticker.baseVolume
        });
    } catch (error) {
        console.error('Error fetching ticker:', error);
        return NextResponse.json({ error: 'Failed to fetch ticker' }, { status: 500 });
    }
}
