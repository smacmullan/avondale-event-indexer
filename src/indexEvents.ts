import fs from 'fs';
import { getEndOfWeek } from './utils/time.ts';
import { fetchJsonLdEvents } from './utils/eventApis/jsonLd.ts';
import { fetchGoogleCalendarEvents } from './utils/eventApis/googleCalendar.ts';
import { fetchPlotEvents } from './utils/eventApis/plot.ts';
import { fetchEventsCalendarCoEvents } from './utils/eventApis/eventsCalendarCo.ts';
import { fetchDo312Events } from './utils/eventApis/do312.ts';
import { fetchWebCalEvents } from './utils/eventApis/webcal.ts';
import { fetchMicrodataEvents } from './utils/eventApis/microdata.ts';
import { fetchGoogleSheetEvents } from './utils/eventApis/googleSheet.ts';
import type { Event, Organization } from './definitions.ts';
import { fetchWixEvents } from './utils/eventApis/wix.ts';
import { fetchBookManagerEvents } from './utils/eventApis/bookManager.ts';
import { fetchCpsEvents } from './utils/eventApis/chicagoPublicSchools.ts';
import { fetchOfferingTreeEvents } from './utils/eventApis/offeringTree.ts';
import { fetchCpdCapsEvents } from './utils/eventApis/cpdCaps.ts';
import { fetchElfSightEvents } from './utils/eventApis/elfSight.ts';
import { fetchChicagoBlockPartyEvents } from './utils/eventApis/chicagoBlockParties.ts';
import { fetchPopMenuEvents } from './utils/eventApis/popMenu.ts';


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
        case 'chicagoPublicSchools':
            return await fetchCpsEvents(org, endSearchDate);
        case 'offeringTree':
            return await fetchOfferingTreeEvents(org, endSearchDate);
        case 'cpdCaps':
            return await fetchCpdCapsEvents(org, endSearchDate);
        case 'elfSight':
            return await fetchElfSightEvents(org, endSearchDate);
        case 'chicagoBlockParties':
            return await fetchChicagoBlockPartyEvents(org, endSearchDate);
        case 'popMenu':
            return await fetchPopMenuEvents(org, endSearchDate);
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