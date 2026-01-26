import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client'; // Import the class directly
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'REAL' ? 'REAL' : 'DEMO';

    try {
        // Find the first user's bot to get API keys matching the requested mode
        // This logic assumes we want to find ANY valid key for the requested mode
        // For DEMO: Look for DEMO bot with keys, OR fall back to env TESTNET keys
        // For REAL: Look for REAL bot with keys, OR fall back to env MAINNET keys

        const botWithKeys = await prisma.bot.findFirst({
            where: {
                mode: mode,
                apiKey: { not: null }
            }
        });

        let client: BybitClient | null = null;

        if (botWithKeys && botWithKeys.apiKey && botWithKeys.apiSecret) {
            client = new BybitClient({
                apiKey: decrypt(botWithKeys.apiKey),
                apiSecret: decrypt(botWithKeys.apiSecret),
                testnet: mode === 'DEMO'
            });
        }

        // Fallback to Env vars if DB keys not found
        if (!client) {
            if (mode === 'REAL' && process.env.BYBIT_API_KEY) {
                client = new BybitClient({
                    apiKey: process.env.BYBIT_API_KEY,
                    apiSecret: process.env.BYBIT_API_SECRET,
                    testnet: false
                });
            } else if (mode === 'DEMO') {
                // For Demo, check if we have distinct Testnet keys in env?
                // Usually env might be configured for one or the other.
                // Let's assume standard BYBIT_API_KEY can be used if testnet=true
                // BUT strict safety: only use env keys if BYBIT_TESTNET matches mode
                const isEnvTestnet = process.env.BYBIT_TESTNET === 'true';
                if (isEnvTestnet) {
                    client = new BybitClient({
                        apiKey: process.env.BYBIT_API_KEY,
                        apiSecret: process.env.BYBIT_API_SECRET,
                        testnet: true
                    });
                }
            }
        }

        if (!client) {
            // No keys available for this mode
            return NextResponse.json({
                total: 0,
                free: 0,
                used: 0,
                info: `No API keys configured for ${mode} mode`
            });
        }

        const balance = await client.getBalance();

        // Normalize CCXT balance object
        // Usually total['USDT'], free['USDT'], used['USDT']
        const usdt = balance['USDT'] || { total: 0, free: 0, used: 0 };

        return NextResponse.json({
            total: usdt.total || 0,
            free: usdt.free || 0,
            used: usdt.used || 0
        });

    } catch (error: any) {
        console.error(`Error fetching ${mode} balance:`, error.message);

        // Handle Bybit specific errors
        if (error.message?.includes('10003')) {
            return NextResponse.json({ total: 0, free: 0, used: 0, info: 'Invalid API Key' });
        }

        return NextResponse.json({ total: 0, free: 0, used: 0, error: 'Failed' });
    }
}
