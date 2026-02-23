import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { botManager } from '@/lib/bot-manager';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: botId } = await params;

        // 1. Stop the bot if it's running
        try {
            await botManager.stopBot(botId);
            console.log(`[API] Bot ${botId} stopped before deletion`);
        } catch (error) {
            console.warn(`[API] Warning while stopping bot ${botId}:`, error);
        }

        // 2. Delete heavy records separately (Outside transaction to avoid long locks)
        try {
            await prisma.botLog.deleteMany({ where: { botId } });
            console.log(`[API] BotLogs for ${botId} cleared`);
        } catch (error: any) {
            console.warn(`[API] Warning deleting bot logs (non-critical):`, error.message);
        }

        try {
            if ((prisma as any).marketAnalysis) {
                await (prisma as any).marketAnalysis.deleteMany({ where: { botId } });
                console.log(`[API] MarketAnalysis for ${botId} cleared`);
            }
        } catch (error: any) {
            console.warn(`[API] Warning deleting market analysis (non-critical):`, error.message);
        }

        // 3. Delete core records in a smaller transaction for integrity
        try {
            await prisma.$transaction([
                prisma.alert.deleteMany({ where: { botId } }),
                prisma.trade.deleteMany({ where: { botId } }),
                prisma.position.deleteMany({ where: { botId } }),
                prisma.bot.delete({ where: { id: botId } }),
            ]);
            console.log(`[API] Bot ${botId} and core related data deleted successfully.`);
        } catch (error: any) {
            // Handle P2025: Record to delete does not exist (idempotency)
            if (error.code === 'P2025') {
                console.log(`[API] Bot ${botId} was already deleted or does not exist.`);
                return NextResponse.json({ success: true, message: 'Bot already deleted' });
            }
            throw error; // Re-throw other errors
        }

        return NextResponse.json({ success: true, message: 'Bot deleted successfully' });


    } catch (error: any) {
        console.error('Error deleting bot:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
