import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { botManager } from '@/lib/bot-manager';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

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

        // 1. Initial Exchange Connection & Pre-Trade Validation
        const apiKey = process.env.BYBIT_API_KEY;
        const apiSecret = process.env.BYBIT_API_SECRET;
        const isDemo = body.mode === 'DEMO';

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Exchange API keys not found in environment' }, { status: 400 });
        }

        const exchange = new BybitClient({
            apiKey,
            apiSecret,
            testnet: isDemo
        });

        // 2. Fetch Current Price & Calculate Amount
        let currentPrice = 0;
        try {
            const ticker = await exchange.getTicker(body.symbol);
            currentPrice = ticker.last || 0;
        } catch (error: any) {
            return NextResponse.json({ error: `Connection failed: ${error.message}` }, { status: 400 });
        }

        if (!currentPrice) {
            return NextResponse.json({ error: 'Could not fetch current market price' }, { status: 400 });
        }

        // Calculate amount (using allocation % of capital)
        const buyAmount = (body.capital * (body.buyPercentage / 100)) / currentPrice;
        const precisionAmount = parseFloat(exchange.amountToPrecision(body.symbol, buyAmount));
        const tradeValue = precisionAmount * currentPrice;

        // Ensure it meets exchange minimums
        if (tradeValue < 1.0) {
            return NextResponse.json({
                error: `Trade value too low ($${tradeValue.toFixed(2)}). Bybit requires at least $1.00 USDT. Please increase capital or position percentage.`
            }, { status: 400 });
        }

        // 3. EXECUTE INITIAL MARKET BUY (MANDATORY TO PROCEED)
        console.log(`[API] Executing Mandatory Initial Buy: ${precisionAmount} ${body.symbol} at ~${currentPrice}`);
        let order;
        try {
            order = await exchange.createOrder(body.symbol, 'market', 'buy', precisionAmount);
            console.log(`[API] Initial Buy Success! Order ID: ${order.id}`);
        } catch (error: any) {
            console.error(`[API] Initial Buy Failed. Bot will NOT be created.`, error.message);
            return NextResponse.json({
                error: `Initial trade failed: ${error.message}. The bot was not created.`
            }, { status: 400 });
        }

        // 4. ATOMIC DATABASE PERSISTENCE (Bot + Position + Trade)
        const bot = await prisma.$transaction(async (tx) => {
            const newBot = await tx.bot.create({
                data: {
                    name: body.name,
                    userId: user.id,
                    symbol: body.symbol,
                    capital: body.capital,
                    buyPercentage: body.buyPercentage,
                    sellPercentage: body.sellPercentage,
                    buyDrop: body.buyDrop,
                    mode: body.mode,
                    status: 'RUNNING',
                    exchange: body.exchange,
                    stopLossPercentage: body.stopLossPercentage,
                    takeProfitPercentage: body.takeProfitPercentage,
                    trailingStopPercent: body.trailingStopPercent,
                    maxPositions: body.maxPositions,
                    maxDailyLoss: body.maxDailyLoss,
                    apiKey: encrypt(apiKey),
                    apiSecret: encrypt(apiSecret),
                    totalBuys: 1,
                    startedAt: new Date()
                } as any
            });

            await tx.position.create({
                data: {
                    botId: newBot.id,
                    symbol: body.symbol,
                    amount: precisionAmount,
                    entryPrice: currentPrice,
                    status: 'OPEN'
                }
            });

            await tx.trade.create({
                data: {
                    botId: newBot.id,
                    symbol: body.symbol,
                    side: 'BUY',
                    amount: precisionAmount,
                    price: currentPrice,
                    total: tradeValue,
                    orderId: order.id
                }
            });

            return newBot;
        });

        // 5. Register with Background Manager
        try {
            await botManager.startBot(bot.id);
            console.log(`[API] Bot ${bot.id} registered with manager and resumed.`);
        } catch (startError: any) {
            console.error(`[API] Warning: Bot created but manager registration failed:`, startError.message);
        }

        return NextResponse.json(bot);
    } catch (error: any) {
        console.error('CRITICAL: Error during bot creation flow:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
