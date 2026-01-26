'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, LineChart, Settings, Activity } from 'lucide-react';
import { ViewModeToggle } from './ViewModeToggle';

export function Sidebar() {
    const searchParams = useSearchParams();
    const queryString = searchParams.toString();
    const query = queryString ? `?${queryString}` : '';

    return (
        <div className="h-screen w-64 bg-gray-900 text-white p-4 border-r border-gray-800">
            <div className="text-xl font-bold mb-8 text-green-400">CryptoBot</div>

            <ViewModeToggle />

            <nav className="space-y-4">
                <Link href={`/dashboard${query}`} className="flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition">
                    <Home size={20} />
                    <span>Dashboard</span>
                </Link>
                <Link href={`/dashboard/bots${query}`} className="flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition">
                    <Activity size={20} />
                    <span>Active Bots</span>
                </Link>
                <Link href={`/dashboard/analytics${query}`} className="flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition">
                    <LineChart size={20} />
                    <span>Analytics</span>
                </Link>
                <Link href={`/dashboard/settings${query}`} className="flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition">
                    <Settings size={20} />
                    <span>Settings</span>
                </Link>
            </nav>
        </div>
    );
}
