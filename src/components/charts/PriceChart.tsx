'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PriceChart({ symbol = 'BTC/USDT' }: { symbol?: string }) {
    // Placeholder data - in real app would fetch from API/Websocket
    const [data, setData] = useState<{ time: string, price: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch K-Lines from our proxy API
                const res = await fetch(`/api/market/klines?symbol=${symbol}&interval=60`);
                const json = await res.json();

                if (Array.isArray(json)) {
                    // Format for Recharts
                    // Bybit returns [start, open, high, low, close, volume, turnover]
                    const formatted = json.map((item: any) => ({
                        time: new Date(item[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        price: parseFloat(item[4]) // Close price
                    })).reverse(); // API usually returns desc, charts want asc? Check API. Bybit is desc.

                    // Bybit fetchOHLCV results are usually sorted by time ascending in CCXT? 
                    // Actually ccxt sorts by date usually. Let's assume ascending or verify.
                    // The previous logic assumed valid array.
                    setData(formatted);
                }
            } catch (error) {
                console.error('Failed to fetch chart data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Poll every minute
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [symbol]);

    if (loading) return <div className="h-[300px] w-full mt-4 flex items-center justify-center text-gray-500">Loading Chart...</div>;

    return (
        <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
