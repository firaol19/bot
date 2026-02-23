'use client';

import { useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, Plus, RefreshCw } from 'lucide-react';

export function BalanceCard({ mode = 'DEMO' }: { mode?: string }) {
    const [balance, setBalance] = useState({ total: 0, free: 0, used: 0 });
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);

    const fetchBalance = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/wallet/balance?mode=${mode}`);
            const data = await res.json();
            setBalance(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 60000); // 1-minute auto-refresh
        return () => clearInterval(interval);
    }, [mode]);

    const handleRequestFunds = async () => {
        setRequesting(true);
        try {
            const res = await fetch('/api/wallet/faucet', {
                method: 'POST',
                body: JSON.stringify({ mode: 'DEMO' }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                fetchBalance();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRequesting(false);
        }
    };

    const usedPercentage = balance.total > 0 ? (balance.used / balance.total) * 100 : 0;

    return (
        <div className="glass-card p-8 rounded-[2rem] relative overflow-hidden group h-full flex flex-col justify-between">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700" />

            <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <Wallet size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Equity</h3>
                            <p className="text-[10px] font-bold text-blue-500/80 uppercase tracking-tighter italic">Primary Portfolio</p>
                        </div>
                    </div>

                    <button onClick={fetchBalance} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        <div className="animate-pulse h-12 w-48 bg-white/5 rounded-2xl"></div>
                        <div className="animate-pulse h-4 w-32 bg-white/5 rounded-xl"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black tracking-tighter text-white">
                                    ${balance.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-sm font-bold text-gray-500 uppercase">USDT</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 w-fit px-2 py-1 rounded-lg border border-emerald-500/20">
                                <ArrowUpRight size={12} />
                                <span>Live Sync Active</span>
                            </div>
                        </div>

                        {/* Distribution Bar */}
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <span>Capital Distribution</span>
                                <span className="text-blue-400">{usedPercentage.toFixed(1)}% Active</span>
                            </div>
                            <div className="h-3 w-full bg-gray-950/50 rounded-full p-0.5 border border-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${Math.max(usedPercentage, 2)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] font-semibold">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-gray-400">Locked: ${balance.used?.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                                    <span className="text-emerald-400">Available: ${balance.free?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {mode === 'DEMO' && (
                <button
                    onClick={handleRequestFunds}
                    disabled={requesting}
                    className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold text-sm rounded-2xl border border-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    <Plus size={18} className="text-blue-500" />
                    {requesting ? 'Processing Request...' : 'Refill Demo Wallet'}
                </button>
            )}
        </div>
    );
}

