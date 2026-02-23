'use client';

import { TrendingUp, TrendingDown, Target, Zap, BarChart3, PieChart } from 'lucide-react';

interface PortfolioOverviewProps {
    totalProfit: number;
    activeBots: number;
    winRate: number;
    capitalUtilization: number;
    mode: string;
}

export function PortfolioOverview({ totalProfit, activeBots, winRate, capitalUtilization, mode }: PortfolioOverviewProps) {
    const isProfitPositive = totalProfit >= 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Profit Card */}
            <div className="lg:col-span-2 glass-card p-8 rounded-[2rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full" />

                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                                    <BarChart3 size={20} className="text-gray-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Performance Overview</h3>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter italic">Consolidated Stats</p>
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl text-xs font-black tracking-widest uppercase border ${isProfitPositive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                {isProfitPositive ? '+ Profit' : '- Loss'}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-6 mb-10">
                            <h2 className={`text-6xl font-black tracking-tighter ${isProfitPositive ? 'text-white' : 'text-red-400'}`}>
                                ${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h2>
                            <div className="flex items-center gap-2 mb-2">
                                {isProfitPositive ? <TrendingUp size={24} className="text-emerald-400" /> : <TrendingDown size={24} className="text-red-400" />}
                                <span className={`text-lg font-bold ${isProfitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isProfitPositive ? 'Bullish' : 'Bearish'} Phase
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/5">
                        <StatItem icon={<Zap size={16} />} label="Active" value={activeBots.toString()} sub="Bots" color="blue" />
                        <StatItem icon={<Target size={16} />} label="Win Rate" value={`${winRate.toFixed(1)}%`} sub="Accuracy" color="emerald" />
                        <StatItem icon={<PieChart size={16} />} label="Usage" value={`${capitalUtilization.toFixed(1)}%`} sub="Allocated" color="purple" />
                        <StatItem icon={<BarChart3 size={16} />} label="Network" value="Active" sub="Real-time" color="amber" />
                    </div>
                </div>
            </div>

            {/* Win Rate Radar Shell */}
            <div className="glass-card p-8 rounded-[2rem] relative overflow-hidden flex flex-col items-center justify-center text-center">
                <div className="absolute inset-0 bg-blue-500/5 blur-[80px]" />

                <div className="relative z-10 w-full space-y-6">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">Strategy Accuracy</h3>

                    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                        {/* Circular Progress */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="96" cy="96" r="88"
                                className="stroke-white/5 fill-none"
                                strokeWidth="8"
                            />
                            <circle
                                cx="96" cy="96" r="88"
                                className="stroke-blue-500 fill-none transition-all duration-1000 ease-out"
                                strokeWidth="8"
                                strokeDasharray={2 * Math.PI * 88}
                                strokeDashoffset={2 * Math.PI * 88 * (1 - winRate / 100)}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-4xl font-black text-white">{winRate.toFixed(0)}%</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Target Met</span>
                        </div>
                    </div>

                    <div className="pt-4 space-y-2">
                        <p className="text-sm font-semibold text-gray-300">Operational Integrity</p>
                        <div className="flex justify-center gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={`h-1.5 w-8 rounded-full ${i <= (winRate / 20) ? 'bg-blue-500' : 'bg-white/5'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatItem({ icon, label, value, sub, color }: any) {
    const colorMap: any = {
        blue: 'text-blue-400 bg-blue-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
        purple: 'text-purple-400 bg-purple-500/10',
        amber: 'text-amber-400 bg-amber-500/10'
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${colorMap[color]}`}>
                    {icon}
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">{value}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase">{sub}</span>
            </div>
        </div>
    );
}
