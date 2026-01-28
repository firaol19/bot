export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { botManager } = await import('./lib/bot-manager');
        console.log('[Instrumentation] Initializing Bot Manager...');
        await botManager.initialize();
    }
}
