export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only run on server start, not during build
        if (process.env.NEXT_PHASE === 'phase-production-build') return;

        const { botManager } = await import('./lib/bot-manager');
        console.log('[Instrumentation] Initializing Bot Manager...');
        await botManager.initialize();
    }
}
