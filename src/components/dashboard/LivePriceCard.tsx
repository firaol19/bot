'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface LivePriceCardProps {
    symbol: string;
    initialPrice?: number;
}

export function LivePriceCard({ symbol, initialPrice = 0 }: LivePriceCardProps) {
    const [currentPrice, setCurrentPrice] = useState(initialPrice);
    const [previousPrice, setPreviousPrice] = useState(initialPrice);
    const [priceChange, setPriceChange] = useState(0);
    const [lastUpdate, setLastUpdate] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`/api/market/ticker?symbol=${symbol}`);
                const data = await res.json();

                if (data.price) {
                    setPreviousPrice(currentPrice);
                    setCurrentPrice(data.price);

                    // Calculate price change percentage
                    if (previousPrice > 0) {
                        const change = ((data.price - previousPrice) / previousPrice) * 100;
                        setPriceChange(change);
                    }

                    setLastUpdate(0);
                }
            } catch (error) {
                console.error('Failed to fetch price:', error);
            } finally {
                setIsLoading(false);
            }
        };

        // Initial fetch
        fetchPrice();

        // Poll every 2 seconds
        const priceInterval = setInterval(fetchPrice, 2000);

        // Update "last update" counter every second
        const updateInterval = setInterval(() => {
            setLastUpdate(prev => prev + 1);
        }, 1000);

        return () => {
            clearInterval(priceInterval);
            clearInterval(updateInterval);
        };
    }, [symbol]);

    const priceDirection = currentPrice > previousPrice ? 'up' : currentPrice < previousPrice ? 'down' : 'neutral';

    return (
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm text-gray-400 mb-1">Current Price</h3>
                    <p className="text-xs text-gray-500">{symbol}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${isLoading ? 'animate-pulse text-blue-400' : 'text-gray-500'}`} />
                    <span className="text-xs text-gray-500">
                        {lastUpdate}s ago
                    </span>
                </div>
            </div>

            <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-white">
                    ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>

                {priceDirection !== 'neutral' && (
                    <div className={`flex items-center gap-1 ${priceDirection === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                        {priceDirection === 'up' ? (
                            <TrendingUp className="w-5 h-5" />
                        ) : (
                            <TrendingDown className="w-5 h-5" />
                        )}
                        <span className="text-lg font-medium">
                            {Math.abs(priceChange).toFixed(2)}%
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-blue-800/30">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Previous</span>
                    <span className="text-gray-300">
                        ${previousPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    );
}
