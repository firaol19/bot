'use client';

import { useState } from 'react';
import { Play, Pause, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BotControlsProps {
    botId: string;
    initialStatus: string;
}

export function BotControls({ botId, initialStatus }: BotControlsProps) {
    const router = useRouter();
    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);

    const toggleBot = async () => {
        setLoading(true);
        try {
            const action = status === 'RUNNING' ? 'stop' : 'start';
            const res = await fetch(`/api/bot/${botId}/${action}`, { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setStatus(status === 'RUNNING' ? 'STOPPED' : 'RUNNING');
                router.refresh();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to toggle bot');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <div className={`flex items-center px-4 py-2 rounded-lg ${status === 'RUNNING' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${status === 'RUNNING' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                {status}
            </div>

            <button
                onClick={toggleBot}
                disabled={loading}
                className={`flex items-center px-6 py-2 rounded-lg font-medium transition ${status === 'RUNNING'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {loading ? (
                    'Processing...'
                ) : status === 'RUNNING' ? (
                    <>
                        <Pause size={18} className="mr-2" /> Stop Bot
                    </>
                ) : (
                    <>
                        <Play size={18} className="mr-2" /> Start Bot
                    </>
                )}
            </button>
        </div>
    );
}
