'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Play, Square, Activity } from 'lucide-react';
import { LivePriceCard } from '@/components/dashboard/LivePriceCard';
import { BotStatsGrid } from '@/components/dashboard/BotStatsGrid';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { PriceChart } from '@/components/charts/PriceChart';

interface BotDetailClientProps {
    botId: string;
}

export function BotDetailClient({ botId }: BotDetailClientProps) {
    const router = useRouter();
    const [botData, setBotData] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch bot data and stats
    const fetchBotData = async () => {
        try {
            const res = await fetch(`/api/bot/${botId}/stats`);
            const data = await res.json();

            if (data.bot && data.stats) {
                setBotData(data.bot);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch bot data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBotData();

        // Poll every 5 seconds for updates
        const interval = setInterval(fetchBotData, 5000);

        return () => clearInterval(interval);
    }, [botId]);

    const handleStartStop = async () => {
        if (!botData) return;

        setActionLoading(true);
        try {
            const endpoint = botData.status === 'RUNNING' ? 'stop' : 'start';
            const res = await fetch(`/api/bot/${botId}/${endpoint}`, {
                method: 'POST'
            });

            if (res.ok) {
                // Refresh data immediately
                await fetchBotData();
                router.refresh();
            } else {
                alert(`Failed to ${endpoint} bot`);
            }
        } catch (error) {
            console.error('Error toggling bot:', error);
            alert('Error performing action');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !botData || !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading bot data...</div>
            </div>
        );
    }

    const isRunning = botData.status === 'RUNNING';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/dashboard" className="p-2 hover:bg-gray-800 rounded-lg transition">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {botData.name}
                            <span className="text-sm px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-normal">
                                {botData.symbol}
                            </span>
                            {isRunning && (
                                <span className="flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-green-900/30 text-green-400 font-normal">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Running 24/7
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-400 text-sm">
                            {botData.exchange.toUpperCase()} • {botData.mode} Mode
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleStartStop}
                        disabled={actionLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${isRunning
                            ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800'
                            : 'bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-800'
                            }`}
                    >
                        {isRunning ? <Square size={18} /> : <Play size={18} />}
                        {actionLoading ? 'Processing...' : isRunning ? 'Stop Bot' : 'Start Bot'}
                    </button>
                    <Link
                        href={`/dashboard/bot/${botId}/settings`}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300 hover:text-white font-medium"
                    >
                        <Settings size={18} />
                        Edit Bot
                    </Link>
                </div>
            </div>

            {/* Live Price & Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <LivePriceCard symbol={botData.symbol} initialPrice={stats.currentPrice} />
                </div>
                <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-300">Market Price Chart</h3>
                        <span className="text-xs text-gray-500">Live Updates</span>
                    </div>
                    <PriceChart symbol={botData.symbol} />
                </div>
            </div>

            {/* Statistics Grid */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Performance Statistics</h2>
                <BotStatsGrid stats={stats} />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Positions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">
                            Active Positions ({botData.positions.length})
                        </h3>
                        <PositionsTable
                            positions={botData.positions}
                            botId={botId}
                            stopLossPercent={botData.stopLossPercentage}
                            takeProfitPercent={botData.takeProfitPercentage}
                        />
                    </div>
                </div>

                {/* Right Column: Info */}
                <div className="space-y-6">
                    {/* Bot Configuration */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Configuration</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Capital</span>
                                <span className="font-medium">${botData.capital}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Position Size</span>
                                <span className="font-medium">{botData.buyPercentage}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Buy Drop</span>
                                <span className="font-medium">{botData.buyDrop}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Sell Profit</span>
                                <span className="font-medium">{botData.sellPercentage}%</span>
                            </div>
                            {botData.stopLossPercentage && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Stop Loss</span>
                                    <span className="font-medium text-red-400">{botData.stopLossPercentage}%</span>
                                </div>
                            )}
                            {botData.takeProfitPercentage && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Take Profit</span>
                                    <span className="font-medium text-green-400">{botData.takeProfitPercentage}%</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Total Profit */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Total Profit</h3>
                        <p className={`text-3xl font-bold ${botData.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${botData.totalProfit.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Since {new Date(botData.createdAt).toLocaleDateString()}
                        </p>
                    </div>

                    {/* Recent Trades */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Recent Trades</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {botData.trades.length === 0 ? (
                                <p className="text-gray-500 text-sm">No trades yet</p>
                            ) : (
                                botData.trades.map((trade: any) => (
                                    <div
                                        key={trade.id}
                                        className="flex justify-between items-center text-sm p-2 hover:bg-gray-800/50 rounded"
                                    >
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                {trade.side}
                                            </span>
                                            <span className="text-gray-500 text-xs">
                                                {new Date(trade.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">${trade.price.toFixed(2)}</div>
                                            <div className="text-xs text-gray-500">
                                                {trade.amount.toFixed(6)} {botData.symbol.split('/')[0]}
                                            </div>
                                            {trade.profit !== null && trade.profit !== undefined && (
                                                <div className={`text-xs font-medium ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
