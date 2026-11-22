import { getEndOfWeek } from '../utils/time.ts';
import type { EventRecord, EventSource } from '../definitions.ts';
import type { IntegrationRegistry } from './integrationRegistry.ts';
import { defaultRegistry } from './defaultRegistry.ts';

export type IndexOptions = {
    /** Defaults to the registry with all built-in integrations. */
    registry?: IntegrationRegistry;
    /** How many weeks out to search. Defaults to 2. */
    weeksOut?: number;
};

/**
 * Fetch events for a single source. Kept for scripts/tests that call it directly.
 * Never throws: failures are logged by the registry and yield [].
 */
export async function fetchEvents(
    source: EventSource,
    weeksOut = 2,
    registry: IntegrationRegistry = defaultRegistry,
): Promise<EventRecord[]> {
    return registry.fetchEvents(source, getEndOfWeek(weeksOut));
}

class FetchProgressTracker {
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

export async function collectEvents(
    sources: EventSource[],
    { registry = defaultRegistry, weeksOut = 2 }: IndexOptions = {},
): Promise<EventRecord[]> {

    // console logging of indexing progress
    console.log("Getting event data...");
    const tracker = new FetchProgressTracker(sources.length);

    // compute the cutoff once so every source uses the same end date
    const endSearchDate = getEndOfWeek(weeksOut);

    // registry.fetchEvents never rejects, so one failing source can't sink the rest
    const eventPromises = sources.map(source =>
        registry.fetchEvents(source, endSearchDate).then(events => {
            tracker.finish();
            return events;
        })
    );

    const allEventsArrays = await Promise.all(eventPromises);
    tracker.clear(); // clear logging messages

    const allEvents = allEventsArrays.flat();
    return allEvents;
}