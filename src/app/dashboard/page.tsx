import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Play, Pause, TrendingUp, AlertCircle } from 'lucide-react';
import { BalanceCard } from '@/components/dashboard/BalanceCard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams;
    const currentMode = view === 'real' ? 'REAL' : 'DEMO';

    const allBots = await prisma.bot.findMany({
        orderBy: { createdAt: 'desc' },
        include: { positions: { where: { status: 'OPEN' } } }
    });

    const bots = allBots.filter(bot => bot.mode === currentMode);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard <span className="text-gray-500 text-lg font-normal">/ {currentMode === 'REAL' ? 'Real Trading' : 'Demo View'}</span></h1>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <BalanceCard mode={currentMode} />
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <h3 className="text-gray-400 text-sm">Active Bots</h3>
                    <p className="text-3xl font-bold mt-2">{bots.filter(b => b.status === 'RUNNING').length}</p>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <h3 className="text-gray-400 text-sm">Total Profit</h3>
                    <p className={`text-3xl font-bold mt-2 ${bots.reduce((acc, bot) => acc + bot.totalProfit, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${bots.reduce((acc, bot) => acc + bot.totalProfit, 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <h3 className="text-gray-400 text-sm">Open Positions</h3>
                    <p className="text-3xl font-bold mt-2">
                        {bots.reduce((acc, bot) => acc + bot.positions.length, 0)}
                    </p>
                </div>
            </div>

            {/* Bots List */}
            <h2 className="text-2xl font-semibold mt-8">Your Bots</h2>
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
                            </div>

                            <Link
                                href={`/dashboard/bot/${bot.id}?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                                className="block w-full py-2 bg-blue-600 hover:bg-blue-700 text-center rounded-lg transition"
                            >
                                View Details
                            </Link>
                        </div>
                    </div>
                ))}

                {/* Create New Bot Card */}
                <Link href={`/dashboard/create?view=${currentMode === 'REAL' ? 'real' : 'demo'}`} className="bg-gray-900/50 border border-gray-800 border-dashed rounded-xl flex flex-col items-center justify-center p-6 hover:bg-gray-900 hover:border-gray-700 transition cursor-pointer min-h-[250px]">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-gray-400">
                        +
                    </div>
                    <span className="text-gray-400 font-medium">Create New Bot</span>
                </Link>
            </div>
        </div>
    );
}
