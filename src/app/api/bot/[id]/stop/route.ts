import { NextResponse } from 'next/server';
import { botManager } from '@/lib/bot-manager';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: botId } = await params;
        await botManager.stopBot(botId);
        return NextResponse.json({ success: true, message: 'Bot stopped' });
    } catch (error) {
        console.error('Error stopping bot:', error);
        return NextResponse.json({ error: 'Failed to stop bot' }, { status: 500 });
    }
}
