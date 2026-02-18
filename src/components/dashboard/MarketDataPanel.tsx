'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, BarChart3 } from 'lucide-react';

interface MarketDataPanelProps {
    botId: string;
    symbol: string;
}

export function MarketDataPanel({ botId, symbol }: MarketDataPanelProps) {
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/bot/${botId}/analysis`);
                const data = await res.json();
                setAnalysisData(data.latest);
            } catch (error) {
                // Silently handle errors - will show waiting state
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [botId]);

    if (loading) {
        return (
            <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-800 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (!analysisData) {
        return (
            <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-400" />
                    Market Analysis
                </h3>
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                    <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-xs text-gray-500 text-center px-4">
                        Waiting for first analysis...<br />
                        <span className="text-[10px] text-gray-600 mt-1 block">(Updates every 5 minutes when no positions are open)</span>
                    </p>
                </div>
            </div>
        );
    }

    const timeframes = analysisData.data?.timeframes || {};
    const lastUpdate = new Date(analysisData.timestamp);
    const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);

    return (
        <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
                <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                    <BarChart3 size={20} className="text-blue-400" />
                    Market Analysis
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900/50 px-3 py-1.5 rounded-lg">
                    <Clock size={13} />
                    <span>{minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`}</span>
                </div>
            </div>

            {/* Timeframe Cards */}
            <div className="space-y-3">
                {['15m', '5m', '1m'].map((tf) => {
                    const tfData = timeframes[tf];
                    if (!tfData) return null;

                    const indicators = tfData.indicators || {};
                    const price = indicators.price || 0;
                    const ema20 = indicators.ema20 || 0;
                    const ema50 = indicators.ema50 || 0;

                    const isBullish = ema20 > ema50;
                    const priceAboveEMA20 = price > ema20;

                    return (
                        <div key={tf} className={`bg-gradient-to-br ${isBullish ? 'from-green-900/10 to-green-800/5' : 'from-red-900/10 to-red-800/5'} rounded-xl p-4 border ${isBullish ? 'border-green-900/30' : 'border-red-900/30'}`}>
                            {/* Timeframe Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className={`px-2 sm:px-3 py-1 rounded-lg font-bold text-xs sm:text-sm ${isBullish ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {tf}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {isBullish ? (
                                            <TrendingUp size={14} className="text-green-400 sm:w-4 sm:h-4" />
                                        ) : (
                                            <TrendingDown size={14} className="text-red-400 sm:w-4 sm:h-4" />
                                        )}
                                        <span className={`text-[10px] sm:text-xs font-semibold ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
                                            {isBullish ? 'Bullish' : 'Bearish'}
                                        </span>
                                    </div>
                                </div>
                                <div className={`text-[10px] sm:text-xs px-2 py-1 rounded w-fit ${tfData.status === 'READY' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                    {tfData.status || 'IDLE'}
                                </div>
                            </div>

                            {/* Price Data Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">Price</div>
                                    <div className="font-mono font-bold text-white text-sm sm:text-base">
                                        ${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div className={`text-[9px] ${priceAboveEMA20 ? 'text-green-400' : 'text-red-400'}`}>
                                        {priceAboveEMA20 ? '↑ Above EMA20' : '↓ Below EMA20'}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-[10px] text-blue-400 uppercase font-bold">EMA 20</div>
                                    <div className="font-mono font-semibold text-blue-300 text-base">
                                        ${ema20.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-[9px] text-gray-600">
                                        Fast MA
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-[10px] text-purple-400 uppercase font-bold">EMA 50</div>
                                    <div className="font-mono font-semibold text-purple-300 text-base">
                                        ${ema50.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-[9px] text-gray-600">
                                        Slow MA
                                    </div>
                                </div>
                            </div>

                            {/* Status Detail */}
                            {tfData.detail && (
                                <div className="mt-3 pt-3 border-t border-gray-800/50">
                                    <p className="text-[11px] text-gray-400 leading-relaxed">
                                        {tfData.detail}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Analysis Decision */}
            <div className={`rounded-xl p-4 border ${analysisData.decision === 'SIGNAL_READY' ? 'bg-green-900/20 border-green-900/40' :
                analysisData.decision === 'ERROR' ? 'bg-red-900/20 border-red-900/40' :
                    'bg-blue-900/20 border-blue-900/40'
                }`}>
                <div className="flex items-start gap-3">
                    <Activity size={18} className={`mt-0.5 flex-shrink-0 ${analysisData.decision === 'SIGNAL_READY' ? 'text-green-400' :
                        analysisData.decision === 'ERROR' ? 'text-red-400' :
                            'text-blue-400'
                        }`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Current Decision</p>
                        <p className={`text-base font-bold mb-2 ${analysisData.decision === 'SIGNAL_READY' ? 'text-green-400' :
                            analysisData.decision === 'ERROR' ? 'text-red-400' :
                                'text-yellow-400'
                            }`}>
                            {analysisData.decision?.replace(/_/g, ' ')}
                        </p>
                        {analysisData.decision !== 'ERROR' && (
                            <p className="text-xs text-gray-300 leading-relaxed">
                                {analysisData.reason}
                            </p>
                        )}
                        {analysisData.decision === 'ERROR' && (
                            <p className="text-xs text-red-300/80 leading-relaxed">
                                Analysis temporarily unavailable. Check "Bot Health & Recent Errors" below for details.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
