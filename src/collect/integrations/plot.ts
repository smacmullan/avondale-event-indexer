import { z } from 'zod';
import type { EventRecord, EventIntegration } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Bare hostname of the Plot site, e.g. "sleeping-village.com" */
    host: z.string().min(1),
}).strict();

export type PlotOptions = z.infer<typeof optionsSchema>;

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

export const plotIntegration = {
    type: 'plot',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        // The API filters by date range, so no post-filtering is needed.
        // put dates into YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const endDate = endSearchDate.toISOString().split('T')[0];

        const apiString = `https://${options.host}/api/plot/v1/listings?currentpage=1&notLoaded=false&listingsPerPage=48&from=${today}&to=${endDate}&_locale=user`;
        const plotEvents = await fetchJson<any[]>(apiString);
        if (!Array.isArray(plotEvents))
            throw new Error('Unexpected Plot response (expected an array)');

        // Events with unparseable dates are skipped and summarized in one log line
        return standardizeAll(plotEvents, standardizePlotEvent, source.name);
    },
} satisfies EventIntegration<PlotOptions>;

function standardizePlotEvent(event: any): EventRecord {
    const { title, dateTime, venue, permalink } = event;

    return {
        name: title,
        startDate: parseDateFromPlotDateTime(dateTime, title),
        organizer: {
            name: venue,
        },
        url: permalink,
    };
}

/** Parses strings like "Fri, Nov 21 8:30pm". Throws if the format isn't recognized. */
function parseDateFromPlotDateTime(dateTime: string, title: string): string {
    const match = dateTime?.match(/\w{3}, (\w{3}) (\d{1,2}) (\d{1,2}:\d{2}|\d{1,2})(am|pm)/i);
    if (!match || !(match[1] in MONTHS))
        throw new Error(`Unrecognized date "${dateTime}" for "${title}"`);
    const [, month, day, time, meridian] = match;
    const monthIndex = MONTHS[month as keyof typeof MONTHS];

    // Parse the hour and minute from the time string
    let [hours, minutes] = time.split(':').map(Number);
    if (!minutes) minutes = 0; // Default to 0 if minutes are not provided
    // Convert the 12-hour format to 24-hour format based on AM/PM
    const isPm = meridian.toLowerCase() === 'pm';
    if (isPm && hours !== 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;

    // The year isn't in the string: assume this year unless the month already passed
    const today = new Date();
    const year = monthIndex < today.getMonth()
        ? today.getFullYear() + 1
        : today.getFullYear();

    return new Date(year, monthIndex, +day, hours, minutes, 0).toISOString();
}