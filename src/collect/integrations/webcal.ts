import ical from 'ical';
import { z } from 'zod';
import { decodeHtmlEntities } from '../../utils/html.ts';
import type { EventRecord, EventSource } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchText, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    url: z.url()
        .describe('iCal feed URL (https://..., not webcal://)'),
    eventPageUrl: z.url().optional()
        .describe("Link to the organization's public events page, used as each event's url"),
}).strict();

export type WebCalOptions = z.infer<typeof optionsSchema>;

export const webCalIntegration = defineIntegration({
    type: 'webCal',

    docs: {
        title: 'WebCal',
        summary: 'Events from an iCal (.ics) feed hosted at a URL.',
        details:
            'The feed is downloaded and its events parsed. Use the https:// form of the URL, not webcal://. ' +
            "iCal events don't carry individual page links, so set eventPageUrl if you want events to link somewhere.",
        example: { url: 'https://example.com/calendar.ics', eventPageUrl: 'https://example.com/events' },
    },

    options: optionsSchema,

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
});

function standardizeWebCalEvent(event: any, source: EventSource, options: WebCalOptions): EventRecord {
    const organizerName = typeof event.organizer === 'string'
        ? undefined
        : event.organizer?.val;

    return {
        name: decodeHtmlEntities(event.summary),
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: organizerName ? decodeHtmlEntities(organizerName) : (source.displayName || source.name),
        },
        url: options.eventPageUrl,
    };
}