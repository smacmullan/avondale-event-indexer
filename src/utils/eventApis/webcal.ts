import ical from 'ical';
import { z } from 'zod';
import { decodeHtmlEntities } from '../html.ts';
import type { Event, EventIntegration, Organization } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';
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

    async fetchEvents({ org, options, endSearchDate }) {
        const data = await fetchText(options.url);
        const calendarData = ical.parseICS(data);

        // Feeds also contain non-event components (timezones, etc.), so keep only VEVENTs
        const webCalEvents = Object.values(calendarData).filter((component: any) => component.type === 'VEVENT');

        const events = standardizeAll(
            webCalEvents,
            (event: any) => standardizeWebCalEvent(event, org, options),
            org.name,
        );

        // iCal feeds can't be filtered by date, so filter here.
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<WebCalOptions>;

function standardizeWebCalEvent(event: any, org: Organization, options: WebCalOptions): Event {
    const organizerName = typeof event.organizer === 'string'
        ? undefined
        : event.organizer?.val;

    return {
        name: decodeHtmlEntities(event.summary),
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: organizerName ? decodeHtmlEntities(organizerName) : org.name,
        },
        url: options.eventPageUrl,
    };
}