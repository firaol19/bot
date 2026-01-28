import { Suspense } from 'react';
import CreateBotForm from './CreateBotForm';

export const dynamic = 'force-dynamic';

export default function CreateBotPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        }>
            <CreateBotForm />
        </Suspense>
    );
}
