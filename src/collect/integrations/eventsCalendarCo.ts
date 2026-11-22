import { z } from 'zod';
import type { EventRecord, EventIntegration } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Host, path, and query of the widget API, WITHOUT "https://" (it is added for you).
     *  Must already contain a query string; from/to are appended. */
    endpoint: z.string().min(1).refine(
        value => !/^https?:\/\//i.test(value),
        'omit the "https://" prefix',
    ),
}).strict();

export type EventsCalendarCoOptions = z.infer<typeof optionsSchema>;

export const eventsCalendarCoIntegration = {
    type: 'eventsCalendarCo',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        // The API filters by date range, so no post-filtering is needed.
        // put dates into Unix timestamp format (milliseconds)
        const today = new Date().setHours(0, 0, 0, 0); // today at 00:00
        const endDate = endSearchDate.getTime();

        const apiString = `https://${options.endpoint}&from=${today}&to=${endDate}`;
        const data = await fetchJson(apiString);
        if (!Array.isArray(data?.events))
            throw new Error('Unexpected response (no "events" array)');

        return standardizeAll(data.events, standardizeEventsCalendarCoEvent, source.name);
    },
} satisfies EventIntegration<EventsCalendarCoOptions>;

function standardizeEventsCalendarCoEvent(event: any): EventRecord {
    const { title, start_time, end_time, location, event_link } = event;

    return {
        name: title,
        startDate: start_time,
        endDate: end_time,
        organizer: {
            name: location,
        },
        url: event_link || undefined,
    };
}