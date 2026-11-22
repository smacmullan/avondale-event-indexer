import ical from 'ical';
import { z } from 'zod';
import { decodeHtmlEntities } from '../../utils/html.ts';
import type { EventRecord, EventIntegration, EventSource } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchText, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** iCal feed URL (https://..., not webcal://) */
    url: z.url(),
    /** Link to the organization's public events page, used as each event's url */
    eventPageUrl: z.url().optional(),
}).strict();

export type WebCalOptions = z.infer<typeof optionsSchema>;

export const webCalIntegration = {
    type: 'webCal',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        const data = await fetchText(options.url);
        const calendarData = ical.parseICS(data);

        // Feeds also contain non-event components (timezones, etc.), so keep only VEVENTs
        const webCalEvents = Object.values(calendarData).filter((component: any) => component.type === 'VEVENT');

        const events = standardizeAll(
            webCalEvents,
            (event: any) => standardizeWebCalEvent(event, source, options),
            source.name,
        );

        // iCal feeds can't be filtered by date, so filter here.
        return events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<WebCalOptions>;

function standardizeWebCalEvent(event: any, source: EventSource, options: WebCalOptions): EventRecord {
    const organizerName = typeof event.organizer === 'string'
        ? undefined
        : event.organizer?.val;

    return {
        name: decodeHtmlEntities(event.summary),
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: organizerName ? decodeHtmlEntities(organizerName) : source.name,
        },
        url: options.eventPageUrl,
    };
}