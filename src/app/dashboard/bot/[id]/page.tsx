import { BotDetailClient } from '@/components/dashboard/BotDetailClient';

export const dynamic = 'force-dynamic';

export default async function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return <BotDetailClient botId={id} />;
}
