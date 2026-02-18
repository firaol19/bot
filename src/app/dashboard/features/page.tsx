'use client';

import { Suspense } from 'react';
import FeaturesBotForm from '@/components/dashboard/FeaturesBotForm';

export default function FeaturesBotPage() {
    return (
        <main className="min-h-screen bg-[#050505] text-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10">
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="relative w-24 h-24">
                            <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500/20 rounded-full" />
                            <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                        </div>
                    </div>
                }>
                    <FeaturesBotForm />
                </Suspense>
            </div>
        </main>
    );
}
