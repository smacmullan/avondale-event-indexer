import type { EventRecord, EventIntegration, IntegrationContext } from '../definitions.ts';
import { currentSignal, reportWarning } from './runContext.ts';

/** URL without the query string, so error messages stay short and don't leak keys. */
function describeUrl(url: string): string {
    try {
        const u = new URL(url);
        return u.origin + u.pathname;
    } catch {
        return url;
    }
}

/**
 * fetch() that throws on non-2xx responses (plain fetch only rejects on network errors).
 * Inside a registry run it is also cancelled automatically when the source times out.
 */
export async function fetchChecked(url: string, init?: RequestInit): Promise<Response> {
    const ambient = currentSignal();
    const own = init?.signal ?? undefined;
    const signal = ambient && own ? AbortSignal.any([ambient, own]) : (own ?? ambient);

    const response = await fetch(url, { ...init, signal });
    if (!response.ok)
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${describeUrl(url)}`.replace(/\s+/g, ' '));
    return response;
}

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    return (await fetchChecked(url, init)).json() as Promise<T>;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
    return (await fetchChecked(url, init)).text();
}

/**
 * Converts raw items to EventRecords, skipping bad items instead of failing the whole integration.
 *  - Return null/undefined from `standardize` to skip an item intentionally (silent).
 *  - Throwing counts as a parse failure; one summary warning is recorded for all failures.
 */
export function standardizeAll<T>(
    items: readonly T[],
    standardize: (item: T) => EventRecord | null | undefined,
    sourceName: string,
): EventRecord[] {
    const events: EventRecord[] = [];
    let failed = 0;
    let firstError: unknown;

    for (const item of items) {
        try {
            const event = standardize(item);
            if (event) events.push(event);
        } catch (error) {
            failed++;
            firstError ??= error;
        }
    }

    if (failed > 0) {
        const message = firstError instanceof Error ? firstError.message : String(firstError);
        reportWarning(`Skipped ${failed} of ${items.length} events that couldn't be parsed. First error: ${message}`, sourceName);
    }
    return events;
}

/**
 * Build a source-specific integration on top of an existing one: the base integration
 * fetches (and validates options as usual), then `transform` post-processes its events.
 * The new integration accepts exactly the same options as the base.
 */
export function withTransform<TOptions>(
    base: EventIntegration<TOptions>,
    type: string,
    transform: (events: EventRecord[], ctx: IntegrationContext<TOptions>) => EventRecord[],
): EventIntegration<TOptions> {
    return {
        type,
        parseOptions: raw => base.parseOptions(raw),
        async fetchEvents(ctx) {
            return transform(await base.fetchEvents(ctx), ctx);
        },
    };
}