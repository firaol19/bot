import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { botManager } from '@/lib/bot-manager';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Fetch bot with all related data
        const bot = await prisma.bot.findUnique({
            where: { id },
            include: {
                positions: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'desc' }
                },
                trades: {
                    orderBy: { timestamp: 'desc' },
                    take: 20
                }
            }
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        // Calculate statistics
        const allTrades = await prisma.trade.findMany({
            where: { botId: id }
        });

        const totalTrades = allTrades.length;
        const totalBuys = allTrades.filter(t => t.side === 'BUY').length;
        const totalSells = allTrades.filter(t => t.side === 'SELL').length;

        // Calculate win rate (trades with profit > 0)
        const profitableTrades = allTrades.filter(t => t.profit && t.profit > 0).length;
        const winRate = totalSells > 0 ? (profitableTrades / totalSells) * 100 : 0;

        // Calculate average profit
        const tradesWithProfit = allTrades.filter(t => t.profit !== null && t.profit !== undefined);
        const avgProfit = tradesWithProfit.length > 0
            ? tradesWithProfit.reduce((sum, t) => sum + (t.profit || 0), 0) / tradesWithProfit.length
            : 0;

        // Find best and worst trades
        const profitTrades = allTrades.filter(t => t.profit !== null);
        const bestTrade = profitTrades.length > 0
            ? Math.max(...profitTrades.map(t => t.profit || 0))
            : 0;
        const worstTrade = profitTrades.length > 0
            ? Math.min(...profitTrades.map(t => t.profit || 0))
            : 0;

        // Calculate running time
        let runningTime = bot.totalRuntime || 0;
        if (bot.status === 'RUNNING' && bot.startedAt) {
            const currentRuntime = Math.floor((Date.now() - bot.startedAt.getTime()) / 1000);
            runningTime += currentRuntime;
        }

        // Get current price
        let currentPrice = bot.lastPrice || 0;
        try {
            const priceRes = await fetch(`${request.url.split('/api')[0]}/api/market/ticker?symbol=${bot.symbol}`);
            const priceData = await priceRes.json();
            if (priceData.price) {
                currentPrice = priceData.price;
            }
        } catch (error) {
            console.error('Failed to fetch current price:', error);
        }

        // Check if bot is actually running in manager
        const isRunningInManager = botManager.isRunning(id);

        const stats = {
            totalTrades,
            totalBuys,
            totalSells,
            winRate: parseFloat(winRate.toFixed(2)),
            avgProfit: parseFloat(avgProfit.toFixed(2)),
            bestTrade: parseFloat(bestTrade.toFixed(2)),
            worstTrade: parseFloat(worstTrade.toFixed(2)),
            runningTime, // in seconds
            runningTimeFormatted: formatRuntime(runningTime),
            lastActivityAt: bot.lastActivityAt,
            currentPrice,
            isRunningInManager
        };

        return NextResponse.json({
            bot,
            stats
        });

    } catch (error: any) {
        console.error('Error fetching bot stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function formatRuntime(seconds: number): string {
    if (seconds === 0) return '0s';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && days === 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
}
