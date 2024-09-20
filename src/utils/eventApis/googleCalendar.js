import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

export async function fetchGoogleCalendarEvents(org, endSearchDate) {
    try {
        const calendar = google.calendar({ version: 'v3', auth: process.env.GOOGLE_API_KEY });
        const calendarId = org.api;

        // Fetch events from the calendar
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: (new Date()).toISOString(), // Start time (current date/time)
            timeMax: endSearchDate.toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = response.data.items;
        return events.map(event => standardizeGoogleEvent(event, org));

    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeGoogleEvent(event, org) {
    return {
        name: event.summary,
        startDate: event.start.dateTime || event.start.date || undefined,
        endDate: event.end.dateTime || event.end.date || undefined,
        organizer: {
            name: org.name,
        },
    };
}