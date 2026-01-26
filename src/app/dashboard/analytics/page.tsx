import { prisma } from '@/lib/db';
import { AnalyticsCard } from '@/components/dashboard/AnalyticsCard';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams;
    const currentMode = view === 'real' ? 'REAL' : 'DEMO';

    // Fetch all finished trades filtered by mode
    const trades = await prisma.trade.findMany({
        orderBy: { timestamp: 'desc' },
        where: {
            side: 'SELL',
            bot: { mode: currentMode }
        }
    });

    // All trades for volume, filtered by mode
    const allTrades = await prisma.trade.findMany({
        orderBy: { timestamp: 'desc' },
        where: {
            bot: { mode: currentMode }
        }
    });

    const totalVolume = allTrades.reduce((acc, t) => acc + t.total, 0);
    const totalProfit = trades.reduce((acc, t) => acc + (t.profit || 0), 0);

    // Group by month/day for a chart? For now, stick to the AnalyticsCard + List

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Performance Analytics</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Overview */}
                <div className="lg:col-span-2 space-y-6">
                    <AnalyticsCard trades={allTrades} />

                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Recent Trade History</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-xs text-gray-500 border-b border-gray-800">
                                    <tr>
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Symbol</th>
                                        <th className="pb-2">Side</th>
                                        <th className="pb-2 text-right">Price</th>
                                        <th className="pb-2 text-right">Amount</th>
                                        <th className="pb-2 text-right">Total</th>
                                        <th className="pb-2 text-right">Profit</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-800">
                                    {allTrades.slice(0, 20).map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-800/50">
                                            <td className="py-3">{new Date(t.timestamp).toLocaleString()}</td>
                                            <td className="py-3">{t.symbol}</td>
                                            <td className={`py-3 font-bold ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                {t.side}
                                            </td>
                                            <td className="py-3 text-right">${t.price.toFixed(2)}</td>
                                            <td className="py-3 text-right">{t.amount}</td>
                                            <td className="py-3 text-right">${t.total.toFixed(2)}</td>
                                            <td className={`py-3 text-right ${t.profit && t.profit > 0 ? 'text-green-400' : (t.profit && t.profit < 0 ? 'text-red-400' : 'text-gray-500')}`}>
                                                {t.profit ? `$${t.profit.toFixed(2)}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Side Stats */}
                <div className="space-y-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Global Stats</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total Profit</span>
                                <span className={`font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ${totalProfit.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total Volume</span>
                                <span className="text-white">${totalVolume.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Trades Executed</span>
                                <span className="text-white">{allTrades.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
