import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

        // Get current price
        const tickerResponse = await fetch(`${request.url.split('/api')[0]}/api/market/ticker?symbol=${position.symbol}`);
        const tickerData = await tickerResponse.json();
        const currentPrice = tickerData.price || position.entryPrice;

        const profit = (currentPrice - position.entryPrice) * position.amount;

        // Close the position
        await prisma.$transaction([
            prisma.position.update({
                where: { id },
                data: {
                    status: 'CLOSED',
                    currentPrice: currentPrice,
                    pnl: profit
                }
            }),
            prisma.trade.create({
                data: {
                    botId: position.botId,
                    symbol: position.symbol,
                    side: 'SELL',
                    amount: position.amount,
                    price: currentPrice,
                    total: position.amount * currentPrice,
                    profit: profit
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
                    message: `Position manually closed at $${currentPrice.toFixed(2)}. Profit: $${profit.toFixed(2)}`
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
