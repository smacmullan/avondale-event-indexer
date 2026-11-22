import { z } from 'zod';
import type { Event, EventIntegration } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Substring matched against each event's location title, e.g. "Logandale" */
    schoolName: z.string().min(1),
}).strict();

export type ChicagoPublicSchoolsOptions = z.infer<typeof optionsSchema>;

// Already URL-encoded list of CPS calendar category ids
const CATEGORIES = "1149%2C1151%2C1097%2C1135%2C1150%2C1148%2C1106%2C1165%2C1142%2C1118";

export const chicagoPublicSchoolsIntegration = {
    type: 'chicagoPublicSchools',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ org, options, endSearchDate }) {
        // The API filters by date range, so no post-filtering is needed.
        // put dates into YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const endDate = endSearchDate.toISOString().split('T')[0];

        const apiString = `https://www.cps.edu/api/calendar/getevents?categories=${CATEGORIES}&tags=&start=${today}&end=${endDate}`;
        const cpsEvents = await fetchJson<any[]>(apiString);
        if (!Array.isArray(cpsEvents))
            throw new Error('Unexpected response from CPS calendar (expected an array)');

        const atSchool = cpsEvents.filter(event =>
            event.extendedProps?.eventLocationTitle?.includes(options.schoolName));
        return standardizeAll(atSchool, standardizeCpsEvent, org.name);
    },
} satisfies EventIntegration<ChicagoPublicSchoolsOptions>;

function standardizeCpsEvent(event: any): Event {
    return {
        name: event.title,
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: event.extendedProps.eventLocationTitle,
        },
        url: "https://www.cps.edu/calendar",
    };
}