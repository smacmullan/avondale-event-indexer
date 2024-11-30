import fs from 'fs';
import { getEndOfWeek } from './utils/time.js';
import { fetchJsonLdEvents } from './utils/eventApis/jsonLd.js';
import { fetchGoogleCalendarEvents } from './utils/eventApis/googleCalendar.js';
import { fetchPlotEvents } from './utils/eventApis/plot.js';
import { fetchEventsCalendarCoEvents } from './utils/eventApis/eventsCalendarCo.js';
import { fetchDo312Events } from './utils/eventApis/do312.js';
import { fetchWebCalEvents } from './utils/eventApis/webcal.js';
import { fetchMicrodataEvents } from './utils/eventApis/microdata.js';
import { fetchGoogleSheetEvents } from './utils/eventApis/googleSheet.js';
import { Event, Organization } from './definitions.js';
import { fetchWixEvents } from './utils/eventApis/wix.js';
import { fetchBookManagerEvents } from './utils/eventApis/bookManager.js';


export async function fetchEvents(org: Organization, weeksOut = 2): Promise<Event[]> {
    const endSearchDate = getEndOfWeek(weeksOut);
    switch (org.eventApiType) {
        case 'jsonLd':
            return await fetchJsonLdEvents(org, endSearchDate);
        case 'googleCalendar':
            return await fetchGoogleCalendarEvents(org, endSearchDate);
        case 'googleSheet':
            return await fetchGoogleSheetEvents(org, endSearchDate);
        case 'plot':
            return await fetchPlotEvents(org, endSearchDate);
        case 'do312':
            return await fetchDo312Events(org, endSearchDate);
        case 'webCal':
            return await fetchWebCalEvents(org, endSearchDate);
        case 'microdata':
            return await fetchMicrodataEvents(org, endSearchDate);
        case 'wix':
            return await fetchWixEvents(org, endSearchDate);
        case 'bookManager':
            return await fetchBookManagerEvents(org, endSearchDate);
        case 'eventsCalendarCo':
            return await fetchEventsCalendarCoEvents(org, endSearchDate);
        default:
            console.log(`No matching API format found for "${org.eventApiType}" at ${org.name}`)
            return [];
    }
}

export async function indexEvents(organizations: Organization[]) {

    console.log("Getting event data...");

    // Fetch events for each organization
    const eventPromises = organizations.map(org => fetchEvents(org));
    const allEventsArrays = await Promise.all(eventPromises);

    // Consolidate all events into one array
    const allEvents = allEventsArrays.flat();

    // Save events to json
    const filePath = 'output/rawEvents.json';
    fs.writeFileSync(filePath, JSON.stringify(allEvents, null, 2));
    console.log(`Event data saved to "${filePath}"`);

    return allEvents;
}