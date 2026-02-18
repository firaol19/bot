import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { botManager } from '@/lib/bot-manager';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

/**
 * Standalone API for Features Trading Bot (Linear/Futures)
 * Separated from Spot logic to avoid conflicts
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Get user from JWT token
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let userId;
        try {
            const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');
            const { payload } = await jwtVerify(token, secret);
            userId = (payload as any).userId;
        } catch (authError) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        const apiKey = process.env.BYBIT_API_KEY;
        const apiSecret = process.env.BYBIT_API_SECRET;

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Exchange API keys not found in environment' }, { status: 400 });
        }

        // CREATE BOT IN DATABASE (WITHOUT INITIAL BUY)
        // FEATURES bot waits for signal-based signal before opening position
        const bot = await prisma.bot.create({
            data: {
                name: body.name,
                userId: user.id,
                symbol: body.symbol,
                capital: body.capitalAllocation || body.capital,
                buyPercentage: body.buyPercentage || 100,
                sellPercentage: body.takeProfitPercentage, // Mapped to TP
                buyDrop: 0,
                mode: body.mode,
                type: 'FEATURES', // Explicitly FEATURES
                status: 'RUNNING',
                active: true,
                exchange: body.exchange || 'bybit',
                stopLossPercentage: body.stopLossPercentage,
                takeProfitPercentage: body.takeProfitPercentage,
                leverage: body.leverage || 1,
                maxPositions: 1, // Features strategy handles one trade at a time
                apiKey: encrypt(apiKey),
                apiSecret: encrypt(apiSecret),
                startedAt: new Date()
            } as any
        });

        // Register with Background Manager
        try {
            await botManager.startBot(bot.id);
            console.log(`[Features API] Bot ${bot.id} created and registered with manager.`);
        } catch (startError: any) {
            console.error(`[Features API] Warning: Bot created but manager registration failed:`, startError.message);
        }

        return NextResponse.json(bot);
    } catch (error: any) {
        console.error('CRITICAL: Error during Features bot creation:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
