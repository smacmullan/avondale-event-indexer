import { z } from 'zod';
import type { EventRecord, EventSource } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    url: z.url().refine(value => value.includes('?'), 'must already contain a query string')
        .describe('OfferingTree events API URL; start_date_time and num_events are appended'),
    eventPageUrl: z.url().optional()
        .describe("Link to the schedule page; each event's url is `${eventPageUrl}/${eventId}`"),
}).strict();

export type OfferingTreeOptions = z.infer<typeof optionsSchema>;

export const offeringTreeIntegration = defineIntegration({
    type: 'offeringTree',

    docs: {
        title: 'OfferingTree',
        summary: 'Events from an OfferingTree events API endpoint.',
        details:
            'Provide the OfferingTree events API URL, including its existing query string; the integration adds ' +
            'start_date_time and num_events. Optionally provide the public schedule page URL to construct links ' +
            'to individual events.',
        example: {
            url: 'https://api.example.com/events?calendar=example',
            eventPageUrl: 'https://example.com/schedule',
        },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00
        const apiString = `${options.url}&start_date_time=${today.toISOString()}&num_events=100`;

        const response = await fetchJson(apiString);
        if (!Array.isArray(response?.data))
            throw new Error('Unexpected response (no "data" array)');

        const events = standardizeAll(
            response.data,
            (event: any) => standardizeOfferingTreeEvent(event, source, options),
            source.name,
        );

        // The API only takes a start date, so filter the end here.
        return events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
});

function standardizeOfferingTreeEvent(event: any, source: EventSource, options: OfferingTreeOptions): EventRecord {
    return {
        name: event.attributes.event.title,
        startDate: event.attributes.start_date_time,
        endDate: event.attributes.end_date_time,
        organizer: {
            name: source.displayName || source.name,
        },
        url: options.eventPageUrl ? `${options.eventPageUrl}/${event.id}` : undefined,
    };
}