'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@/lib/db'; // This won't work in Client Component, need Server Action or API
// We will use API for creation to keep it simple

export default function CreateBotPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMode = searchParams.get('view') === 'real' ? 'REAL' : 'DEMO';

    const [formData, setFormData] = useState({
        name: '',
        symbol: 'BTC/USDT',
        capital: 0, // Will be synced
        buyPercentage: 10,
        sellPercentage: 0.3,
        buyDrop: 0.3,
        exchange: 'bybit',
        mode: initialMode,
        apiKey: '',
        apiSecret: ''
    });
    const [loading, setLoading] = useState(false);

    // Fetch balance on mount to show user
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await fetch(`/api/wallet/balance?mode=${initialMode}`);
                const data = await res.json();
                if (data.free) {
                    setFormData(prev => ({ ...prev, capital: data.free }));
                }
            } catch (error) {
                console.error('Failed to fetch balance', error);
            }
        };
        fetchBalance();
    }, [initialMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // We need an API route for creating a bot. 
            // For now, I'll mock the fetch or we quickly create the API route.
            const res = await fetch('/api/bot/create', {
                method: 'POST',
                body: JSON.stringify(formData),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                router.push('/dashboard');
                router.refresh();
            } else {
                alert('Failed to create bot');
            }
        } catch (error) {
            console.error(error);
            alert('Error creating bot');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
                <Link href={`/dashboard?view=${initialMode === 'REAL' ? 'real' : 'demo'}`} className="p-2 hover:bg-gray-800 rounded-lg transition">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Create New Bot</h1>
                    <p className="text-gray-400 text-sm">Mode: <span className={initialMode === 'REAL' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>{initialMode === 'REAL' ? 'Real Trading' : 'Demo Mode'}</span></p>
                </div>
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
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Current Balance (USDT)</label>
                        <input
                            type="number"
                            disabled
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-300 font-bold bg-gray-900/50"
                            value={formData.capital}
                        // Capital will be synced from exchange
                        />
                        <p className="text-xs text-gray-500 mt-1">Automatically fetched from your wallet.</p>
                    </div>
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
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Buy Trigger (Drop %)</label>
                        <input
                            type="number"
                            required
                            step="0.1"
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.buyDrop}
                            onChange={e => setFormData({ ...formData, buyDrop: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Sell Profit (Target %)</label>
                        <input
                            type="number"
                            required
                            step="0.1"
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.sellPercentage}
                            onChange={e => setFormData({ ...formData, sellPercentage: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold mb-4 text-white">Exchange Connection</h3>
                    <p className="text-sm text-gray-500 mb-4">Required to fetch balance and execute trades (even for Demo mode if using Testnet).</p>

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Bybit API Key</label>
                            <input
                                type="text"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                                value={formData.apiKey}
                                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                placeholder="Enter API Key"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Bybit API Secret</label>
                            <input
                                type="password"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                                value={formData.apiSecret}
                                onChange={e => setFormData({ ...formData, apiSecret: e.target.value })}
                                placeholder="Enter API Secret"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50"
                >
                    {loading ? 'Creating Bot...' : 'Create Bot'}
                </button>

            </form>
        </div>
    );
}
