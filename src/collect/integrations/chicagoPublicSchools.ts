import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    schoolName: z.string().min(1)
        .describe("Substring matched against each event's location title, e.g. \"Logandale\""),
}).strict();

export type ChicagoPublicSchoolsOptions = z.infer<typeof optionsSchema>;

// Already URL-encoded list of CPS calendar category ids
const CATEGORIES = "1149%2C1151%2C1097%2C1135%2C1150%2C1148%2C1106%2C1165%2C1142%2C1118";

export const chicagoPublicSchoolsIntegration = defineIntegration({
    type: 'chicagoPublicSchools',

    docs: {
        title: 'Chicago Public Schools',
        summary: 'Chicago Public Schools calendar events at a matching school location.',
        details:
            'Reads the CPS calendar feed and keeps events whose location title contains schoolName. Use a distinctive ' +
            'substring from the school or location name as it appears in the calendar.',
        example: { schoolName: 'Example School' },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
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
        return standardizeAll(atSchool, standardizeCpsEvent, source.name);
    },
});

function standardizeCpsEvent(event: any): EventRecord {
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