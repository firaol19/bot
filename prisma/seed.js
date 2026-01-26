const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.upsert({
        where: { email: 'admin@bot.com' },
        update: {},
        create: {
            email: 'admin@bot.com',
            password: 'hashed_password_here', // In real app, use bcrypt
            name: 'Admin Trader',
        },
    });

    const bot = await prisma.bot.create({
        data: {
            name: 'BTC Grid Demo',
            userId: user.id,
            symbol: 'BTC/USDT',
            capital: 1000,
            buyPercentage: 10,
            sellPercentage: 0.3,
            buyDrop: 0.3,
            mode: 'DEMO',
            status: 'IDLE'
        },
    });

    console.log({ user, bot });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
