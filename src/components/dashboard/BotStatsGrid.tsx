'use client';

import { TrendingUp, TrendingDown, Activity, Clock, Target, Award } from 'lucide-react';

interface BotStatsProps {
    stats: {
        totalTrades: number;
        totalBuys: number;
        totalSells: number;
        winRate: number;
        avgProfit: number;
        bestTrade: number;
        worstTrade: number;
        runningTimeFormatted: string;
        lastActivityAt?: Date | null;
    };
}

export function BotStatsGrid({ stats }: BotStatsProps) {
    const getLastActivityText = () => {
        if (!stats.lastActivityAt) return 'No activity yet';

        const now = new Date();
        const lastActivity = new Date(stats.lastActivityAt);
        const diffMs = now.getTime() - lastActivity.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);

        if (diffSecs < 60) return `${diffSecs}s ago`;
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    };

    return (
        <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Trades */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-gray-400">Total Trades</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.totalTrades}</p>
                </div>

                {/* Total Buys */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-gray-400">Buys</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{stats.totalBuys}</p>
                </div>

                {/* Total Sells */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-gray-400">Sells</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{stats.totalSells}</p>
                </div>

                {/* Win Rate */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-gray-400">Win Rate</span>
                    </div>
                    <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {stats.winRate.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Average Profit */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <span className="text-xs text-gray-400 block mb-2">Avg Profit/Trade</span>
                    <p className={`text-xl font-bold ${stats.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${stats.avgProfit.toFixed(2)}
                    </p>
                </div>

                {/* Best Trade */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-gray-400">Best Trade</span>
                    </div>
                    <p className="text-xl font-bold text-green-400">
                        ${stats.bestTrade.toFixed(2)}
                    </p>
                </div>

                {/* Worst Trade */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <span className="text-xs text-gray-400 block mb-2">Worst Trade</span>
                    <p className="text-xl font-bold text-red-400">
                        ${stats.worstTrade.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Runtime Info */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-gray-400">Running Time</span>
                        </div>
                        <p className="text-lg font-bold text-blue-400">{stats.runningTimeFormatted}</p>
                    </div>
                    <div>
                        <span className="text-sm text-gray-400 block mb-2">Last Activity</span>
                        <p className="text-lg font-medium text-gray-300">{getLastActivityText()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
