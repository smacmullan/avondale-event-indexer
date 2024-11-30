import ical from 'ical';
import { decodeHtmlEntities } from '../html.js';
import { Organization, Event } from '../../definitions.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';

export async function fetchWebCalEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        const response = await fetch(org.api);
        const data = await response.text();
        let calendarData = ical.parseICS(data);
        let webCalEvents = Object.values(calendarData);

        let events = webCalEvents.map(event => standardizeWebCalEvent(event, org));
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeWebCalEvent(event: any, org: Organization): Event {
    return {
        name: decodeHtmlEntities(event.summary),
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: event.organizer ? decodeHtmlEntities(event.organizer.val) : org.name,
        },
        url: org.eventPageUrl,
    };
}