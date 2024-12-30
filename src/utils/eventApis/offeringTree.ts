import { Organization, Event } from '../../definitions.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';

export async function fetchOfferingTreeEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00 
        let apiString = `${org.api}&start_date_time=${today.toISOString()}`;
        let response = await fetch(apiString);

        let offeringTreeEvents = await response.json();
        let events: Event[] = offeringTreeEvents.data.map((event: any) => standardizeOfferingTreeEvent(event, org));
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeOfferingTreeEvent(event: any, org: Organization): Event {
    return {
        name: event.attributes.event.title,
        startDate: event.attributes.start_date_time,
        endDate: event.attributes.end_date_time,
        organizer: {
            name: org.name,
        },
        url: org.eventPageUrl ? `${org.eventPageUrl}/${event.id}` : undefined,
    };
}

