import { FeaturesBotDetailClient } from '@/components/dashboard/FeaturesBotDetailClient';

export const dynamic = 'force-dynamic';

export default async function FeaturesBotDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return <FeaturesBotDetailClient botId={id} />;
}
