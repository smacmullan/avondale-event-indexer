import { Organization, Event } from '../../definitions.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';

export async function fetchDo312Events(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // fetch event data
        let response = await fetch(org.api);
        let data = await response.json()
        let do312Events = data.event_groups.flatMap((group: any) => group.events);

        let events: Event[] = do312Events.map(standardizeDo312Event);
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

function standardizeDo312Event(event: any): Event {

    return {
        name: event.title,
        startDate: event.begin_time || event.begin_date,
        endDate: event.end_time,
        organizer: {
            name: event.venue.title,
        },
        url: event.permalink ? `https://do312.com${event.permalink}`: undefined,
    };
}