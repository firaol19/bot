'use client';

import { useState } from 'react';
import { Shield, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

interface RiskSettingsProps {
    botId: string;
    initialSettings?: {
        stopLossPercentage?: number;
        takeProfitPercentage?: number;
        maxPositions?: number;
        maxDailyLoss?: number;
        trailingStopPercent?: number;
    };
    onSave?: (settings: any) => void;
}

export function RiskSettings({ botId, initialSettings, onSave }: RiskSettingsProps) {
    const [stopLoss, setStopLoss] = useState(initialSettings?.stopLossPercentage || 5);
    const [takeProfit, setTakeProfit] = useState(initialSettings?.takeProfitPercentage || 10);
    const [maxPositions, setMaxPositions] = useState(initialSettings?.maxPositions || 10);
    const [maxDailyLoss, setMaxDailyLoss] = useState(initialSettings?.maxDailyLoss || 0);
    const [trailingStop, setTrailingStop] = useState(initialSettings?.trailingStopPercent || 0);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/bot/${botId}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stopLossPercentage: stopLoss || null,
                    takeProfitPercentage: takeProfit || null,
                    maxPositions: maxPositions,
                    maxDailyLoss: maxDailyLoss || null,
                    trailingStopPercent: trailingStop || null,
                })
            });

            if (response.ok) {
                if (onSave) onSave({
                    stopLossPercentage: stopLoss,
                    takeProfitPercentage: takeProfit,
                    maxPositions,
                    maxDailyLoss,
                    trailingStopPercent: trailingStop
                });
                alert('Risk settings saved successfully!');
            } else {
                alert('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl font-bold">Risk Management Settings</h3>
            </div>

            <div className="space-y-6">
                {/* Stop Loss */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        Stop Loss Percentage
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={stopLoss}
                            onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            max="100"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400 w-12">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Automatically sell if loss reaches this percentage (0 to disable)
                    </p>
                </div>

                {/* Take Profit */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        Take Profit Percentage
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={takeProfit}
                            onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            max="1000"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400 w-12">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Automatically sell if profit reaches this percentage (0 to disable)
                    </p>
                </div>

                {/* Trailing Stop */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <TrendingUp className="w-4 h-4 text-yellow-400" />
                        Trailing Stop Percentage
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={trailingStop}
                            onChange={(e) => setTrailingStop(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            max="100"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400 w-12">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Sell if price drops this % from highest point (0 to disable)
                    </p>
                </div>

                {/* Max Positions */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                        Maximum Open Positions
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={maxPositions}
                            onChange={(e) => setMaxPositions(parseInt(e.target.value) || 1)}
                            min="1"
                            max="100"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400 w-12">pos</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Maximum number of positions the bot can open simultaneously
                    </p>
                </div>

                {/* Max Daily Loss */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        Maximum Daily Loss
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={maxDailyLoss}
                            onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value) || 0)}
                            step="1"
                            min="0"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400 w-12">$</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Bot will stop if daily loss exceeds this amount (0 to disable)
                    </p>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
                >
                    {saving ? 'Saving...' : 'Save Risk Settings'}
                </button>

                {/* Warning */}
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-200">
                            <p className="font-medium mb-1">Important Safety Notes:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs text-yellow-300">
                                <li>Stop loss and take profit are calculated per position</li>
                                <li>Trailing stop tracks the highest price since position opened</li>
                                <li>Daily loss limit resets at midnight UTC</li>
                                <li>Changes apply to new positions and existing open positions</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
