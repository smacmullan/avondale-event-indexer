const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config()


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

function printEventList(events){
    // console.log(events[0]) // print all information for one event
    if (events.length) {
        console.log('Upcoming events:');
        events.map((event, i) => {
            const start = event.start.dateTime || event.start.date;
            console.log(`${start} - ${event.summary}`);
        });
    } else {
        console.log('No upcoming events found.');
    }
}


async function main() {

    const organizations = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));

    // Fetch events for each organization
    const eventPromises = organizations.map(org => fetchCalendarEvents(org.api));
    const allEventsArrays = await Promise.all(eventPromises);

    // Consolidate all events into one array and print the list
    const allEvents = allEventsArrays.flat();
    printEventList(allEvents);
}

main();