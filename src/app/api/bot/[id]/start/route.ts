import { NextResponse } from 'next/server';
import { botManager } from '@/lib/bot-manager';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: botId } = await params;
        await botManager.startBot(botId);
        return NextResponse.json({ success: true, message: 'Bot started' });
    } catch (error) {
        console.error('Error starting bot:', error);
        return NextResponse.json({ error: 'Failed to start bot' }, { status: 500 });
    }
}
