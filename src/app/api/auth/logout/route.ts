import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ message: 'Logged out successfully' });

    response.cookies.set({
        name: 'auth-token',
        value: '',
        expires: new Date(0),
        httpOnly: true
    });

    return response;
}
