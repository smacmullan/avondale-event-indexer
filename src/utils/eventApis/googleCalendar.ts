import { google } from 'googleapis';
import dotenv from 'dotenv';
import type { Organization, Event } from '../../definitions.ts';
dotenv.config();

export async function fetchGoogleCalendarEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        const calendar = google.calendar({ version: 'v3', auth: process.env.GOOGLE_API_KEY });
        const calendarId = org.api;

        // Fetch events from the calendar
        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00 
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: today.toISOString(), // Start time (current date/time)
            timeMax: endSearchDate.toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = response.data.items || [];
        return events.map(event => standardizeGoogleEvent(event, org));

    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeGoogleEvent(event: any, org: Organization): Event {

    let organizationName = org.name;
    if (org.googleCalendarUseLocation && event.location){
        // append location to organization name
        let location = event.location.split(/,|-/)[0].trim(); // trim end off location
        organizationName = `${org.name} @ ${location}`;
    }

    return {
        name: event.summary,
        startDate: event.start.dateTime || event.start.date || undefined,
        endDate: event.end.dateTime || event.end.date || undefined,
        organizer: {
            name: organizationName,
        },
        url: org.eventPageUrl,
    };
}