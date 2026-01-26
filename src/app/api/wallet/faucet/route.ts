import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { mode } = await request.json();

        if (mode !== 'DEMO') {
            return NextResponse.json({ error: 'Faucet only available in DEMO mode' }, { status: 400 });
        }

        // Initialize Client (Duplicate logic from balance route, ideally refactor into a helper)
        const botWithKeys = await prisma.bot.findFirst({
            where: { mode: 'DEMO', apiKey: { not: null } }
        });

        let client: BybitClient | null = null;

        if (botWithKeys && botWithKeys.apiKey && botWithKeys.apiSecret) {
            client = new BybitClient({
                apiKey: decrypt(botWithKeys.apiKey),
                apiSecret: decrypt(botWithKeys.apiSecret),
                testnet: true
            });
        } else if (process.env.BYBIT_TESTNET === 'true') {
            client = new BybitClient({
                apiKey: process.env.BYBIT_API_KEY,
                apiSecret: process.env.BYBIT_API_SECRET,
                testnet: true
            });
        }

        if (!client) {
            return NextResponse.json({ error: 'No Demo API keys found' }, { status: 404 });
        }

        await client.requestDemoFunds();
        return NextResponse.json({ success: true, message: 'Funds requested successfully' });

    } catch (error: any) {
        console.error('Faucet error:', error);
        return NextResponse.json({ error: error.message || 'Failed to request funds' }, { status: 500 });
    }
}
