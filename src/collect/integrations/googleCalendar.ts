import { google } from 'googleapis';
import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { defineIntegration } from '../defineIntegration.ts';

try {
    process.loadEnvFile();
} catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error;
}

const optionsSchema = z.object({
    calendarId: z.string().min(1)
        .describe('Google Calendar ID (often an email address or ...@group.calendar.google.com)'),
    eventPageUrl: z.url().optional()
        .describe("Link to the organization's public events page, used as each event's url"),
    useLocation: z.boolean().default(false)
        .describe('Append the event location to the organizer name ("Org @ Location")'),
}).strict();

export type GoogleCalendarOptions = z.infer<typeof optionsSchema>;

export const googleCalendarIntegration = defineIntegration({
    type: 'googleCalendar',

    docs: {
        title: 'Google Calendar',
        summary: 'Events from a public Google Calendar accessed with an API key.',
        details:
            'Provide the calendar ID, often shown in the calendar settings as an email-like address. The calendar ' +
            'must be public because this integration uses an API key rather than OAuth.',
        requiresEnv: ['GOOGLE_API_KEY'],
        example: { calendarId: 'example@group.calendar.google.com' },
    },

    options: optionsSchema,

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
});

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
