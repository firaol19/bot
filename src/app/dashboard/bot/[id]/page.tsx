import { prisma } from '@/lib/db';
import { BotControls } from '@/components/dashboard/BotControls';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { AnalyticsCard } from '@/components/dashboard/AnalyticsCard';
import { PriceChart } from '@/components/charts/PriceChart';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const bot = await prisma.bot.findUnique({
        where: { id },
        include: {
            positions: {
                where: { status: 'OPEN' },
                orderBy: { createdAt: 'desc' }
            },
            trades: {
                orderBy: { timestamp: 'desc' },
                take: 10
            }
        }
    });

    if (!bot) {
        notFound();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/dashboard" className="p-2 hover:bg-gray-800 rounded-lg transition">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            {bot.name}
                            <span className="text-sm px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-normal">
                                {bot.symbol}
                            </span>
                        </h1>
                        <p className="text-gray-400 text-sm">{bot.exchange.toUpperCase()} • {bot.mode} Mode</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <BotControls botId={bot.id} initialStatus={bot.status} />
                    <Link href={`/dashboard/bot/${bot.id}/settings`} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
                        <Settings size={20} />
                    </Link>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Chart & Stats */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Chart Card */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Market Overview</h3>
                        <PriceChart />
                    </div>

                    {/* Active Positions */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Active Positions</h3>
                        <PositionsTable positions={bot.positions} />
                    </div>
                </div>

                {/* Right Column: Info & History */}
                <div className="space-y-6">
                    {/* Performance Card */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Performance</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                                <span className="text-gray-400">Total Profit</span>
                                <span className={`text-xl font-bold ${bot.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ${bot.totalProfit.toFixed(2)}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-gray-500 block">Capital</span>
                                    <span className="font-medium">${bot.capital}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 block">Buy Amount</span>
                                    <span className="font-medium">{bot.buyPercentage}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Trades */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 text-gray-300">Recent Trades</h3>
                        <div className="space-y-3">
                            {bot.trades.length === 0 ? (
                                <p className="text-gray-500 text-sm">No trades yet</p>
                            ) : (
                                bot.trades.map((trade) => (
                                    <div key={trade.id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-800/50 rounded">
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                {trade.side}
                                            </span>
                                            <span className="text-gray-500 text-xs">
                                                {trade.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">${trade.price}</div>
                                            <div className="text-xs text-gray-500">{trade.amount} {bot.symbol.split('/')[0]}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
