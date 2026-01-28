'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BotSettingsForm({ bot }: { bot: any }) {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: bot.name,
        capital: bot.capital,
        buyPercentage: bot.buyPercentage,
        sellPercentage: bot.sellPercentage,
        buyDrop: bot.buyDrop,
        mode: bot.mode,
        apiKey: '', // Don't show existing encrypted keys
        apiSecret: '',
        stopLossPercentage: bot.stopLossPercentage || 0,
        takeProfitPercentage: bot.takeProfitPercentage || 0,
        trailingStopPercent: bot.trailingStopPercent || 0,
        maxPositions: bot.maxPositions || 10,
        maxDailyLoss: bot.maxDailyLoss || 0,
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate trade value (Bybit minimum is $1.00 USDT)
        // We use capital from formData as the base
        const tradeValue = formData.capital * (formData.buyPercentage / 100);
        if (tradeValue < 1.1) {
            alert(`Trade size for each order ($${tradeValue.toFixed(2)}) is too small. Bybit requires at least $1.00 USDT per trade. Please increase your Capital or Position Size % so that each trade is at least $1.10 USDT.`);
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`/api/bot/${bot.id}/update`, {
                method: 'POST', // or PATCH
                body: JSON.stringify(formData),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                router.refresh();
                alert('Settings saved successfully');
            } else {
                alert('Failed to update settings');
            }
        } catch (error) {
            console.error(error);
            alert('Error updating settings');
        } finally {
            setLoading(false);
        }
    };

    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm('ARE YOU SURE? This will permanently delete the bot and ALL its trade history, logs, and alerts. This action cannot be undone.')) {
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch(`/api/bot/${bot.id}/delete`, {
                method: 'POST'
            });

            if (res.ok) {
                router.push('/dashboard');
                router.refresh();
            } else {
                const error = await res.json();
                alert(`Failed to delete bot: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error deleting bot');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
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
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Mode</label>
                        <select
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                            value={formData.mode}
                            onChange={e => setFormData({ ...formData, mode: e.target.value })}
                        >
                            <option value="DEMO">Demo Mode</option>
                            <option value="REAL">Real Trading</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Current Balance (USDT)</label>
                        <input
                            type="number"
                            disabled
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-500 cursor-not-allowed"
                            value={formData.capital}
                        // Capital is now managed by Bot Engine fetching from Exchange
                        />
                        <p className="text-xs text-gray-600 mt-1">Automatically updated from exchange balance</p>
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

                <div className="border-t border-gray-800 pt-6 mt-6">
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

                <div className="border-t border-gray-800 pt-6 mt-6">
                    <h3 className="text-lg font-semibold mb-4 text-white">API Configuration (Optional)</h3>
                    <p className="text-sm text-gray-500 mb-4">Leave empty to keep existing keys. Required for Real Trading mode.</p>

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Bybit API Key</label>
                            <input
                                type="text"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                                value={formData.apiKey}
                                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                placeholder="Enter new API Key to update"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Bybit API Secret</label>
                            <input
                                type="password"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                                value={formData.apiSecret}
                                onChange={e => setFormData({ ...formData, apiSecret: e.target.value })}
                                placeholder="Enter new API Secret to update"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || deleting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50"
                >
                    {loading ? 'Saving Changes...' : 'Save Settings'}
                </button>
            </form>

            <div className="bg-red-900/10 border border-red-900/50 p-8 rounded-xl">
                <h3 className="text-lg font-bold text-red-400 mb-2">Danger Zone</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Once you delete a bot, there is no going back. Please be certain.
                </p>
                <button
                    onClick={handleDelete}
                    disabled={loading || deleting}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50"
                >
                    {deleting ? 'Deleting...' : 'Delete Bot Permanently'}
                </button>
            </div>
        </div>
    );
}
