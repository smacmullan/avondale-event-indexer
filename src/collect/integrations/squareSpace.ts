import { z } from 'zod';
import type { EventRecord, EventIntegration, EventSource } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Squarespace GetItemsByMonth API URL. Must already contain a query string; `month` is appended. */
    url: z.url().refine(value => value.includes('?'), 'must already contain a query string'),
    /** Link to the organization's public events page, used as each event's url */
    eventPageUrl: z.url().optional(),
}).strict();

export type SquareSpaceOptions = z.infer<typeof optionsSchema>;

export const squareSpaceIntegration = {
    type: 'squareSpace',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        // Squarespace groups events by month, so the time range may need multiple calls.
        // Calls are sequential to stay polite to the site.
        const squareSpaceEvents: any[] = [];
        for (const monthString of generateMonthStrings(endSearchDate)) {
            const monthEvents = await fetchJson(`${options.url}&month=${monthString}`);
            if (!Array.isArray(monthEvents))
                throw new Error(`Unexpected response for month ${monthString} (expected an array)`);
            squareSpaceEvents.push(...monthEvents);
        }

        const events = standardizeAll(
            squareSpaceEvents,
            (event: any) => standardizeSquareSpaceEvents(event, source, options),
            source.name,
        );

        // Months are coarser than our date range, so filter here.
        return events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<SquareSpaceOptions>;

/**
 * Build an array of month strings (MM-YYYY) between today and endSearchDate.
 */
function generateMonthStrings(endSearchDate: Date): string[] {
    const today = new Date();

    const monthStrings: string[] = [];
    const current = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(endSearchDate.getFullYear(), endSearchDate.getMonth(), 1);
    while (current <= end) {
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const year = current.getFullYear();

        monthStrings.push(`${month}-${year}`);

        current.setMonth(current.getMonth() + 1);
    }
    return monthStrings;
}

function standardizeSquareSpaceEvents(event: any, source: EventSource, options: SquareSpaceOptions): EventRecord {
    return {
        name: event.title,
        startDate: new Date(event.startDate).toISOString(),
        endDate: new Date(event.endDate).toISOString(),
        organizer: {
            name: source.name,
        },
        url: options.eventPageUrl || undefined,
    };
}