import { Suspense } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { NotificationCenter } from '@/components/dashboard/NotificationCenter';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-[#05070a] text-gray-100 selection:bg-blue-500/30">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <Suspense fallback={<div className="hidden md:flex h-screen w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800" />}>
                <Sidebar />
            </Suspense>

            <main className="flex-1 overflow-y-auto relative z-10">
                <NotificationCenter />
                <div className="max-w-[1600px] mx-auto p-6 pt-24 md:p-10 md:pt-10 pb-32 md:pb-10">
                    {children}
                </div>
            </main>
        </div>
    );
}


