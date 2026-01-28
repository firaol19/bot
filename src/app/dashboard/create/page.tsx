'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function CreateBotPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMode = searchParams.get('view') === 'real' ? 'REAL' : 'DEMO';

    const [formData, setFormData] = useState({
        name: '',
        symbol: 'BTC/USDT',
        capitalAllocation: 0, // Amount user wants to allocate
        buyPercentage: 10,
        sellPercentage: 0.3,
        buyDrop: 0.3,
        exchange: 'bybit',
        mode: initialMode,
        stopLossPercentage: 0,
        takeProfitPercentage: 0,
        trailingStopPercent: 0,
        maxPositions: 10,
        maxDailyLoss: 0,
    });

    const [availableBalance, setAvailableBalance] = useState(0);
    const [loadingBalance, setLoadingBalance] = useState(true);
    const [loading, setLoading] = useState(false);
    const [balanceError, setBalanceError] = useState('');

    // Fetch balance on mount
    useEffect(() => {
        fetchBalance();
    }, [initialMode]);

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
                // Set default allocation to 50% of available balance or $100, whichever is smaller
                const defaultAllocation = Math.min(data.free * 0.5, 100);
                setFormData(prev => ({ ...prev, capitalAllocation: parseFloat(defaultAllocation.toFixed(2)) }));
            }
        } catch (error) {
            console.error('Failed to fetch balance', error);
            setBalanceError('Failed to connect to exchange');
            setAvailableBalance(0);
        } finally {
            setLoadingBalance(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate capital allocation
        const tradeValue = formData.capitalAllocation * (formData.buyPercentage / 100);
        if (tradeValue < 1.1) {
            alert(`Trade size for each order ($${tradeValue.toFixed(2)}) is too small. Bybit requires at least $1.00 USDT per trade. Please increase your Capital Allocation or your Position Size % so that each trade is at least $1.10 USDT.`);
            return;
        }

        if (formData.capitalAllocation > availableBalance) {
            alert(`Capital allocation ($${formData.capitalAllocation}) cannot exceed available balance ($${availableBalance.toFixed(2)})`);
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/bot/create', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    capital: formData.capitalAllocation, // Use allocation as capital
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
            console.error(error);
            alert('Error creating bot');
        } finally {
            setLoading(false);
        }
    };

    const allocationPercentage = availableBalance > 0
        ? ((formData.capitalAllocation / availableBalance) * 100).toFixed(1)
        : '0';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
                <Link href={`/dashboard?view=${initialMode === 'REAL' ? 'real' : 'demo'}`} className="p-2 hover:bg-gray-800 rounded-lg transition">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Create New Bot</h1>
                    <p className="text-gray-400 text-sm">
                        Mode: <span className={initialMode === 'REAL' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>
                            {initialMode === 'REAL' ? 'Real Trading' : 'Demo Mode'}
                        </span>
                    </p>
                </div>
            </div>

            {/* Balance Card */}
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-semibold">Available Balance</h3>
                    </div>
                    <button
                        onClick={fetchBalance}
                        disabled={loadingBalance}
                        className="p-2 hover:bg-blue-900/30 rounded-lg transition disabled:opacity-50"
                        title="Refresh balance"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingBalance ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loadingBalance ? (
                    <div className="text-gray-400">Loading balance...</div>
                ) : balanceError ? (
                    <div className="flex items-start gap-2 text-yellow-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">{balanceError}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Using API keys from .env file. Make sure they are configured correctly.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-3xl font-bold text-white mb-1">
                            ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </p>
                        <p className="text-xs text-gray-400">
                            Fetched from {initialMode === 'REAL' ? 'Bybit Mainnet' : 'Bybit Demo'} using environment API keys
                        </p>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-900 p-8 rounded-xl border border-gray-800">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Bot Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. BTC Grid Scalper"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Symbol</label>
                        <select
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.symbol}
                            onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                        >
                            <option value="BTC/USDT">BTC/USDT</option>
                            <option value="ETH/USDT">ETH/USDT</option>
                            <option value="SOL/USDT">SOL/USDT</option>
                            <option value="XRP/USDT">XRP/USDT</option>
                            <option value="DOGE/USDT">DOGE/USDT</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Capital Allocation (USDT)
                    </label>
                    <input
                        type="number"
                        required
                        min="0.01"
                        max={availableBalance}
                        step="0.01"
                        disabled={loadingBalance || availableBalance === 0}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                        value={formData.capitalAllocation}
                        onChange={e => setFormData({ ...formData, capitalAllocation: parseFloat(e.target.value) || 0 })}
                        placeholder="Enter amount to allocate"
                    />
                    <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">
                            Amount to allocate for this bot (max: ${availableBalance.toFixed(2)})
                        </p>
                        <p className={`text-xs font-medium ${formData.capitalAllocation > availableBalance ? 'text-red-400' : 'text-blue-400'
                            }`}>
                            {allocationPercentage}% of balance
                        </p>
                    </div>

                    {/* Quick allocation buttons */}
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, capitalAllocation: parseFloat((availableBalance * 0.25).toFixed(2)) })}
                            disabled={loadingBalance || availableBalance === 0}
                            className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition disabled:opacity-50"
                        >
                            25%
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, capitalAllocation: parseFloat((availableBalance * 0.5).toFixed(2)) })}
                            disabled={loadingBalance || availableBalance === 0}
                            className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition disabled:opacity-50"
                        >
                            50%
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, capitalAllocation: parseFloat((availableBalance * 0.75).toFixed(2)) })}
                            disabled={loadingBalance || availableBalance === 0}
                            className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition disabled:opacity-50"
                        >
                            75%
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, capitalAllocation: parseFloat(availableBalance.toFixed(2)) })}
                            disabled={loadingBalance || availableBalance === 0}
                            className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition disabled:opacity-50"
                        >
                            100%
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Position Size (% of Capital)</label>
                        <input
                            type="number"
                            required
                            min="1"
                            max="100"
                            step="0.1"
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.buyPercentage}
                            onChange={e => setFormData({ ...formData, buyPercentage: Number(e.target.value) })}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Percentage of allocated capital per trade
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Buy Trigger (Drop %)</label>
                        <input
                            type="number"
                            required
                            step="0.1"
                            min="0.1"
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.buyDrop}
                            onChange={e => setFormData({ ...formData, buyDrop: Number(e.target.value) })}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Buy when price drops by this %
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Sell Profit (Target %)</label>
                    <input
                        type="number"
                        required
                        step="0.1"
                        min="0.1"
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                        value={formData.sellPercentage}
                        onChange={e => setFormData({ ...formData, sellPercentage: Number(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Sell when profit reaches this %
                    </p>
                </div>

                <div className="border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold mb-4 text-white">Risk Management</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Stop Loss (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-red-500 outline-none transition"
                                value={formData.stopLossPercentage}
                                onChange={e => setFormData({ ...formData, stopLossPercentage: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-600 mt-1">0 to disable</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Take Profit (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-green-500 outline-none transition"
                                value={formData.takeProfitPercentage}
                                onChange={e => setFormData({ ...formData, takeProfitPercentage: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-600 mt-1">0 to disable</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Trailing Stop (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                                value={formData.trailingStopPercent}
                                onChange={e => setFormData({ ...formData, trailingStopPercent: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-600 mt-1">0 to disable</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Max Positions</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                                value={formData.maxPositions}
                                onChange={e => setFormData({ ...formData, maxPositions: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Max Daily Loss (USDT)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-red-500 outline-none transition"
                                value={formData.maxDailyLoss}
                                onChange={e => setFormData({ ...formData, maxDailyLoss: Number(e.target.value) })}
                            />
                            <p className="text-xs text-gray-600 mt-1">0 to disable</p>
                        </div>
                    </div>
                </div>

                {/* Info box */}
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-200">
                            <p className="font-medium mb-1">API Keys from Environment</p>
                            <p className="text-xs text-blue-300">
                                This bot will use the API keys configured in your .env file.
                                Make sure <code className="bg-blue-950/50 px-1 rounded">BYBIT_API_KEY</code> and{' '}
                                <code className="bg-blue-950/50 px-1 rounded">BYBIT_API_SECRET</code> are set correctly
                                for {initialMode === 'REAL' ? 'mainnet' : 'demo'} trading.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || loadingBalance || availableBalance === 0 || formData.capitalAllocation > availableBalance}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Creating Bot...' : 'Create Bot'}
                </button>

            </form>
        </div>
    );
}
