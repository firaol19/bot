'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Wallet, AlertCircle, RefreshCw, TrendingUp, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function FeaturesBotForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMode = searchParams.get('view') === 'real' ? 'REAL' : 'DEMO';

    const [formData, setFormData] = useState({
        name: '',
        symbol: 'BTC/USDT',
        capitalAllocation: 10,
        leverage: 1,
        stopLossPercentage: 0.3, // 0.2%–0.3% as per requirements
        takeProfitPercentage: 0.6, // 0.4%–0.6% as per requirements
        sellPercentage: 0.6, // Mapped to TP for schema requirements
        buyDrop: 0, // Not used by FEATURES but required by schema
        exchange: 'bybit',
        mode: initialMode,
        type: 'FEATURES',
        buyPercentage: 100, // For Features bot, we use this to calculate risk
        strategyName: 'MultiTimeframe',
        maxDailyTrades: 0,
    });


    const [availableBalance, setAvailableBalance] = useState(0);
    const [loadingBalance, setLoadingBalance] = useState(true);
    const [loading, setLoading] = useState(false);
    const [balanceError, setBalanceError] = useState('');
    const [currentPrice, setCurrentPrice] = useState(0);

    useEffect(() => {
        fetchBalance();
        fetchPrice();
        const interval = setInterval(fetchPrice, 5000);
        return () => clearInterval(interval);
    }, [initialMode, formData.symbol]);

    const fetchBalance = async () => {
        setLoadingBalance(true);
        setBalanceError('');
        try {
            const res = await fetch(`/api/wallet/balance?mode=${initialMode}`);
            const data = await res.json();
            if (data.error || data.info) {
                setBalanceError(data.info || data.error || 'Failed to fetch balance');
                setAvailableBalance(0);
            } else if (data.free !== undefined) {
                setAvailableBalance(data.free);
            }
        } catch (error) {
            setBalanceError('Failed to connect to exchange');
            setAvailableBalance(0);
        } finally {
            setLoadingBalance(false);
        }
    };

    const fetchPrice = async () => {
        try {
            const res = await fetch(`/api/market/ticker?symbol=${formData.symbol}`);
            const data = await res.json();
            if (data.last) {
                setCurrentPrice(data.last);
            }
        } catch (error) {
            console.error('Failed to fetch price', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Strict Risk Validation: Max risk per trade ≤ 1 USDT
        // Risk = Capital * (SL / 100)
        const riskAmount = formData.capitalAllocation * (formData.stopLossPercentage / 100);
        if (riskAmount > 1.0) {
            alert(`MANDATORY RULE VIOLATION: Max risk per trade ($${riskAmount.toFixed(2)}) must be ≤ 1 USDT. Please reduce capital or SL percentage.`);
            return;
        }

        if (formData.capitalAllocation > availableBalance) {
            alert(`Capital ($${formData.capitalAllocation}) exceeds available balance ($${availableBalance.toFixed(2)})`);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/bot/features/create', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    capital: formData.capitalAllocation,
                    maxPositions: 1, // Features bot is single-entry focused
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                router.push(`/dashboard?view=${initialMode === 'REAL' ? 'real' : 'demo'}`);
                router.refresh();
            } else {
                const error = await res.json();
                alert(`Failed to create bot: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Error creating bot');
        } finally {
            setLoading(false);
        }
    };

    const tpPrice = currentPrice > 0
        ? currentPrice * (1 + formData.takeProfitPercentage / 100)
        : 0;
    const slPrice = currentPrice > 0
        ? currentPrice * (1 - formData.stopLossPercentage / 100)
        : 0;

    const riskAmount = formData.capitalAllocation * (formData.stopLossPercentage / 100);

    return (
        <div className="max-w-4xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <Link href={`/dashboard?view=${initialMode === 'REAL' ? 'real' : 'demo'}`} className="p-2 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl transition shadow-lg">
                        <ArrowLeft size={20} className="text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent"> Features Trading Bot</h1>
                        <p className="text-gray-400 text-sm flex items-center gap-2 mt-1">
                            <TrendingUp size={14} className="text-blue-500" /> Multi-Timeframe Strategy (15m, 5m, 1m)
                        </p>
                    </div>
                </div>
                <div className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider shadow-sm ${initialMode === 'REAL' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                    {initialMode === 'REAL' ? 'Real Trading System' : 'Demo Practice Mode'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <TrendingUp size={120} />
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Bot Identity</label>
                                    <input type="text" required className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl p-4 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-700" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Master MTF Bot" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Strategy Architecture</label>
                                    <select className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl p-4 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer" value={formData.strategyName} onChange={e => setFormData({ ...formData, strategyName: e.target.value })}>
                                        <option value="MultiTimeframe">MTF (Triple Window Confirmation)</option>
                                        <option value="TrendFollowing">Trend-following (EMA + Market Structure)</option>
                                        <option value="Breakout">Breakout (Bollinger Bands + Volume)</option>
                                        <option value="MeanReversion">Mean Reversion (RSI + BB)</option>
                                        <option value="FundingBias">Funding Rate + OI Bias</option>
                                        <option value="SidewaysGrid">Grid Bot (Sideways Market Optimized)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Trading Asset</label>
                                    <select className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl p-4 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer" value={formData.symbol} onChange={e => setFormData({ ...formData, symbol: e.target.value })}>

                                        <option value="BTC/USDT">BTC/USDT (Bitcoin)</option>
                                        <option value="ETH/USDT">ETH/USDT (Ethereum)</option>
                                        <option value="SOL/USDT">SOL/USDT (Solana)</option>
                                        <option value="XRP/USDT">XRP/USDT (Ripple)</option>
                                        <option value="DOGE/USDT">DOGE/USDT (Dogecoin)</option>
                                        <option value="LINK/USDT">LINK/USDT (Chainlink)</option>
                                        <option value="ADA/USDT">ADA/USDT (Cardano)</option>
                                        <option value="MATIC/USDT">MATIC/USDT (Polygon)</option>
                                        <option value="AVAX/USDT">AVAX/USDT (Avalanche)</option>
                                        <option value="DOT/USDT">DOT/USDT (Polkadot)</option>
                                        <option value="NEAR/USDT">NEAR/USDT (Near Protocol)</option>
                                        <option value="SUI/USDT">SUI/USDT (Sui)</option>
                                        <option value="LTC/USDT">LTC/USDT (Litecoin)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Trade Capital (USDT)</label>
                                    <span className="text-xs font-medium text-gray-500">Max Available: ${availableBalance.toFixed(2)}</span>
                                </div>
                                <div className="relative">
                                    <input type="number" required min="1" max={availableBalance} step="0.01" className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl p-4 pl-12 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={formData.capitalAllocation} onChange={e => setFormData({ ...formData, capitalAllocation: parseFloat(e.target.value) || 0 })} />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                        <Wallet size={18} />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    {[25, 50, 100].map(pct => (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, capitalAllocation: parseFloat((availableBalance * pct / 100).toFixed(2)) })}
                                            className="px-4 py-2 bg-gray-950 border border-gray-800 hover:bg-gray-800 rounded-xl text-xs font-semibold text-gray-400 transition shadow-sm"
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Leverage (x)</label>
                                    <input type="number" required min="1" max="50" step="1" className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl p-4 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all" value={formData.leverage} onChange={e => setFormData({ ...formData, leverage: parseInt(e.target.value) || 1 })} />
                                    <p className="text-[10px] text-gray-500 ml-1 italic">* Recommended: 10x - 20x for MTF Strategy</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Strategy Risk Limit</label>
                                    <div className={`w-full bg-gray-950/50 border rounded-2xl p-4 flex items-center justify-between transition-colors ${riskAmount > 1 ? 'border-red-500/50' : 'border-green-500/50'}`}>
                                        <span className="text-sm text-gray-400 font-medium">Potential Risk</span>
                                        <span className={`font-bold ${riskAmount > 1 ? 'text-red-400' : 'text-green-400'}`}>$ {riskAmount.toFixed(2)} USDT</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 ml-1 flex items-center gap-1">
                                        <ShieldCheck size={10} className="text-green-500" /> Requirement: ≤ $1.00 USDT risk
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1">Daily Trade Limit</label>
                                    <input type="number" min="0" step="1" className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl p-4 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={formData.maxDailyTrades} onChange={e => setFormData({ ...formData, maxDailyTrades: parseInt(e.target.value) || 0 })} />
                                    <p className="text-[10px] text-gray-500 ml-1 italic">* 0 = Unlimited trades per day</p>
                                </div>
                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1 text-red-400">Stop Loss (%)</label>
                                    <input type="number" required step="0.01" min="0.1" max="1" className="w-full bg-gray-950/50 border border-red-500/20 rounded-2xl p-4 text-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all" value={formData.stopLossPercentage} onChange={e => setFormData({ ...formData, stopLossPercentage: parseFloat(e.target.value) || 0 })} />
                                    <div className="text-xs font-bold text-red-400/80 ml-1 bg-red-400/5 p-3 rounded-xl space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span>Price:</span>
                                            <span>$ {slPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-red-400/10 pt-1">
                                            <span>Est. Loss:</span>
                                            <span>-$ {(formData.capitalAllocation * formData.stopLossPercentage / 100).toFixed(2)} USDT</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 ml-1 text-green-400">Take Profit (%)</label>
                                    <input type="number" required step="0.01" min="0.1" className="w-full bg-gray-950/50 border border-green-500/20 rounded-2xl p-4 text-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all" value={formData.takeProfitPercentage} onChange={e => setFormData({ ...formData, takeProfitPercentage: parseFloat(e.target.value) || 0 })} />
                                    <div className="text-xs font-bold text-green-400/80 ml-1 bg-green-400/5 p-3 rounded-xl space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span>Price:</span>
                                            <span>$ {tpPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-green-400/10 pt-1">
                                            <span>Est. Profit:</span>
                                            <span>+$ {(formData.capitalAllocation * formData.takeProfitPercentage / 100).toFixed(2)} USDT</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={loading || riskAmount > 1 || formData.capitalAllocation > availableBalance || availableBalance === 0} className="w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] mt-6">
                                {loading ? 'Initializing Engine...' : 'Deploy Features Strategy'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-blue-900/20 border border-blue-800/30 rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-xl">
                                <ShieldCheck className="text-blue-400" size={24} />
                            </div>
                            <h3 className="font-bold text-white">Strategy Guidelines</h3>
                        </div>
                        <ul className="space-y-3 text-xs text-blue-200/70 leading-relaxed font-medium">
                            <li className="flex gap-2">
                                <span className="text-blue-400 font-bold">•</span>
                                <div><strong className="text-blue-300">Trend Verification:</strong> 15m Timeframe ensures we follow the primary market direction.</div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 font-bold">•</span>
                                <div><strong className="text-blue-300">Setup Stability:</strong> 5m Timeframe filters out noise and waits for retracements.</div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 font-bold">•</span>
                                <div><strong className="text-blue-300">Precision Entry:</strong> 1m Timeframe entry based on candle confirmation only.</div>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-800/50 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-400">Market Price</span>
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-lg">Real-time</span>
                        </div>
                        <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                            $ {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="pt-4 border-t border-gray-800 flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-400">Available Funds</span>
                            <span className="text-lg font-bold text-white">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <button onClick={fetchBalance} disabled={loadingBalance} className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-300 transition-all flex items-center justify-center gap-2">
                            <RefreshCw size={14} className={loadingBalance ? 'animate-spin' : ''} />
                            Refresh Wallet
                        </button>
                    </div>

                    {riskAmount > 1 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 animate-pulse">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="text-red-400 shrink-0" size={24} />
                                <div className="space-y-2">
                                    <h4 className="font-bold text-red-400 text-sm italic underline">STRICT RULES ALERT</h4>
                                    <p className="text-xs text-red-300/80 leading-relaxed font-semibold">
                                        Your configuration results in a <span className="text-white underline">${riskAmount.toFixed(2)}</span> risk.
                                        Maximum allowed risk per trade is <span className="text-white underline">$1.00 USDT</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
