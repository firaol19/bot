import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Play, Pause, Zap, AlertCircle, ArrowLeft } from 'lucide-react';
import { BalanceCard } from '@/components/dashboard/BalanceCard';

export const dynamic = 'force-dynamic';

export default async function FeaturesManagePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams;
    const currentMode = view === 'real' ? 'REAL' : 'DEMO';

    const allBots = await prisma.bot.findMany({
        where: { type: 'FEATURES' },
        orderBy: { createdAt: 'desc' },
        include: { positions: { where: { status: 'OPEN' } } }
    });

    const bots = allBots.filter(bot => bot.mode === currentMode);

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="p-2 hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-baseline gap-2">
                        Features Management
                        <span className="text-gray-500 text-base md:text-lg font-normal">/ {currentMode === 'REAL' ? 'Real' : 'Demo'}</span>
                    </h1>
                </div>
                <Link
                    href={`/dashboard/features?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition flex items-center gap-2"
                >
                    <Zap size={18} />
                    Create New Features Bot
                </Link>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <BalanceCard mode={currentMode} />
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <h3 className="text-gray-400 text-sm">Active Features Bots</h3>
                    <p className="text-3xl font-bold mt-2 text-yellow-500">{bots.filter(b => b.status === 'RUNNING').length}</p>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <h3 className="text-gray-400 text-sm">Features Profit</h3>
                    <p className={`text-3xl font-bold mt-2 ${bots.reduce((acc, bot) => acc + bot.totalProfit, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${bots.reduce((acc, bot) => acc + bot.totalProfit, 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                    <h3 className="text-gray-400 text-sm">Active Trades</h3>
                    <p className="text-3xl font-bold mt-2">
                        {bots.reduce((acc, bot) => acc + bot.positions.length, 0)}
                    </p>
                </div>
            </div>

            {/* Bots List */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Zap size={20} className="text-yellow-400" />
                    Running Features Bots
                </h2>

                {bots.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
                        <Zap size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-500">No Features bots found for this mode.</p>
                        <Link
                            href={`/dashboard/features?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                            className="text-yellow-500 hover:underline mt-2 inline-block"
                        >
                            Create your first one &rarr;
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bots.map((bot: any) => (
                            <div key={bot.id} className="bg-[#0c0c0c] rounded-xl border border-gray-800 overflow-hidden relative group hover:border-yellow-500/30 transition-colors">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{bot.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-500 text-xs font-mono font-bold uppercase tracking-wider bg-yellow-500/10 px-2 py-0.5 rounded">
                                                    {bot.leverage}x Leverage
                                                </span>
                                                <span className="text-gray-400 text-sm font-medium">{bot.symbol}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${bot.mode === 'REAL' ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>
                                                {bot.mode}
                                            </span>
                                            {bot.status === 'RUNNING' && (
                                                <span className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold uppercase tracking-tight">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                                    Live
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-800/50 mb-6">
                                        <div>
                                            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Capital</p>
                                            <p className="text-white font-medium">${bot.capital.toFixed(2)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Realized PnL</p>
                                            <p className={`font-bold ${bot.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                ${bot.totalProfit.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Link
                                            href={`/dashboard/features/bot/${bot.id}?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                                            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-center rounded-lg transition text-xs font-bold"
                                        >
                                            Analysis
                                        </Link>
                                        <Link
                                            href={`/dashboard/bot/${bot.id}/settings`}
                                            className="px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition"
                                        >
                                            <ArrowLeft size={16} className="rotate-180" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
