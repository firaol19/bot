'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function ViewModeToggle() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentMode = searchParams.get('view') === 'real' ? 'REAL' : 'DEMO';

    const toggleMode = useCallback((mode: string) => {
        const params = new URLSearchParams(searchParams);
        if (mode === 'REAL') {
            params.set('view', 'real');
        } else {
            params.delete('view'); // Default to demo
        }
        router.push(`?${params.toString()}`);
    }, [searchParams, router]);

    return (
        <div className="bg-gray-900 p-1 rounded-lg flex mb-6 border border-gray-800">
            <button
                onClick={() => toggleMode('DEMO')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${currentMode === 'DEMO' ? 'bg-blue-900/50 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Demo View
            </button>
            <button
                onClick={() => toggleMode('REAL')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${currentMode === 'REAL' ? 'bg-red-900/50 text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Real View
            </button>
        </div>
    );
}
