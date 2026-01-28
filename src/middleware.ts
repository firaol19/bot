import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value;
    const { pathname } = request.nextUrl;

    // Public paths
    const isPublicPath = pathname === '/login' || pathname === '/register';

    if (!token && !isPublicPath && pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (token && isPublicPath) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Verify token if it exists
    if (token) {
        try {
            const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');
            await jwtVerify(token, secret);
            return NextResponse.next();
        } catch (error) {
            // Token expired or invalid
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('auth-token');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/login', '/register', '/'],
};
