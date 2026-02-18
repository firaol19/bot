import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, LineChart, Settings, Activity, LogOut, Zap, Plus, Menu, X } from 'lucide-react';
import { ViewModeToggle } from './ViewModeToggle';
import { useRouter } from 'next/navigation';

export function Sidebar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    const NavLinks = () => (
        <nav className="space-y-4 flex-1">
            <Link
                href={`/dashboard${query}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard' ? 'bg-gray-800 border-l-4 border-blue-500' : ''}`}
            >
                <Home size={20} />
                <span>Dashboard</span>
            </Link>
            <Link
                href={`/dashboard/bots${query}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard/bots' ? 'bg-gray-800 border-l-4 border-blue-500' : ''}`}
            >
                <Activity size={20} />
                <span>Active Bots</span>
            </Link>
            <Link
                href={`/dashboard/analytics${query}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard/analytics' ? 'bg-gray-800 border-l-4 border-blue-500' : ''}`}
            >
                <LineChart size={20} />
                <span>Analytics</span>
            </Link>

            <div className="pt-2 pb-1 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Features Bot
            </div>

            <Link
                href={`/dashboard/features${query}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard/features' ? 'bg-gray-800 border-l-4 border-yellow-500' : ''}`}
            >
                <Plus size={20} className="text-yellow-400" />
                <span className="text-yellow-500/80 font-medium">Create Bot</span>
            </Link>
            <Link
                href={`/dashboard/features/manage${query}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard/features/manage' ? 'bg-gray-800 border-l-4 border-blue-400' : ''}`}
            >
                <Activity size={20} className="text-blue-400" />
                <span className="text-blue-400 font-medium">Manage Bots</span>
            </Link>

            <Link
                href={`/dashboard/settings${query}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-lg transition ${pathname === '/dashboard/settings' ? 'bg-gray-800 border-l-4 border-gray-500' : ''}`}
            >
                <Settings size={20} />
                <span>Settings</span>
            </Link>
        </nav>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:flex h-screen w-64 bg-gray-900 text-white p-4 border-r border-gray-800 flex-col overflow-y-auto">
                <div className="text-xl font-bold mb-8 text-blue-500 flex items-center gap-2">
                    <ViewModeToggle />
                </div>

                <NavLinks />

                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 p-3 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition text-gray-400 mt-auto border-t border-gray-800 pt-6"
                >
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>

            {/* Mobile Sidebar (Drawer) */}
            <div className={`md:hidden fixed inset-0 z-[100] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                {/* Drawer Content */}
                <div className={`absolute left-0 top-0 bottom-0 w-72 bg-gray-950 border-r border-gray-800 p-6 flex flex-col transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex items-center justify-between mb-8">
                        <div className="scale-90 origin-left">
                            <ViewModeToggle />
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <NavLinks />

                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 p-3 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition text-gray-400 mt-auto border-t border-gray-800 pt-6"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Mobile Bottom Nav - Kept for quick access but could be removed if drawer is preferred */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-950/80 backdrop-blur-xl border-t border-gray-800 flex justify-around p-3 z-50 pb-safe shadow-[0_-4px_20px_0_rgba(0,0,0,0.5)]">
                <Link href={`/dashboard${query}`} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${pathname === '/dashboard' ? 'text-blue-500' : 'text-gray-400'}`}>
                    <Home size={20} />
                    <span className="text-[10px]">Home</span>
                </Link>
                <Link href={`/dashboard/bots${query}`} className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition">
                    <Activity size={20} />
                    <span className="text-[10px]">Bots</span>
                </Link>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="flex flex-col items-center gap-1 p-2 text-yellow-500 transition relative -top-2"
                >
                    <div className="bg-yellow-500/10 p-2 rounded-full border border-yellow-500/20 shadow-lg shadow-yellow-500/20">
                        <Menu size={24} />
                    </div>
                </button>
                <Link href={`/dashboard/analytics${query}`} className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition">
                    <LineChart size={20} />
                    <span className="text-[10px]">Stats</span>
                </Link>
                <Link href={`/dashboard/settings${query}`} className="flex flex-col items-center gap-1 p-2 text-gray-400 rounded-lg transition">
                    <Settings size={20} />
                    <span className="text-[10px]">Settings</span>
                </Link>
            </div>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800 z-40 flex items-center justify-between px-4 shadow-lg">
                <div className="flex items-center gap-2">
                    <Zap size={20} className="text-yellow-400" />
                    <span className="font-bold text-sm tracking-tight">Antigravity</span>
                </div>
                <div className="scale-75 origin-right">
                    <ViewModeToggle />
                </div>
            </div>
        </>
    );
}
