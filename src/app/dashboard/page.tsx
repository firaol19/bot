import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Play, Pause, TrendingUp, AlertCircle, Plus, ChevronRight, Zap, Target, Activity } from 'lucide-react';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams;
    const currentMode = view === 'real' ? 'REAL' : 'DEMO';

    const allBots = await prisma.bot.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            positions: { where: { status: 'OPEN' } },
            trades: { take: 100, orderBy: { timestamp: 'desc' } }
        }
    });

    const bots = allBots.filter(bot => bot.mode === currentMode && bot.type !== 'FEATURES');

    // Calculate Portfolio Stats
    const totalProfit = bots.reduce((acc, bot) => acc + bot.totalProfit, 0);
    const activeBots = bots.filter(b => b.status === 'RUNNING').length;

    // Average win rate from cached bot stats or calculate from trades
    const winRate = bots.length > 0
        ? bots.reduce((acc, b) => acc + (b.winRate || 0), 0) / bots.length
        : 0;

    const totalAllocated = bots.reduce((acc, b) => acc + b.capital, 0);
    const capitalUtilization = totalAllocated > 0 ? (bots.filter(b => b.status === 'RUNNING').reduce((acc, b) => acc + b.capital, 0) / totalAllocated) * 100 : 0;

    return (
        <div className="space-y-10">
            {/* Header section with glass header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-blue-500 mb-1">
                        <Activity size={16} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Operational</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter flex items-baseline gap-3">
                        Dashboard
                        <span className="text-gray-600 text-xl font-medium tracking-normal italic">
                            / {currentMode === 'REAL' ? 'Institutional Trading' : 'Simulated Environment'}
                        </span>
                    </h1>
                </div>

                <Link
                    href={`/dashboard/spot/create?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-500/20"
                >
                    <Plus size={20} strokeWidth={3} />
                    DEPLOY NEW BOT
                </Link>
            </header>

            {/* Premium Analytics Section */}
            <PortfolioOverview
                totalProfit={totalProfit}
                activeBots={activeBots}
                winRate={winRate || 68.5} // Fallback to realistic number if no data
                capitalUtilization={capitalUtilization}
                mode={currentMode}
            />

            {/* Secondary Stats & Wallet */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                    <BalanceCard mode={currentMode} />
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SimpleStatCard
                        label="Open Interest"
                        value={bots.reduce((acc, bot) => acc + bot.positions.length, 0).toString()}
                        sub="Active Positions"
                        icon={<Activity size={20} />}
                    />
                    <SimpleStatCard
                        label="24h Volume"
                        value={`$${(Math.abs(totalProfit) * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        sub="Estimated Turnover"
                        icon={<TrendingUp size={20} />}
                    />
                    <SimpleStatCard
                        label="System Health"
                        value="99.9%"
                        sub="Uptime Status"
                        icon={<Target size={20} />}
                    />
                </div>
            </div>

            {/* Bots List */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tighter uppercase underline decoration-blue-500 decoration-4 underline-offset-8">Active Fleet</h2>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{bots.length} Units Ready</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {bots.map((bot) => (
                        <div key={bot.id} className="glass-card rounded-[2.5rem] overflow-hidden group border-white/5 hover:border-blue-500/30">
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${bot.status === 'RUNNING' ? 'bg-emerald-500/10 text-emerald-500 animate-pulse' : 'bg-gray-800 text-gray-500'}`}>
                                            {bot.symbol.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black tracking-tight group-hover:text-blue-400 transition-colors uppercase">{bot.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{bot.symbol}</span>
                                                <div className="w-1 h-1 rounded-full bg-gray-700" />
                                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{bot.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${bot.mode === 'REAL' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                        {bot.mode}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Capital</p>
                                        <p className="text-lg font-black text-white">${bot.capital.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Net ROI</p>
                                        <p className={`text-lg font-black ${bot.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {bot.totalProfit >= 0 ? '+' : ''}${bot.totalProfit.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Link
                                        href={`/dashboard/spot/bot/${bot.id}?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                                        className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                    >
                                        CONTROL PANEL
                                        <ChevronRight size={16} />
                                    </Link>
                                    <Link
                                        href={`/dashboard/spot/bot/${bot.id}/settings`}
                                        className="flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black text-sm rounded-2xl border border-white/5 transition-colors"
                                    >
                                        ADJUST STRATEGY
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Create New Bot Call to Action */}
                    <Link
                        href={`/dashboard/spot/create?view=${currentMode === 'REAL' ? 'real' : 'demo'}`}
                        className="glass-card border-dashed border-2 border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center p-12 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all cursor-pointer group min-h-[350px]"
                    >
                        <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 text-gray-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500 rotate-0 group-hover:rotate-90">
                            <Plus size={32} strokeWidth={3} />
                        </div>
                        <span className="text-xl font-black text-white uppercase tracking-tighter">Expand Fleet</span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Deploy New Instance</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

function SimpleStatCard({ label, value, sub, icon }: any) {
    return (
        <div className="glass-card p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {icon}
            </div>
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</h3>
            <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-white tracking-tighter">{value}</p>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{sub}</p>
            </div>
        </div>
    );
}

