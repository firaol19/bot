import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BybitClient } from '@/lib/exchange/bybit-client';
import { decrypt } from '@/lib/encryption';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get the position
        const position = await prisma.position.findUnique({
            where: { id },
            include: { bot: true }
        });

        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        if (position.status !== 'OPEN') {
            return NextResponse.json({ error: 'Position already closed' }, { status: 400 });
        }

        // 1. Initialize Exchange
        const apiKey = position.bot.apiKey ? decrypt(position.bot.apiKey) : process.env.BYBIT_API_KEY;
        const apiSecret = position.bot.apiSecret ? decrypt(position.bot.apiSecret) : process.env.BYBIT_API_SECRET;
        const isTestnet = position.bot.mode === 'DEMO';

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Exchange keys not found' }, { status: 400 });
        }

        const exchange = new BybitClient({
            apiKey,
            apiSecret,
            testnet: isTestnet
        });

        // 2. Execute Market Sell
        let order;
        let executionPrice = 0;
        try {
            console.log(`[API] Manually closing position ${id}: Selling ${position.amount} ${position.symbol}`);
            order = await exchange.createOrder(position.symbol, 'market', 'sell', position.amount);

            // Try to get filled price
            if (order.average) {
                executionPrice = order.average;
            } else if (order.price) {
                executionPrice = order.price;
            } else {
                // Fallback to fetch ticker if order doesn't return price immediately
                const ticker = await exchange.getTicker(position.symbol);
                executionPrice = ticker.last || position.entryPrice;
            }
        } catch (error: any) {
            console.error('Exchange Order Failed:', error);
            return NextResponse.json({ error: `Exchange sell failed: ${error.message}` }, { status: 400 });
        }

        const profit = (executionPrice - position.entryPrice) * position.amount;

        // 3. Close the position in DB
        await prisma.$transaction([
            prisma.position.update({
                where: { id },
                data: {
                    status: 'CLOSED',
                    currentPrice: executionPrice,
                    pnl: profit
                }
            }),
            prisma.trade.create({
                data: {
                    botId: position.botId,
                    symbol: position.symbol,
                    side: 'SELL',
                    amount: position.amount,
                    price: executionPrice,
                    total: position.amount * executionPrice,
                    profit: profit,
                    orderId: order.id
                }
            }),
            prisma.bot.update({
                where: { id: position.botId },
                data: {
                    totalProfit: { increment: profit }
                }
            }),
            prisma.botLog.create({
                data: {
                    botId: position.botId,
                    level: 'INFO',
                    message: `Position manually closed at $${executionPrice.toFixed(2)}. Profit: $${profit.toFixed(2)}`
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            profit,
            message: 'Position closed successfully'
        });

    } catch (error: any) {
        console.error('Error closing position:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
