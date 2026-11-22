import { z } from 'zod';
import type { EventRecord, EventIntegration } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Venue JSON feed, e.g. https://do312.com/venues/late-bar.json */
    url: z.url(),
}).strict();

export type Do312Options = z.infer<typeof optionsSchema>;

export const do312Integration = {
    type: 'do312',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        const data = await fetchJson(options.url);
        if (!Array.isArray(data?.event_groups))
            throw new Error('Unexpected Do312 response (no "event_groups" array)');

        const do312Events = data.event_groups.flatMap((group: any) => group.events ?? []);
        const events = standardizeAll(do312Events, standardizeDo312Event, source.name);

        // The feed can't filter by date, so filter here.
        return events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<Do312Options>;

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