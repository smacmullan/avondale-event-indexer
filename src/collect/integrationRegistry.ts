import type { EventRecord, EventIntegration, EventSource } from '../definitions.ts';
import { runWithContext } from './runContext.ts';

/** Outcome of collecting one source*/
export type SourceResult = {
    source: EventSource;
    /** 'failed' means the whole source produced nothing (bad options, fetch error, timeout, unknown integration). */
    status: 'ok' | 'failed';
    /** Events returned by the integration. Always empty when status is 'failed'. */
    events: EventRecord[];
    /** Why the source failed. Only set when status is 'failed'. */
    error?: string;
    /** Non-fatal problems: skipped items, dropped events, adjusted fields. */
    warnings: string[];
    durationMs: number;
};

export type RegistryOptions = {
    defaultTimeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 60_000;

type IntegrationRunner = (source: EventSource, endSearchDate: Date, timeoutMs: number) => Promise<SourceResult>;

/**
 * Maps `integrationType` strings to integrations and runs them.
 */
export class IntegrationRegistry {
    private runners = new Map<string, IntegrationRunner>();
    private integrations = new Map<string, EventIntegration<any>>();
    private defaultTimeoutMs: number;

    constructor({ defaultTimeoutMs = DEFAULT_TIMEOUT_MS }: RegistryOptions = {}) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    register<TOptions>(integration: EventIntegration<TOptions>): void {
        // check that integration is valid before registering it
        const type = integration?.type;
        if (typeof type !== 'string' || !type.trim())
            throw new Error('Integration must have a non-empty string "type"');
        for (const method of ['parseOptions', 'fetchEvents'] as const)
            if (typeof integration[method] !== 'function')
                throw new Error(`Integration "${type}" is missing ${method}()`);
        if (!integration.docs?.title?.trim() || !integration.docs?.summary?.trim())
            throw new Error(`Integration "${type}" is missing docs.title/docs.summary`);
        if (typeof integration.optionsSchema?.parse !== 'function')
            throw new Error(`Integration "${type}" is missing optionsSchema`);
        if (this.runners.has(type))
            throw new Error(`Integration "${type}" is already registered`);

        this.integrations.set(type, integration);

        // Closing over the typed integration erases TOptions for storage while keeping
        // parseOptions -> fetchEvents type-checked inside runIntegration.
        this.runners.set(type, (source, endSearchDate, timeoutMs) =>
            runIntegration(integration, source, endSearchDate, timeoutMs));
    }

    has(type: string): boolean {
        return this.runners.has(type);
    }

    types(): string[] {
        return [...this.runners.keys()];
    }

    get(type: string): EventIntegration<any> | undefined {
        return this.integrations.get(type);
    }

    /** All registered integrations, in registration order. */
    list(): EventIntegration<any>[] {
        return [...this.integrations.values()];
    }

    /** Collect one source. Never rejects. */
    async collectEventsFromSource(source: EventSource, endSearchDate: Date): Promise<SourceResult> {
        const run = this.runners.get(source.integrationType);
        if (!run) {
            return {
                source,
                status: 'failed',
                events: [],
                error: `No integration registered for "${source.integrationType}" (see: node index.ts --list-integrations)`,
                warnings: [],
                durationMs: 0,
            };
        }
        return run(source, endSearchDate, source.timeoutMs ?? this.defaultTimeoutMs);
    }
}

async function runIntegration<TOptions>(
    integration: EventIntegration<TOptions>,
    source: EventSource,
    endSearchDate: Date,
    timeoutMs: number,
): Promise<SourceResult> {
    const startedAt = performance.now();
    const warnings: string[] = [];
    let settled = false; // lets a timed-out integration's late warnings be ignored

    const finish = (fields: Pick<SourceResult, 'status' | 'events'> & { error?: string }): SourceResult => ({
        source,
        warnings: [...warnings],
        durationMs: Math.round(performance.now() - startedAt),
        ...fields,
    });

    let options: TOptions;
    try {
        options = integration.parseOptions(source.options ?? {});
    } catch (error) {
        return finish({ status: 'failed', events: [], error: `Invalid options: ${formatError(error)} (see: node index.ts --describe ${integration.type})` });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
        const seconds = +(timeoutMs / 1000).toFixed(1);
        controller.abort(new DOMException(`Timed out after ${seconds}s`, 'TimeoutError'));
    }, timeoutMs);

    try {
        const raw: unknown = await runWithContext(
            { signal: controller.signal, warn: message => { if (!settled) warnings.push(message); } },
            () => rejectOnAbort(
                integration.fetchEvents({ source, options, endSearchDate, signal: controller.signal }),
                controller.signal,
            ),
        );

        if (!Array.isArray(raw))
            throw new Error(`Integration returned ${raw === null ? 'null' : typeof raw} instead of an array of events`);

        // "Stamp" where each event came from, without touching the integration's own objects
        const origin = { name: source.name, dedupeRank: source.dedupeRank ?? 0 };
        return finish({ status: 'ok', events: raw.map(event => ({ ...event, source: origin })) });
    } catch (error) {
        return finish({ status: 'failed', events: [], error: formatError(error) });
    } finally {
        settled = true;
        clearTimeout(timer);
    }
}


function rejectOnAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    //  Note: work that can't be cancelled, like a queued browser page, keeps running in the background.
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        if (signal.aborted) {
            onAbort();
        } else {
            signal.addEventListener('abort', onAbort, { once: true });
        }
        work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
}

/** Flatten zod issues and network error causes into a readable one-line message. */
function formatError(error: unknown): string {
    if (error && typeof error === 'object' && Array.isArray((error as any).issues)) {
        return (error as any).issues
            .map((issue: any) => `${issue.path?.length ? issue.path.join('.') : '(options)'}: ${issue.message}`)
            .join('; ');
    }
    if (error instanceof Error) {
        const cause = error.cause instanceof Error ? error.cause.message : undefined;
        return cause && cause !== error.message ? `${error.message} (${cause})` : error.message;
    }
    return String(error);
}