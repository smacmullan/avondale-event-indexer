import { z } from 'zod';
import type { EventRecord, EventIntegration } from '../../definitions.ts';
import PuppeteerQueueManager from '../../utils/puppeteerQueueManager.ts';
import { standardizeAll } from '../integrationHelpers.ts';

const DEFAULT_CALENDAR_URL = 'https://www.chicagopolice.org/community-engagement-calendar/';

const optionsSchema = z.object({
    /** Police beat ids to include, e.g. [1411, 1412] */
    beatIds: z.array(z.number().int().positive()).min(1),
    /** Public calendar page. Loaded first to get browser cookies, and used as each event's url. */
    eventPageUrl: z.url().default(DEFAULT_CALENDAR_URL),
}).strict();

export type CpdCapsOptions = z.infer<typeof optionsSchema>;

export const cpdCapsIntegration = {
    type: 'cpdCaps',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        // The API filters by date range, so no post-filtering is needed.
        // put dates into Unix timestamp format in seconds
        const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000); // today at 00:00
        const endDate = Math.floor(endSearchDate.getTime() / 1000);

        const apiString = `https://www.chicagopolice.org/api/calendarEvents?start=${today}&end=${endDate}&view=day`;
        const events = await getEventsFromApi(apiString, options.eventPageUrl);
        if (!Array.isArray(events))
            throw new Error('Unexpected response from CPD calendar (expected an array)');

        // attendees are strings in the API, so compare as strings
        const policeBeats = new Set(options.beatIds.map(String));
        const relevantEvents = events
            .filter((event: any) => isEventInBeats(event, policeBeats))
            .filter(isCapsEvent);

        return standardizeAll(relevantEvents, event => standardizeCpdCapsEvent(event, options.eventPageUrl), source.name);
    },
} satisfies EventIntegration<CpdCapsOptions>;

async function getEventsFromApi(apiUrl: string, cookiePageUrl: string): Promise<any> {
    const queueManager = PuppeteerQueueManager.getInstance();

    // Errors propagate to the registry, which logs them once.
    return await queueManager.queuePageOperation(async (page) => {
        // navigate to the calendar page first to get proper browser cookies
        await page.goto(cookiePageUrl, { waitUntil: 'networkidle2' });

        // fetch the data from the API inside the page so the cookies apply
        return await page.evaluate(
            async (url: string): Promise<any> => {
                const res = await fetch(url, { method: 'GET' });
                if (!res.ok)
                    throw new Error(`HTTP ${res.status} from CPD calendar API`);
                return res.json();
            }, apiUrl);
    });
}

function isEventInBeats(event: any, beats: Set<string>): boolean {
    return (event.attendees ?? []).some((attendee: string) => beats.has(attendee));
}

function isCapsEvent(event: any): boolean {
    return (event.title ?? '').toUpperCase().includes("BEAT")
        || (event.attendees ?? []).some((attendee: string) => attendee.toUpperCase().includes("CAPS"))
        || (event.body ?? '').toUpperCase().includes("CAPS");
}

function standardizeCpdCapsEvent(event: any, eventPageUrl: string): EventRecord {
    return {
        name: event.title,
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: event.location,
        },
        url: eventPageUrl,
    };
}