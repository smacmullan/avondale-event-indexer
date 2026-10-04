import type { Organization, Event } from '../../definitions.ts';
import { readFile } from 'fs/promises';
import { isEventUpcomingAndBeforeDate } from '../time.ts';

export async function fetchChicagoDotComEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // Chicago.com does not have a public events API yet, so copying website response data to file
        // load JSON data from file
        const fileContents = await readFile(org.api, 'utf8');
        const data = JSON.parse(fileContents);

        let events: Event[] = data.events.map(standardizeChicagoDotComEvent);
        events = events.filter((event: Event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}


function standardizeChicagoDotComEvent(event: any): Event {

    return {
        name: event.record.name,
        startDate: event.record.startsAt,
        endDate: event.record.endsAt,
        organizer: {
            name: event.record.locations?.[0]?.name || 'Chicago.com'
        },
        url: event.record.uris?.[0]?.uri || getChicagoDotComEventUrl(event.uri)
    };
}

function getChicagoDotComEventUrl(atProtocolUri: string) {
    // Note: hardcoded for avondale.chicago.com url
    if (!atProtocolUri) {
        return undefined;
    }

    const parts = atProtocolUri.split('/');
    const did = parts[2]?.replace('did:plc:', '');
    const eventId = parts[4];

    if (!did || !eventId)
        return undefined;
    else
        return `https://avondale.chicago.com/event/2Lws/did:plc:${did}-${eventId}`;
}