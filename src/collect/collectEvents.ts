import { getEndOfWeek } from '../utils/time.ts';
import type { EventRecord, EventSource } from '../definitions.ts';
import type { IntegrationRegistry, SourceResult } from './integrationRegistry.ts';
import { defaultRegistry } from './defaultRegistry.ts';

export type CollectOptions = {
    /** Defaults to the registry with all built-in integrations. */
    registry?: IntegrationRegistry;
    /** How many weeks out to search. Defaults to 2. */
    weeksOut?: number;
};

/** Collect one source. Never throws: failures are reported in the result. */
export async function collectEventsFromSource(
    source: EventSource,
    { registry = defaultRegistry, weeksOut = 2 }: CollectOptions = {},
): Promise<SourceResult> {
    return registry.collectEventsFromSource(source, getEndOfWeek(weeksOut));
}

class CollectionProgressTracker {
    private completed = 0;
    private total: number;

    constructor(total: number) {
        this.total = total;
        this.render();
    }

    finish() {
        this.completed++;
        this.render();
    }

    private render() {
        process.stdout.write(`\rFetched events for ${this.completed}/${this.total} sources...`);
    }

    clear() {
        process.stdout.write('\r\x1b[K');
    }
}

/** Collect every source concurrently, with a progress line. Returns one result per source, in input order. */
export async function collectEventsBySource(
    sources: EventSource[],
    { registry = defaultRegistry, weeksOut = 2 }: CollectOptions = {},
): Promise<SourceResult[]> {

    // console logging of indexing progress
    console.log("Getting event data...");
    const tracker = new CollectionProgressTracker(sources.length);

    // compute the cutoff once so every source uses the same end date
    const endSearchDate = getEndOfWeek(weeksOut);

    // registry.collect never rejects, so one failing source can't sink the rest
    const results = await Promise.all(sources.map(source =>
        registry.collectEventsFromSource(source, endSearchDate).then(result => {
            tracker.finish();
            return result;
        })
    ));

    tracker.clear(); // clear logging messages
    return results;
}

/** Collect every source, print a summary of what went wrong, and return all the events. */
export async function collectEvents(
    sources: EventSource[],
    options: CollectOptions = {},
): Promise<EventRecord[]> {
    const results = await collectEventsBySource(sources, options);
    printCollectionSummary(results);
    const allEvents = results.flatMap(result => result.events);
    return allEvents;
}

/** Plain-object report (no source options) suitable for writing to a JSON file. */
export function buildCollectionReport(results: SourceResult[]) {
    return results.map(result => ({
        source: result.source.name,
        integration: result.source.integrationType,
        status: result.status,
        eventCount: result.events.length,
        durationMs: result.durationMs,
        ...(result.error ? { error: result.error } : {}),
        ...(result.warnings.length ? { warnings: result.warnings } : {}),
    }));
}

export function printCollectionSummary(results: SourceResult[]): void {
    console.log(formatCollectionSummary(results));
}

export function formatCollectionSummary(results: SourceResult[]): string {
    const failed = results.filter(result => result.status === 'failed');
    const withWarnings = results.filter(result => result.warnings.length > 0);
    const empty = results.filter(result => result.status === 'ok' && result.events.length === 0);
    const totalEvents = results.reduce((total, result) => total + result.events.length, 0);

    const problems = [
        failed.length && `${failed.length} failed`,
        empty.length && `${empty.length} returned no events`,
    ].filter(Boolean).join(', ');
    const lines = [
        `Collected ${totalEvents} events from ${results.length} ${results.length === 1 ? 'source' : 'sources'}`
        + (problems ? ` (${problems})` : '') + '.',
    ];

    if (failed.length) {
        lines.push('', 'Failed:');
        for (const result of failed)
            lines.push(`  - ${result.source.name} [${result.source.integrationType}]: ${result.error} (${seconds(result.durationMs)})`);
    }
    if (withWarnings.length) {
        lines.push('', 'Warnings:');
        for (const result of withWarnings)
            for (const warning of result.warnings)
                lines.push(`  - ${result.source.name}: ${warning}`);
    }
    if (empty.length)
        lines.push('', `Returned no events: ${empty.map(result => result.source.name).join(', ')}`);

    return lines.join('\n');
}

function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}