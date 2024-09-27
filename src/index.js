import fs from 'fs';
import { getEndOfWeek } from './utils/time.js';
import { printEventList } from './utils/printEventList.js';
import { fetchJsonLdEvents } from './utils/eventApis/jsonLd.js';
import { fetchGoogleCalendarEvents } from './utils/eventApis/googleCalendar.js';
import { fetchPlotEvents } from './utils/eventApis/plot.js';
import { fetchEventsCalendarCoEvents } from './utils/eventApis/eventsCalendarCo.js';
import { fetchDo312Events } from './utils/eventApis/do312.js';
import { fetchWebCalEvents } from './utils/eventApis/webcal.js';


async function fetchEvents(org){
    const endSearchDate = getEndOfWeek(2);
    switch (org.eventApiType) {
        case 'jsonLd':
            return await fetchJsonLdEvents(org, endSearchDate);
        case 'googleCalendar':
            return await fetchGoogleCalendarEvents(org, endSearchDate);
        case 'plot':
            return await fetchPlotEvents(org, endSearchDate);
        case 'do312':
            return await fetchDo312Events(org, endSearchDate);
        case 'webCal':
            return await fetchWebCalEvents(org, endSearchDate);
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

    // Consolidate all events into one array
    const allEvents = allEventsArrays.flat();
    // Save events to json
    fs.writeFileSync('output/events.json', JSON.stringify(allEvents, null, 2));
    // Print event list
    printEventList(allEvents);
}

main();