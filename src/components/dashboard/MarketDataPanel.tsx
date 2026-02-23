'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, BarChart3, ShieldCheck, Zap } from 'lucide-react';

interface MarketDataPanelProps {
    botId: string;
    symbol: string;
}

export function MarketDataPanel({ botId, symbol }: MarketDataPanelProps) {
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [ping, setPing] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const start = Date.now();
            try {
                const res = await fetch(`/api/bot/${botId}/analysis`);
                const data = await res.json();
                setAnalysisData(data.latest);
                setPing(Date.now() - start);
            } catch (error) {
                // Silently handle errors
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
            <div className="glass-card rounded-[2rem] p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-6 bg-white/5 rounded-xl w-1/3"></div>
                    <div className="h-40 bg-white/5 rounded-3xl"></div>
                </div>
            </div>
        );
    }

    if (!analysisData) {
        return (
            <div className="glass-card rounded-[2rem] p-8">
                <h3 className="text-sm font-black text-white mb-6 uppercase tracking-[0.2em] flex items-center gap-3">
                    <BarChart3 size={20} className="text-blue-500" />
                    Market Analysis
                </h3>
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] bg-white/2">
                    <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center px-6 leading-relaxed">
                        Initializing Strategy Engine...<br />
                        <span className="text-blue-500/60 mt-2 block">Synchronizing with Bybit Oracle</span>
                    </p>
                </div>
            </div>
        );
    }

    const timeframes = analysisData.data?.timeframes || {};
    const indicators = analysisData.data?.indicators || {};
    const decision = analysisData.data?.decision || analysisData.decision;
    const reason = analysisData.data?.reason || analysisData.reason;

    const lastUpdate = new Date(analysisData.timestamp);
    const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);

    return (
        <div className="glass-card rounded-[2rem] p-8 space-y-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <BarChart3 size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-lg uppercase tracking-tight">Strategy Intelligence</h3>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">System Live</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-gray-700" />
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{ping}ms Latency</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 uppercase tracking-widest">
                    <Clock size={14} className="text-blue-500" />
                    <span>Updated {minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`}</span>
                </div>
            </div>

            {/* Timeframe Analysis */}
            <div className="space-y-4">
                {['15m', '5m', '1m'].map((tf) => {
                    const tfData = timeframes[tf];
                    if (!tfData) return null;

                    const indicators = tfData.indicators || {};
                    const price = indicators.price || 0;
                    const ema20 = indicators.ema20 || 0;
                    const ema50 = indicators.ema50 || 0;

                    const isBullish = ema20 > ema50;

                    return (
                        <div key={tf} className="p-6 rounded-[1.5rem] bg-white/2 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <span className="px-4 py-1.5 bg-gray-950/50 rounded-xl text-xs font-black text-blue-400 border border-white/5">{tf}</span>
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${isBullish ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {isBullish ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">{isBullish ? 'Bullish' : 'Bearish'}</span>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${tfData.status === 'READY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-gray-500 border-white/5'}`}>
                                    {tfData.status || 'Monitoring'}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-6">
                                <MarketMetric label="Ticker Price" value={`$${price.toLocaleString()}`} accent="white" />
                                <MarketMetric label="EMA 20" value={`$${ema20.toLocaleString()}`} accent="blue" />
                                <MarketMetric label="EMA 50" value={`$${ema50.toLocaleString()}`} accent="purple" />
                            </div>
                        </div>
                    );
                })}

                {/* Legacy Indicator Support */}
                {Object.keys(indicators).length > 0 && !timeframes['15m'] && (
                    <div className="p-8 bg-white/2 rounded-[2rem] border border-white/5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                            {Object.entries(indicators).map(([key, value]: [string, any]) => (
                                <MarketMetric
                                    key={key}
                                    label={key.replace(/([A-Z])/g, ' $1')}
                                    value={typeof value === 'number' ? (value > 100 ? value.toLocaleString() : value.toFixed(4)) : value.toString()}
                                    accent="blue"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* AI Decision Hub */}
            <div className={`rounded-[2rem] p-8 border-2 transition-all duration-500 ${decision === 'SIGNAL_READY' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]' :
                    decision === 'ERROR' ? 'bg-red-500/5 border-red-500/20' :
                        'bg-blue-500/5 border-blue-500/20'
                }`}>
                <div className="flex gap-6">
                    <div className={`p-4 rounded-2xl h-fit border ${decision === 'SIGNAL_READY' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            decision === 'ERROR' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                        <Zap size={24} className={decision === 'SIGNAL_READY' ? 'animate-glow' : ''} />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Strategy Deployment Status</p>
                            <h4 className={`text-2xl font-black uppercase tracking-tighter ${decision === 'SIGNAL_READY' ? 'text-emerald-400' :
                                    decision === 'ERROR' ? 'text-red-400' :
                                        'text-blue-400'
                                }`}>
                                {decision?.replace(/_/g, ' ')}
                            </h4>
                        </div>

                        <p className="text-sm text-gray-400 font-medium leading-relaxed bg-white/2 p-4 rounded-2xl border border-white/5 italic">
                            "{reason}"
                        </p>

                        <div className="flex items-center gap-2 pt-2">
                            <ShieldCheck size={14} className="text-gray-600" />
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Verified by Antigravity Core 1.0</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MarketMetric({ label, value, accent = 'white' }: any) {
    const accents: any = {
        white: 'text-white',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        emerald: 'text-emerald-400'
    };

    return (
        <div className="space-y-1.5">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
            <p className={`text-sm sm:text-lg font-black tracking-tighter font-mono ${accents[accent]}`}>{value}</p>
        </div>
    );
}

