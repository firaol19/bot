const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('--- BOTS ---');
        const bots = await prisma.bot.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        bots.forEach(b => {
            console.log(`Bot ID: ${b.id}, Name: ${b.name}, Status: ${b.status}, Symbol: ${b.symbol}, Capital: ${b.capital}`);
        });

        console.log('\n--- RECENT LOGS ---');
        const logs = await prisma.botLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 10
        });
        logs.forEach(l => {
            console.log(`[${l.level}] [${l.botId}] ${l.message}`);
        });

        console.log('\n--- RECENT TRADES ---');
        const trades = await prisma.trade.findMany({
            orderBy: { timestamp: 'desc' },
            take: 5
        });
        trades.forEach(t => {
            console.log(`Trade: ${t.side} ${t.amount} ${t.symbol} at ${t.price}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
