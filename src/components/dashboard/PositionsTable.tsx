'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface Position {
    id: string;
    symbol: string;
    amount: number;
    entryPrice: number;
    currentPrice?: number | null;
    pnl?: number | null;
    status: string;
    createdAt: string;
}

interface PositionsTableProps {
    positions: Position[];
    botId?: string;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    onClosePosition?: (positionId: string) => void;
}

export function PositionsTable({
    positions,
    botId,
    stopLossPercent,
    takeProfitPercent,
    onClosePosition
}: PositionsTableProps) {
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [closing, setClosing] = useState<string | null>(null);

    useEffect(() => {
        if (positions.length === 0) return;

        // Get unique symbols
        const symbols = Array.from(new Set(positions.map(p => p.symbol)));

        const fetchPrices = async () => {
            const newPrices: Record<string, number> = {};
            await Promise.all(symbols.map(async (sym) => {
                try {
                    const res = await fetch(`/api/market/ticker?symbol=${sym}`);
                    const data = await res.json();
                    if (data.price) newPrices[sym] = data.price;
                } catch (e) {
                    console.error(e);
                }
            }));
            setPrices(prev => ({ ...prev, ...newPrices }));
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 5000); // Update every 5s
        return () => clearInterval(interval);
    }, [positions]);

    const handleClosePosition = async (positionId: string) => {
        if (!confirm('Are you sure you want to manually close this position?')) return;

        setClosing(positionId);
        try {
            const response = await fetch(`/api/position/${positionId}/close`, {
                method: 'POST',
            });

            if (response.ok) {
                if (onClosePosition) onClosePosition(positionId);
                alert('Position closed successfully');
            } else {
                alert('Failed to close position');
            }
        } catch (error) {
            console.error('Error closing position:', error);
            alert('Error closing position');
        } finally {
            setClosing(null);
        }
    };

    const getPositionAge = (createdAt: string) => {
        const created = new Date(createdAt);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) return `${diffMins}m`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d`;
    };

    if (positions.length === 0) {
        return <div className="text-gray-500 text-center py-8">No open positions</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-sm">
                        <th className="pb-3">Symbol</th>
                        <th className="pb-3 text-right">Size</th>
                        <th className="pb-3 text-right">Entry</th>
                        <th className="pb-3 text-right">Current</th>
                        <th className="pb-3 text-right">PnL</th>
                        <th className="pb-3 text-right">Stop Loss</th>
                        <th className="pb-3 text-right">Take Profit</th>
                        <th className="pb-3 text-center">Age</th>
                        {botId && <th className="pb-3 text-center">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {positions.map((pos) => {
                        const currentPrice = prices[pos.symbol] || pos.currentPrice || 0;
                        const pnl = currentPrice ? (currentPrice - pos.entryPrice) * pos.amount : 0;
                        const pnlPercent = currentPrice ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
                        const isProfit = pnl >= 0;

                        // Calculate stop loss and take profit levels
                        const stopLoss = stopLossPercent ? pos.entryPrice * (1 - stopLossPercent / 100) : null;
                        const takeProfit = takeProfitPercent ? pos.entryPrice * (1 + takeProfitPercent / 100) : null;

                        // Check if close to stop loss or take profit
                        const nearStopLoss = stopLoss && currentPrice <= stopLoss * 1.02; // Within 2%
                        const nearTakeProfit = takeProfit && currentPrice >= takeProfit * 0.98; // Within 2%

                        return (
                            <tr
                                key={pos.id}
                                className={`group hover:bg-gray-900/50 ${nearStopLoss ? 'bg-red-900/10' : nearTakeProfit ? 'bg-green-900/10' : ''}`}
                            >
                                <td className="py-3 md:py-4 font-medium min-w-[80px]">{pos.symbol}</td>
                                <td className="py-3 md:py-4 text-right text-gray-300">
                                    {pos.amount.toFixed(6)}
                                </td>
                                <td className="py-3 md:py-4 text-right text-gray-300">
                                    ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </td>
                                <td className="py-3 md:py-4 text-right text-gray-300">
                                    {currentPrice ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td className={`py-3 md:py-4 text-right font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                    {currentPrice ? (
                                        <div className="flex items-center justify-end gap-1">
                                            {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                            <span>
                                                ${pnl.toFixed(2)} <span className="text-xs opacity-75">({pnlPercent.toFixed(2)}%)</span>
                                            </span>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="py-3 md:py-4 text-right text-sm">
                                    {stopLoss ? (
                                        <span className={nearStopLoss ? 'text-red-400 font-medium' : 'text-gray-400'}>
                                            ${stopLoss.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600">-</span>
                                    )}
                                </td>
                                <td className="py-3 md:py-4 text-right text-sm">
                                    {takeProfit ? (
                                        <span className={nearTakeProfit ? 'text-green-400 font-medium' : 'text-gray-400'}>
                                            ${takeProfit.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600">-</span>
                                    )}
                                </td>
                                <td className="py-3 md:py-4 text-center">
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        {getPositionAge(pos.createdAt)}
                                    </span>
                                </td>
                                {botId && (
                                    <td className="py-3 md:py-4 text-center">
                                        <button
                                            onClick={() => handleClosePosition(pos.id)}
                                            disabled={closing === pos.id}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            title="Manually close this position"
                                        >
                                            <X className="w-3 h-3" />
                                            {closing === pos.id ? 'Closing...' : 'Close'}
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between text-sm">
                <span className="text-gray-400">Total Positions: {positions.length}</span>
                <span className="text-gray-400">
                    Total Unrealized PnL:
                    <span className={`ml-2 font-medium ${positions.reduce((sum, pos) => {
                        const currentPrice = prices[pos.symbol] || pos.currentPrice || 0;
                        return sum + (currentPrice ? (currentPrice - pos.entryPrice) * pos.amount : 0);
                    }, 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                        ${positions.reduce((sum, pos) => {
                            const currentPrice = prices[pos.symbol] || pos.currentPrice || 0;
                            return sum + (currentPrice ? (currentPrice - pos.entryPrice) * pos.amount : 0);
                        }, 0).toFixed(2)}
                    </span>
                </span>
            </div>
        </div>
    );
}
