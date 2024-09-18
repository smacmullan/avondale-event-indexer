import fs from 'fs';
import dotenv from 'dotenv'; 
dotenv.config();
import { formatTimeRange, formatDay, getEndOfWeek, eventSort } from './utils/time.js';
import { fetchGoogleCalendarEvents } from './utils/eventApis.js';


async function fetchEvents(org){
    const endSearchDate = getEndOfWeek(2);
    switch (org.eventApiType) {
        case 'googleCalendar':
            return await fetchGoogleCalendarEvents(org, endSearchDate);
        default:
            console.log(`No matching API format found for "${org.eventApiType}" at ${org.name}`)
            return [];
    }
}

function printEventList(events) {
    // Sort events by start date/time
    events.sort(eventSort);

    let currentDay = '';
    events.forEach(event => {
        const eventDay = formatDay(event);

        // Print the day only once per group of events
        if (eventDay !== currentDay) {
            currentDay = eventDay;
            console.log(`\n\n${eventDay}`);
        }

        const organizationName = event.organizer.name || "Unknown";

        // Format the event summary
        const timeRange = formatTimeRange(event);
        console.log(`* ${timeRange} - ${event.name} | ${organizationName}`);
    });
}



async function main() {

    const organizations = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));

    // Fetch events for each organization
    const eventPromises = organizations.map(org => fetchEvents(org));
    const allEventsArrays = await Promise.all(eventPromises);

    // Consolidate all events into one array and print the list
    const allEvents = allEventsArrays.flat();
    printEventList(allEvents);
}

main();