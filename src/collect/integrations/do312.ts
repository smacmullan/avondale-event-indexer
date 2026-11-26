import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    url: z.url()
        .describe('Venue JSON feed URL'),
}).strict();

export type Do312Options = z.infer<typeof optionsSchema>;

export const do312Integration = defineIntegration({
    type: 'do312',

    docs: {
        title: 'Do312',
        summary: 'Events from a Do312 venue JSON feed.',
        details:
            'Provide the venue JSON feed URL. Find it by opening the venue page and inspecting fetch requests in ' +
            'browser developer tools; the feed commonly has the form do312.com/venues/<venue>.json.',
        example: { url: 'https://do312.com/venues/example-venue.json' },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        const data = await fetchJson(options.url);
        if (!Array.isArray(data?.event_groups))
            throw new Error('Unexpected Do312 response (no "event_groups" array)');

        const do312Events = data.event_groups.flatMap((group: any) => group.events ?? []);
        const events = standardizeAll(do312Events, standardizeDo312Event, source.name);

        // The feed can't filter by date, so filter here.
        return events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
});

function standardizeDo312Event(event: any): EventRecord {
    return {
        name: event.title,
        startDate: event.begin_time || event.begin_date,
        endDate: event.end_time,
        organizer: {
            name: event.venue.title,
        },
        url: event.permalink ? `https://do312.com${event.permalink}` : undefined,
    };
}