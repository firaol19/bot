'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, LineChart, Settings, Activity, LogOut, Zap, Plus, Menu, X, Shield, BarChart3 } from 'lucide-react';
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
        <nav className="space-y-2 flex-1 pt-4">
            <NavLink
                href={`/dashboard${query}`}
                icon={<Home size={20} />}
                label="Dashboard"
                isActive={pathname === '/dashboard'}
                onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavLink
                href={`/dashboard/spot${query}`}
                icon={<Activity size={20} />}
                label="Spot Bots"
                isActive={pathname === '/dashboard/spot'}
                onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavLink
                href={`/dashboard/analytics${query}`}
                icon={<BarChart3 size={20} />}
                label="Analytics"
                isActive={pathname === '/dashboard/analytics'}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                Strategies
            </div>

            <NavLink
                href={`/dashboard/features/create${query}`}
                icon={<Plus size={20} />}
                label="Create Bot"
                isActive={pathname === '/dashboard/features/create'}
                variant="accent"
                onClick={() => setIsMobileMenuOpen(false)}
            />
            <NavLink
                href={`/dashboard/features${query}`}
                icon={<Shield size={20} />}
                label="Manage Bots"
                isActive={pathname === '/dashboard/features'}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                System
            </div>

            <NavLink
                href={`/dashboard/settings${query}`}
                icon={<Settings size={20} />}
                label="Settings"
                isActive={pathname === '/dashboard/settings'}
                onClick={() => setIsMobileMenuOpen(false)}
            />
        </nav>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:flex h-screen w-72 glass-effect text-white p-6 flex-col overflow-y-auto z-50">
                <div className="mb-10 flex items-center gap-3 px-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Zap size={24} className="text-white fill-current" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tighter text-white">FIRA BOT</h1>
                        <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Trading Pro</p>
                    </div>
                </div>

                <div className="mb-8 p-1 bg-gray-950/50 rounded-2xl border border-white/5">
                    <ViewModeToggle />
                </div>

                <NavLinks />

                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 p-4 hover:bg-red-500/10 hover:text-red-400 rounded-2xl transition-all text-gray-400 mt-auto border-t border-white/5 pt-6 group"
                >
                    <div className="p-2 rounded-xl group-hover:bg-red-500/20 transition-colors">
                        <LogOut size={20} />
                    </div>
                    <span className="font-semibold">Sign Out</span>
                </button>
            </div>

            {/* Mobile Sidebar (Drawer) */}
            <div className={`md:hidden fixed inset-0 z-[100] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                <div className={`absolute left-0 top-0 bottom-0 w-80 glass-effect p-8 flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-3">
                            <Zap size={24} className="text-blue-500" />
                            <span className="font-black tracking-tighter text-xl">FIRA BOT</span>
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 glass-card rounded-xl text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="mb-8">
                        <ViewModeToggle />
                    </div>

                    <NavLinks />

                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 p-4 hover:bg-red-500/10 hover:text-red-400 rounded-2xl transition text-gray-400 mt-auto border-t border-white/5 pt-6"
                    >
                        <LogOut size={20} />
                        <span className="font-semibold">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-6 left-6 right-6 h-20 glass-effect rounded-[2.5rem] flex justify-around items-center px-4 z-[90] shadow-2xl border-white/10">
                <MobileTabIcon href={`/dashboard${query}`} icon={<Home size={22} />} isActive={pathname === '/dashboard'} />
                <MobileTabIcon href={`/dashboard/spot${query}`} icon={<Activity size={22} />} isActive={pathname === '/dashboard/spot'} />

                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="flex flex-col items-center justify-center w-14 h-14 bg-blue-600 rounded-full text-white shadow-xl shadow-blue-500/40 relative -top-8 border-4 border-[#05070a] transition-transform active:scale-90"
                >
                    <Menu size={24} />
                </button>

                <MobileTabIcon href={`/dashboard/analytics${query}`} icon={<LineChart size={22} />} isActive={pathname === '/dashboard/analytics'} />
                <MobileTabIcon href={`/dashboard/settings${query}`} icon={<Settings size={22} />} isActive={pathname === '/dashboard/settings'} />
            </div>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-20 glass-effect z-[80] flex items-center justify-between px-6 border-b-0 shadow-none">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Zap size={18} className="text-white fill-current" />
                    </div>
                    <span className="font-black tracking-tighter text-lg uppercase underline decoration-blue-500 underline-offset-4">Fira Bot</span>
                </div>
                <div className="scale-90 origin-right">
                    <div className="bg-gray-950/40 p-1 rounded-xl border border-white/5">
                        <ViewModeToggle />
                    </div>
                </div>
            </div>
        </>
    );
}

function NavLink({ href, icon, label, isActive, onClick, variant = 'default' }: any) {
    const activeClasses = variant === 'accent'
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
        : 'bg-white/5 text-blue-400 border-r-4 border-blue-500';

    const inactiveClasses = 'text-gray-400 hover:bg-white/5 hover:text-white';

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 group font-semibold ${isActive ? activeClasses : inactiveClasses}`}
        >
            <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {icon}
            </div>
            <span>{label}</span>
        </Link>
    );
}

function MobileTabIcon({ href, icon, isActive }: any) {
    return (
        <Link href={href} className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-blue-500 scale-110' : 'text-gray-500'}`}>
            <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-500/10' : ''}`}>
                {icon}
            </div>
        </Link>
    );
}
