import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db'; // We need to create this helper or use new PrismaClient there
import { botManager } from '@/lib/bot-manager';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: botId } = await params;
        // Get status from DB
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { positions: { where: { status: 'OPEN' } } }
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        return NextResponse.json(bot);
    } catch (error) {
        console.error('Error fetching bot status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
