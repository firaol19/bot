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
        apiSecret: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

    return (
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
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50"
            >
                {loading ? 'Saving Changes...' : 'Save Settings'}
            </button>
        </form>
    );
}
