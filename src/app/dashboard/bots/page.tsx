import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BotsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams;
    const currentMode = view === 'real' ? 'REAL' : 'DEMO';

    const bots = await prisma.bot.findMany({
        orderBy: { createdAt: 'desc' },
        where: { mode: currentMode },
        include: { positions: { where: { status: 'OPEN' } } }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Active Bots</h1>
                <Link href={`/dashboard/create?view=${currentMode === 'REAL' ? 'real' : 'demo'}`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition">
                    <Plus size={20} />
                    <span>Create New Bot</span>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bots.map((bot) => (
                    <div key={bot.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden relative group">
                        {bot.status === 'RUNNING' && (
                            <div className="absolute top-0 right-0 p-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full inline-block animate-pulse"></span>
                            </div>
                        )}
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold">{bot.name}</h3>
                                    <p className="text-gray-400 text-sm">{bot.symbol}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${bot.mode === 'REAL' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'}`}>
                                    {bot.mode}
                                </span>
                            </div>

                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Capital</span>
                                    <span>${bot.capital}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Profit</span>
                                    <span className={bot.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        ${bot.totalProfit.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Open Positions</span>
                                    <span>{bot.positions.length}</span>
                                </div>
                            </div>

                            <Link
                                href={`/dashboard/bot/${bot.id}?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                                className="block w-full py-2 bg-blue-600 hover:bg-blue-700 text-center rounded-lg transition"
                            >
                                Manage Bot
                            </Link>
                        </div>
                    </div>
                ))}

                {bots.length === 0 && (
                    <div className="col-span-full border border-dashed border-gray-800 rounded-xl p-12 text-center text-gray-500">
                        No bots found. Create your first one to get started!
                    </div>
                )}
            </div>
        </div>
    );
}
