import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: botId } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '1');

        // Get latest analysis or history based on limit
        const analyses = await (prisma as any).marketAnalysis.findMany({
            where: { botId },
            orderBy: { timestamp: 'desc' },
            take: limit
        });

        if (analyses.length === 0) {
            return NextResponse.json({
                latest: null,
                history: [],
                message: 'No analysis data available yet'
            });
        }

        return NextResponse.json({
            latest: analyses[0],
            history: limit > 1 ? analyses : [],
            count: analyses.length
        });
    } catch (error: any) {
        console.error('[API] Failed to fetch analysis:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analysis data', details: error.message },
            { status: 500 }
        );
    }
}
