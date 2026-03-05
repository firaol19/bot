'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Play, Square, Zap, TrendingUp, Shield, BarChart2, AlertCircle, ChevronDown } from 'lucide-react';
import { LivePriceCard } from '@/components/dashboard/LivePriceCard';
import { BotStatsGrid } from '@/components/dashboard/BotStatsGrid';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { PriceChart } from '@/components/charts/PriceChart';
import { MarketDataPanel } from '@/components/dashboard/MarketDataPanel';

interface FeaturesBotDetailClientProps {
    botId: string;
}

export function FeaturesBotDetailClient({ botId }: FeaturesBotDetailClientProps) {
    const router = useRouter();
    const [botData, setBotData] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

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
        const interval = setInterval(fetchBotData, 5000);
        return () => clearInterval(interval);
    }, [botId]);

    if (loading || !botData || !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading Features bot data...</div>
            </div>
        );
    }

    const isRunning = stats.isRunningInManager || botData.status === 'RUNNING';

    const handleStartStop = async () => {
        if (!botData) return;
        setActionLoading(true);
        try {
            const endpoint = isRunning ? 'stop' : 'start';
            const res = await fetch(`/api/bot/${botId}/${endpoint}`, {
                method: 'POST'
            });

            if (res.ok) {
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

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Link href="/dashboard/features" className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[10px] uppercase font-bold tracking-widest text-yellow-500/80">Features Trading Bot</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold flex flex-wrap items-center gap-3">
                            {botData.name}
                            <span className="text-sm px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-mono">
                                {botData.leverage}x Leverage
                            </span>
                            {isRunning && (
                                <span className="flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-green-900/30 text-green-400 font-normal">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Signal Monitoring Active
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {botData.symbol} • Bybit Linear (Futures) • {botData.mode}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto font-bold">
                    <button
                        onClick={handleStartStop}
                        disabled={actionLoading}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition disabled:opacity-50 ${isRunning
                            ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800/50'
                            : 'bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-800/50'
                            }`}
                    >
                        {isRunning ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {actionLoading ? '...' : isRunning ? 'Stop Bot' : 'Start Bot'}
                    </button>
                    <Link
                        href={`/dashboard/features/bot/${botId}/settings`}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition text-gray-300 hover:text-white border border-gray-700"
                    >
                        <Settings size={18} />
                        Settings
                    </Link>
                </div>
            </div>


            {/* Bot Health & Errors - Collapsible */}
            {stats.recentErrors && stats.recentErrors.length > 0 && (
                <div className="bg-red-900/10 border border-red-900/40 rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowErrors(!showErrors)}
                        className="w-full p-6 text-left hover:bg-red-900/5 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-red-400 font-bold flex items-center gap-2">
                                <AlertCircle size={20} />
                                Bot Health & Recent Errors
                                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">
                                    {stats.recentErrors.length}
                                </span>
                            </h3>
                            <ChevronDown
                                size={20}
                                className={`text-red-400 transition-transform duration-200 ${showErrors ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>
                    {showErrors && (
                        <div className="px-6 pb-6 space-y-3">
                            {stats.recentErrors.map((error: any) => (
                                <div key={error.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-sm p-3 bg-red-900/10 rounded-xl border border-red-900/20">
                                    <span className="text-red-200">{error.message}</span>
                                    <span className="text-red-500/70 text-xs font-mono">
                                        {new Date(error.timestamp).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}


            {/* Live Data & Strategy Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <LivePriceCard symbol={botData.symbol} initialPrice={stats.currentPrice} />

                    {/* Market Data Panel - NEW */}
                    <MarketDataPanel botId={botId} symbol={botData.symbol} />

                    {/* Strategy Signal Card */}
                    <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tighter text-xs">
                                <BarChart2 size={14} className="text-blue-400" />
                                MTF Strategy Status
                            </h3>
                            <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded italic">
                                {stats.latestAnalysis ? new Date(stats.latestAnalysis.timestamp).toLocaleTimeString() : 'Scanning...'}
                            </span>
                        </div>
                        <div className="space-y-4">
                            {stats.latestAnalysis ? (
                                <>
                                    {['15m', '5m', '1m'].map((tf) => {
                                        const tfData = stats.latestAnalysis?.data?.timeframes?.[tf];
                                        const isReady = tfData?.status === 'READY';
                                        const isWaiting = tfData?.status === 'WAITING';

                                        return (
                                            <div key={tf} className="space-y-2">
                                                <div className="flex items-center justify-between p-3 bg-gray-900/30 rounded-xl border border-gray-800/50">
                                                    <span className="text-sm text-gray-400">{tf} {tf === '15m' ? 'Trend' : tf === '5m' ? 'Setup' : 'Entry'}</span>
                                                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${isReady ? 'bg-green-900/40 text-green-400' :
                                                        isWaiting ? 'bg-yellow-900/40 text-yellow-400' :
                                                            'bg-gray-800 text-gray-400'
                                                        }`}>
                                                        {tfData?.status || 'IDLE'}
                                                    </span>
                                                </div>
                                                {tfData?.detail && (
                                                    <p className="text-[10px] text-gray-500 px-2 italic line-clamp-1">{tfData.detail}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                                    <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                    <p className="text-xs text-gray-500 animate-pulse">Waiting for first scan...</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800/50 text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Current Decision</p>
                            <p className={`text-sm font-bold ${stats.latestAnalysis?.data?.decision === 'SIGNAL_READY' ? 'text-green-400' : 'text-blue-400'}`}>
                                {stats.latestAnalysis?.data?.decision?.replace(/_/g, ' ') || 'INITIALIZING'}
                            </p>
                            <p className="text-[10px] text-gray-600 mt-2 italic leading-tight">
                                {stats.latestAnalysis?.data?.reason || 'Bot is gathering market data for first analysis.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <BarChart2 size={120} />
                    </div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                Market Analysis
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Interactive TradingView Chart</p>
                        </div>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">1m Timeframe</span>
                    </div>
                    <div className="h-[400px]">
                        <PriceChart symbol={botData.symbol} />
                    </div>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#0c0c0c] p-6 rounded-2xl border border-gray-800">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Profit</h3>
                    <p className={`text-3xl font-bold ${botData.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${botData.totalProfit.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-2">Aggregated realized PnL</p>
                </div>
                <div className="bg-[#0c0c0c] p-6 rounded-2xl border border-gray-800">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Win Rate</h3>
                    <p className="text-3xl font-bold text-white">{stats.winRate || 0}%</p>
                    <p className="text-[10px] text-gray-600 mt-2">Based on {botData.totalSells} trades</p>
                </div>
                <div className="bg-[#0c0c0c] p-6 rounded-2xl border border-gray-800">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Open Risk</h3>
                    <p className="text-3xl font-bold text-white">
                        ${(botData.capital * (botData.stopLossPercentage / 100)).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-2">Max loss per trade</p>
                </div>
                <div className="bg-[#0c0c0c] p-6 rounded-2xl border border-gray-800">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Leverage</h3>
                    <p className="text-3xl font-bold text-yellow-500">{botData.leverage}x</p>
                    <p className="text-[10px] text-gray-600 mt-2">Isolated Margin Applied</p>
                </div>
            </div>

            {/* Positions Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 overflow-hidden">
                        <h3 className="font-bold mb-6 text-white flex items-center justify-between">
                            Active Trades
                            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded font-normal text-gray-400">
                                {botData.positions.length} Open
                            </span>
                        </h3>
                        <PositionsTable
                            positions={botData.positions}
                            botId={botId}
                            stopLossPercent={botData.stopLossPercentage}
                            takeProfitPercent={botData.takeProfitPercentage}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Bot Configuration Card */}
                    <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6">
                        <h3 className="font-bold mb-6 text-white flex items-center gap-2">
                            <Shield size={16} className="text-yellow-500" />
                            Configuration
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Capital Allocated</span>
                                <span className="text-white font-mono font-bold">${botData.capital.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Isolated Leverage</span>
                                <span className="text-yellow-500 font-mono font-bold">{botData.leverage}x</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Stop Loss (Risk)</span>
                                <span className="text-red-400 font-mono font-bold">-{botData.stopLossPercentage}%</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Take Profit (Target)</span>
                                <span className="text-green-400 font-mono font-bold">+{botData.takeProfitPercentage}%</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-gray-800">
                            <div className="flex items-center gap-3 text-xs text-gray-600 leading-relaxed">
                                <Shield size={14} className="flex-shrink-0" />
                                <span>Risk management rules are enforced by the background engine 24/7.</span>
                            </div>
                        </div>
                    </div>

                    {/* Trade History Preview */}
                    <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6">
                        <h3 className="font-bold mb-6 text-white">Realized Statistics</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800/50">
                                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1">Total Buys</p>
                                <p className="text-xl font-bold text-blue-400">{botData.totalBuys}</p>
                            </div>
                            <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800/50">
                                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1">Total Sells</p>
                                <p className="text-xl font-bold text-green-400">{botData.totalSells}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
