import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-source context that follows an integration's async calls without being passed around.
 */
export type SourceRunContext = {
    /** Aborted when the source times out. */
    signal: AbortSignal;
    /** Records a non-fatal problem on the current source's result. */
    warn: (message: string) => void;
};

const storage = new AsyncLocalStorage<SourceRunContext>();

export function runWithContext<T>(context: SourceRunContext, fn: () => T): T {
    return storage.run(context, fn);
}

export function currentSignal(): AbortSignal | undefined {
    return storage.getStore()?.signal;
}

/**
 * Record a non-fatal problem (skipped items, etc.) on the current source's result.
 */
export function reportWarning(message: string, fallbackLabel?: string): void {
    const context = storage.getStore();
    if (context)
        context.warn(message);
    else
        // Outside a registry run (scripts, tests) it falls back to console.warn()
        console.warn(fallbackLabel ? `[${fallbackLabel}] ${message}` : message);
}