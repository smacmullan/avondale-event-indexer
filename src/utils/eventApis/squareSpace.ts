import type { Organization, Event } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';

export async function fetchSquareSpaceEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // fetch event data
        // SquareSpace API groups events by month, require multiple calls depending on time range
        const monthStrings = generateMonthStrings(endSearchDate);
        let squareSpaceEvents: any[] = [];
        for (const monthString of monthStrings) {
            let url = `${org.api}&month=${monthString}`;
            let response = await fetch(url);
            let monthEvents = await response.json()
            squareSpaceEvents.push(...monthEvents);
        }

        // standardize events and filter by start time
        let events: Event[] = squareSpaceEvents.map((event: any) => standardizeSquareSpaceEvents(event, org));
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));

        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

/** 
* Build an array of month strings (MM-YYYY) between today and endSearchDate. 
*/
function generateMonthStrings(endSearchDate: Date): string[] {
    const today = new Date();

    const monthStrings: string[] = [];
    const current = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(endSearchDate.getFullYear(), endSearchDate.getMonth(), 1);
    while (current <= end) {
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const year = current.getFullYear();

        monthStrings.push(`${month}-${year}`);

        current.setMonth(current.getMonth() + 1);
    }
    return monthStrings;
}

function standardizeSquareSpaceEvents(event: any, org: Organization): Event {
    return {
        name: event.title,
        startDate: new Date(event.startDate).toISOString(),
        endDate: new Date(event.endDate).toISOString(),
        organizer: {
            name: org.name,
        },
        url: org.eventPageUrl || undefined,
    };
}