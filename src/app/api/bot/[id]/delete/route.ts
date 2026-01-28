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

        // 2. Delete related records in a transaction
        // Prisma will handle cascading if configured, but let's be explicit if not
        await prisma.$transaction([
            prisma.botLog.deleteMany({ where: { botId } }),
            prisma.alert.deleteMany({ where: { botId } }),
            prisma.trade.deleteMany({ where: { botId } }),
            prisma.position.deleteMany({ where: { botId } }),
            prisma.bot.delete({ where: { id: botId } }),
        ]);

        console.log(`[API] Bot ${botId} and all related data deleted successfully.`);

        return NextResponse.json({ success: true, message: 'Bot deleted successfully' });

    } catch (error: any) {
        console.error('Error deleting bot:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
