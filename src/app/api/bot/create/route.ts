import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // In a real app, getting the user ID from the session is crucial
        // Here we'll just fetch the first user (the seed user)
        const user = await prisma.user.findFirst();
        if (!user) {
            return NextResponse.json({ error: 'No user found' }, { status: 400 });
        }

        const botData: any = {
            name: body.name,
            userId: user.id,
            symbol: body.symbol,
            capital: body.capital || 0,
            buyPercentage: body.buyPercentage,
            sellPercentage: body.sellPercentage,
            buyDrop: body.buyDrop,
            mode: body.mode,
            status: 'IDLE',
            exchange: body.exchange
        };

        if (body.apiKey) botData.apiKey = encrypt(body.apiKey);
        if (body.apiSecret) botData.apiSecret = encrypt(body.apiSecret);

        const bot = await prisma.bot.create({
            data: botData,
        });

        return NextResponse.json(bot);
    } catch (error) {
        console.error('Error creating bot:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
