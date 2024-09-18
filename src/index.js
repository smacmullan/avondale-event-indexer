import { google } from 'googleapis';
import fs from 'fs'; // Change require to import
import dotenv from 'dotenv'; // Change require to import
import { formatTimeRange, formatDay } from './utils/timeFormat.js';
dotenv.config();


async function fetchCalendarEvents(calendarId) {
    try {
        const calendar = google.calendar({ version: 'v3', auth: process.env.GOOGLE_API_KEY });

        // Fetch events from the calendar
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: (new Date()).toISOString(), // Start time (current date/time)
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = response.data.items;
        return events;

    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return [];
    }
}

function printEventList(events, organizationsData) {
    // Sort events by start date/time
    events.sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date));

    let currentDay = '';
    events.forEach(event => {
        const eventDay = formatDay(event);

        // Print the day only once per group of events
        if (eventDay !== currentDay) {
            currentDay = eventDay;
            console.log(`\n\n${eventDay}`);
        }

        // Find the organization based on the organizer's email
        const org = organizationsData.find(org => org.api === event.organizer.email);
        const organizationName = org ? org.name : 'Unknown Organization';

        // Format the event summary
        const timeRange = formatTimeRange(event);
        console.log(`* ${timeRange} - ${event.summary} @ ${organizationName}`);
    });
}



async function main() {

    const organizations = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));

    // Fetch events for each organization
    const eventPromises = organizations.map(org => fetchCalendarEvents(org.api));
    const allEventsArrays = await Promise.all(eventPromises);

    // Consolidate all events into one array and print the list
    const allEvents = allEventsArrays.flat();
    printEventList(allEvents, organizations);
}

main();