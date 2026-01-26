import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BotSettingsForm } from '@/components/dashboard/BotSettingsForm';

export const dynamic = 'force-dynamic';

export default async function BotSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const bot = await prisma.bot.findUnique({
        where: { id }
    });

    if (!bot) {
        notFound();
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
                <Link href={`/dashboard/bot/${bot.id}`} className="p-2 hover:bg-gray-800 rounded-lg transition">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Bot Settings</h1>
                    <p className="text-gray-400 text-sm">{bot.name} • {bot.symbol}</p>
                </div>
            </div>

            <BotSettingsForm bot={bot} />
        </div>
    );
}
