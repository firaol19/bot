'use client';

import { useEffect, useState } from 'react';

interface Position {
    id: string;
    symbol: string;
    amount: number;
    entryPrice: number;
    currentPrice?: number | null;
    pnl?: number | null;
    status: string;
}

export function PositionsTable({ positions }: { positions: Position[] }) {
    const [prices, setPrices] = useState<Record<string, number>>({});

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
                        <th className="pb-3 text-right">Entry Price</th>
                        <th className="pb-3 text-right">Current Price</th>
                        <th className="pb-3 text-right">Unrealized PnL</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {positions.map((pos) => {
                        const currentPrice = prices[pos.symbol] || pos.currentPrice || 0;
                        const pnl = currentPrice ? (currentPrice - pos.entryPrice) * pos.amount : 0;
                        const pnlPercent = currentPrice ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
                        const isProfit = pnl >= 0;

                        return (
                            <tr key={pos.id} className="group hover:bg-gray-900/50">
                                <td className="py-4 font-medium">{pos.symbol}</td>
                                <td className="py-4 text-right text-gray-300">{pos.amount}</td>
                                <td className="py-4 text-right text-gray-300">
                                    ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </td>
                                <td className="py-4 text-right text-gray-300">
                                    {currentPrice ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td className={`py-4 text-right font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                    {currentPrice ? (
                                        <>
                                            ${pnl.toFixed(2)} <span className="text-xs opacity-75">({pnlPercent.toFixed(2)}%)</span>
                                        </>
                                    ) : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
