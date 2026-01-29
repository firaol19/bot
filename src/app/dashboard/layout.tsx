import { Sidebar } from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-950 text-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 pb-24 md:pb-8">
                {children}
            </main>
        </div>
    );
}
