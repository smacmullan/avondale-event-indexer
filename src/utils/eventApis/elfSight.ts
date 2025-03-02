import { Organization, Event } from '../../definitions.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';

export async function fetchElfSightEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // fetch event data
        let response = await fetch(org.api);
        let data = await response.json()
        let elfSightEvents = extractEventArray(data, org.api);

        let events: Event[] = elfSightEvents.map((event: any) => standardizeElfSightEvent(event, org));
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

function extractEventArray(json: any, api: string) {
    let widgetKey = new URL(api).searchParams.get('w') || '';
    return json?.data?.widgets?.[widgetKey]?.data?.settings?.events || [];
}


function standardizeElfSightEvent(event: any, org: Organization): Event {

    let startDate = new Date(`${event.start.date}T${event.start.time}:00`).toISOString();

    return {
        name: event.name,
        startDate,
        organizer: {
            name: org.name,
        },
        url: org.eventPageUrl || undefined,
    };
}