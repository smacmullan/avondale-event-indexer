import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    endpoint: z.string().min(1).refine(
        value => !/^https?:\/\//i.test(value),
        'omit the "https://" prefix',
    ).describe('Widget API host, path, and query without "https://"; from/to are appended'),
}).strict();

export type EventsCalendarCoOptions = z.infer<typeof optionsSchema>;

export const eventsCalendarCoIntegration = defineIntegration({
    type: 'eventsCalendarCo',

    docs: {
        title: 'Events Calendar Co',
        summary: 'Events from an Events Calendar Co widget API.',
        details:
            'Inspect the calendar page network requests in browser developer tools and use the widget API request ' +
            'host, path, and query. Omit the https:// prefix; the integration adds it and appends the date range. ' +
            'The endpoint must already contain a query string.',
        example: { endpoint: 'widgets.example.com/calendar?widget=example' },
    },

    options: optionsSchema,

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
});

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