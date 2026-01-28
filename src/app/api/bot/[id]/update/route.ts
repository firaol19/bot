import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Prepare update data
        const updateData: any = {
            name: body.name,
            capital: body.capital,
            buyPercentage: body.buyPercentage,
            sellPercentage: body.sellPercentage,
            buyDrop: body.buyDrop,
            mode: body.mode,
            stopLossPercentage: body.stopLossPercentage,
            takeProfitPercentage: body.takeProfitPercentage,
            trailingStopPercent: body.trailingStopPercent,
            maxPositions: body.maxPositions,
            maxDailyLoss: body.maxDailyLoss,
        };

        // Only update API keys if provided
        if (body.apiKey && body.apiKey.trim() !== '') {
            updateData.apiKey = encrypt(body.apiKey);
        }
        if (body.apiSecret && body.apiSecret.trim() !== '') {
            updateData.apiSecret = encrypt(body.apiSecret);
        }

        const bot = await prisma.bot.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, bot });
    } catch (error) {
        console.error('Error updating bot:', error);
        return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
    }
}
