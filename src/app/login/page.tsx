import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import LoginForm from './LoginForm';

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
