'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, LineChart, Settings, Activity, LogOut } from 'lucide-react';
import { ViewModeToggle } from './ViewModeToggle';
import { useRouter } from 'next/navigation';

export function Sidebar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const queryString = searchParams.toString();
    const query = queryString ? `?${queryString}` : '';

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:flex h-screen w-64 bg-gray-900 text-white p-4 border-r border-gray-800 flex-col">
                <div className="text-xl font-bold mb-8 text-blue-500 flex items-center gap-2">
                    <ViewModeToggle />
                </div>

                <nav className="space-y-4 flex-1">
                    <Link href={`/dashboard${query}`} className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard' ? 'bg-gray-800 border-l-4 border-blue-500' : ''}`}>
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

                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 p-3 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition text-gray-400 mt-auto border-t border-gray-800 pt-6"
                >
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around p-3 z-50 pb-safe">
                <Link href={`/dashboard${query}`} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${pathname === '/dashboard' ? 'text-blue-500' : 'text-gray-400'}`}>
                    <Home size={20} />
                    <span className="text-[10px]">Home</span>
                </Link>
                <Link href={`/dashboard/bots${query}`} className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition">
                    <Activity size={20} />
                    <span className="text-[10px]">Bots</span>
                </Link>
                <Link href={`/dashboard/analytics${query}`} className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition">
                    <LineChart size={20} />
                    <span className="text-[10px]">Stats</span>
                </Link>
                <Link href={`/dashboard/settings${query}`} className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition">
                    <Settings size={20} />
                    <span className="text-[10px]">Settings</span>
                </Link>
                <button
                    onClick={handleLogout}
                    className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition"
                >
                    <LogOut size={20} />
                    <span className="text-[10px]">Logout</span>
                </button>
            </div>

            {/* Mobile Top Bar for View Toggle */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 z-40 flex items-center justify-end px-4">
                <ViewModeToggle />
            </div>
        </>
    );
}
