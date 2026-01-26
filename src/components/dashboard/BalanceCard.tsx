'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

export function BalanceCard({ mode = 'DEMO' }: { mode?: string }) {
    const [balance, setBalance] = useState({ total: 0, free: 0, used: 0 });
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);

    const fetchBalance = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/wallet/balance?mode=${mode}`);
            const data = await res.json();
            setBalance(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [mode]);

    const handleRequestFunds = async () => {
        setRequesting(true);
        try {
            const res = await fetch('/api/wallet/faucet', {
                method: 'POST',
                body: JSON.stringify({ mode: 'DEMO' }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok) {
                alert('Success! Funds requested. It may take a few moments to reflect.');
                fetchBalance();
            } else {
                alert(`Failed: ${data.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error requesting funds');
        } finally {
            setRequesting(false);
        }
    };

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 relative">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2 text-gray-400 text-sm">
                    <Wallet size={16} />
                    <h3>Wallet Balance (USDT)</h3>
                </div>
                {mode === 'DEMO' && (
                    <button
                        onClick={handleRequestFunds}
                        disabled={requesting}
                        className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 px-2 py-1 rounded border border-blue-900/50 transition disabled:opacity-50"
                    >
                        {requesting ? 'Requesting...' : 'Refill Demo Funds'}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="animate-pulse h-8 w-24 bg-gray-800 rounded"></div>
            ) : (
                <div className="space-y-1">
                    <p className="text-3xl font-bold text-white">
                        ${balance.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="text-xs text-gray-500 flex justify-between">
                        <span>Available: ${balance.free?.toFixed(2)}</span>
                        <span>In Order: ${balance.used?.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
