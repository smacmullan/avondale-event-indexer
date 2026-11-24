import type { EventRecord } from '../definitions.ts';
import { formatDay, formatTimeRange } from '../utils/time.ts';

export type EventLine = {
    event: EventRecord;
    timeRange: string;
    /** Empty string when the event has no organizer. */
    organizerName: string;
};

export type DayGroup = {
    /** The day heading, e.g. "Saturday, January 5". */
    day: string;
    lines: EventLine[];
};

export type SkippedEvent = { event: EventRecord; error: string };

export type GroupedEvents = {
    days: DayGroup[];
    /** Events whose day or time couldn't be formatted. They are left out of `days`. */
    skipped: SkippedEvent[];
};

type Formatters = {
    formatDay: (event: EventRecord) => string;
    formatTimeRange: (event: EventRecord) => string;
};

/**
 * Shared view model for list-style exporters: consecutive events on the same day are grouped
 * under one heading, in the order given (sort before using).
 */
export function groupEventsByDay(
    events: EventRecord[],
    formatters: Formatters = { formatDay, formatTimeRange },
): GroupedEvents {
    const days: DayGroup[] = [];
    const skipped: SkippedEvent[] = [];

    for (const event of events) {
        try {
            const day = formatters.formatDay(event);
            const timeRange = formatters.formatTimeRange(event);

            let group = days.at(-1);
            if (!group || group.day !== day) {
                group = { day, lines: [] };
                days.push(group);
            }
            group.lines.push({ event, timeRange, organizerName: event.organizer?.name || '' });
        } catch (error) {
            skipped.push({ event, error: error instanceof Error ? error.message : String(error) });
        }
    }

    return { days, skipped };
}

/** Warning text for exporters to report skipped events. */
export function describeSkipped(skipped: readonly SkippedEvent[]): string[] {
    if (skipped.length === 0)
        return [];
    const first = skipped[0];
    return [`Skipped ${skipped.length} ${skipped.length === 1 ? 'event' : 'events'} that couldn't be formatted. First: "${first.event.name}" (${first.error})`];
}
