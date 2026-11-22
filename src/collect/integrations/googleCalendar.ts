import { google } from 'googleapis';
import { z } from 'zod';
import type { EventRecord, EventIntegration } from '../../definitions.ts';
process.loadEnvFile();

const optionsSchema = z.object({
    /** Google Calendar ID (often an email address or ...@group.calendar.google.com) */
    calendarId: z.string().min(1),
    /** Link to the organization's public events page, used as each event's url */
    eventPageUrl: z.url().optional(),
    /** Append the event's location to the organizer name ("Org @ Location") */
    useLocation: z.boolean().default(false),
}).strict();

export type GoogleCalendarOptions = z.infer<typeof optionsSchema>;

export const googleCalendarIntegration = {
    type: 'googleCalendar',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey)
            throw new Error('GOOGLE_API_KEY is not set');

        const calendar = google.calendar({ version: 'v3', auth: apiKey });

        // The API filters by time range, so no post-filtering is needed.
        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00
        const response = await calendar.events.list({
            calendarId: options.calendarId,
            timeMin: today.toISOString(),
            timeMax: endSearchDate.toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];
        return events.map(event => standardizeGoogleEvent(event, source.name, options));
    },
} satisfies EventIntegration<GoogleCalendarOptions>;

function standardizeGoogleEvent(event: any, sourceName: string, options: GoogleCalendarOptions): EventRecord {
    let organizationName = sourceName;
    if (options.useLocation && event.location) {
        // append location to organization name
        const location = event.location.split(/,|-/)[0].trim(); // trim end off location
        organizationName = `${sourceName} @ ${location}`;
    }

    return {
        name: event.summary,
        startDate: event.start.dateTime || event.start.date || undefined,
        endDate: event.end.dateTime || event.end.date || undefined,
        organizer: {
            name: organizationName,
        },
        url: options.eventPageUrl,
    };
}
