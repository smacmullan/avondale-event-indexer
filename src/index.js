import fs from 'fs';
import { getEndOfWeek } from './utils/time.js';
import { printEventList } from './utils/printEventList.js';
import { fetchJsonLdEvents } from './utils/eventApis/jsonLd.js';
import { fetchGoogleCalendarEvents } from './utils/eventApis/googleCalendar.js';
import { fetchPlotEvents } from './utils/eventApis/plot.js';
import { fetchEventsCalendarCoEvents } from './utils/eventApis/eventsCalendarCo.js';


async function fetchEvents(org){
    const endSearchDate = getEndOfWeek(2);
    switch (org.eventApiType) {
        case 'jsonLd':
            return await fetchJsonLdEvents(org, endSearchDate);
        case 'googleCalendar':
            return await fetchGoogleCalendarEvents(org, endSearchDate);
        case 'plot':
            return await fetchPlotEvents(org, endSearchDate);
        case 'eventsCalendarCo':
            return await fetchEventsCalendarCoEvents(org, endSearchDate);
        default:
            console.log(`No matching API format found for "${org.eventApiType}" at ${org.name}`)
            return [];
    }
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