import { z } from 'zod';
import type { Event, EventIntegration, Organization } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** OfferingTree events API URL. Must already contain a query string; start_date_time and num_events are appended. */
    url: z.url().refine(value => value.includes('?'), 'must already contain a query string'),
    /** Link to the schedule page; each event's url is `${eventPageUrl}/${eventId}` */
    eventPageUrl: z.url().optional(),
}).strict();

export type OfferingTreeOptions = z.infer<typeof optionsSchema>;

export const offeringTreeIntegration = {
    type: 'offeringTree',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ org, options, endSearchDate }) {
        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00
        const apiString = `${options.url}&start_date_time=${today.toISOString()}&num_events=100`;

        const response = await fetchJson(apiString);
        if (!Array.isArray(response?.data))
            throw new Error('Unexpected response (no "data" array)');

        const events = standardizeAll(
            response.data,
            (event: any) => standardizeOfferingTreeEvent(event, org, options),
            org.name,
        );

        // The API only takes a start date, so filter the end here.
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<OfferingTreeOptions>;

function standardizeOfferingTreeEvent(event: any, org: Organization, options: OfferingTreeOptions): Event {
    return {
        name: event.attributes.event.title,
        startDate: event.attributes.start_date_time,
        endDate: event.attributes.end_date_time,
        organizer: {
            name: org.name,
        },
        url: options.eventPageUrl ? `${options.eventPageUrl}/${event.id}` : undefined,
    };
}