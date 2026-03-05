'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Info, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';

interface Notification {
    id: string;
    type: 'TRADE_BUY' | 'TRADE_SELL' | 'SYSTEM' | 'ERROR';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
}

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    // Mock for initial development - in real app this would use a websocket or context
    useEffect(() => {
        const mockNotifications: Notification[] = [
            {
                id: '1',
                type: 'TRADE_BUY',
                title: 'BTC/USDT Buy Executed',
                message: 'Bot Alpha executed a buy order at $52,430.21',
                timestamp: new Date(),
                read: false
            },
            {
                id: '2',
                type: 'SYSTEM',
                title: 'System Heartbeat',
                message: 'All strategy engines are operational and synced.',
                timestamp: new Date(Date.now() - 1000 * 60 * 5),
                read: true
            }
        ];
        setNotifications(mockNotifications);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="fixed top-6 right-6 z-[100]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-4 glass-effect rounded-2xl border-white/10 hover:border-blue-500/50 transition-all active:scale-95 group shadow-2xl"
            >
                <Bell size={24} className={`${unreadCount > 0 ? 'text-blue-400' : 'text-gray-600 dark:text-gray-400'} group-hover:text-gray-900 dark:text-white transition-colors`} />
                {unreadCount > 0 && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-blue-600 text-gray-900 dark:text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#05070a] animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            <div className={`absolute top-20 right-0 w-96 glass-effect rounded-[2rem] border-white/10 shadow-2xl transition-all duration-500 origin-top-right overflow-hidden ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 -translate-y-4 pointer-events-none'}`}>
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">Signal Center</h3>
                    <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                <ShieldCheck size={32} className="text-gray-600" />
                            </div>
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest">No active alerts</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div key={n.id} className={`p-4 rounded-2xl border transition-all ${n.read ? 'bg-white/2 border-white/5 opacity-60' : 'bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5'}`}>
                                <div className="flex gap-4">
                                    <div className={`p-2 rounded-xl h-fit ${getTypeStyles(n.type)}`}>
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-sm font-black text-gray-900 dark:text-white leading-none">{n.title}</h4>
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-500 uppercase">{formatTime(n.timestamp)}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{n.message}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                    <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors">
                        Clear All Signals
                    </button>
                </div>
            </div>
        </div>
    );
}

function getTypeStyles(type: string) {
    switch (type) {
        case 'TRADE_BUY': return 'bg-emerald-500/10 text-emerald-400';
        case 'TRADE_SELL': return 'bg-red-500/10 text-red-400';
        case 'ERROR': return 'bg-orange-500/10 text-orange-400';
        default: return 'bg-blue-500/10 text-blue-400';
    }
}

function getIcon(type: string) {
    switch (type) {
        case 'TRADE_BUY': return <TrendingUp size={16} />;
        case 'TRADE_SELL': return <TrendingDown size={16} />;
        case 'ERROR': return <AlertTriangle size={16} />;
        default: return <Info size={16} />;
    }
}

function formatTime(date: Date) {
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(date);
}
