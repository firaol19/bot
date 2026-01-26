'use client';

interface Trade {
    side: string;
    profit?: number | null;
    total: number;
}

export function AnalyticsCard({ trades }: { trades: Trade[] }) {
    const closedTrades = trades.filter(t => t.side === 'SELL');
    const totalTrades = closedTrades.length;

    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.profit || 0) <= 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const grossProfit = closedTrades.reduce((acc, t) => acc + (t.profit && t.profit > 0 ? t.profit : 0), 0);
    const grossLoss = closedTrades.reduce((acc, t) => acc + (t.profit && t.profit < 0 ? Math.abs(t.profit) : 0), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 100 : 0;

    const totalVolume = trades.reduce((acc, t) => acc + t.total, 0);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-gray-300">Strategy Analytics</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-950 rounded-lg">
                    <span className="text-xs text-gray-500 block">Win Rate</span>
                    <span className={`font-bold text-lg ${winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {winRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-600 block mt-1">{winningTrades}W - {losingTrades}L</span>
                </div>
                <div className="p-3 bg-gray-950 rounded-lg">
                    <span className="text-xs text-gray-500 block">Profit Factor</span>
                    <span className={`font-bold text-lg ${profitFactor >= 1.5 ? 'text-green-400' : 'text-gray-300'}`}>
                        {profitFactor.toFixed(2)}
                    </span>
                </div>
                <div className="p-3 bg-gray-950 rounded-lg">
                    <span className="text-xs text-gray-500 block">Total Volume</span>
                    <span className="font-medium text-gray-300">
                        ${totalVolume.toLocaleString()}
                    </span>
                </div>
                <div className="p-3 bg-gray-950 rounded-lg">
                    <span className="text-xs text-gray-500 block">Avg. Profit</span>
                    <span className={`font-medium ${grossProfit - grossLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${totalTrades > 0 ? ((grossProfit - grossLoss) / totalTrades).toFixed(2) : '0.00'}
                    </span>
                </div>
            </div>
        </div>
    );
}
