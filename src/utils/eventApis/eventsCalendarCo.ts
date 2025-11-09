import type { Organization, Event } from '../../definitions.ts';

export async function fetchEventsCalendarCoEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // put dates into Unix timestamp format
        const today = new Date().setHours(0, 0, 0, 0); // today at 00:00 
        const endDate = endSearchDate.getTime();

        let apiString = `https://${org.api}&from=${today}&to=${endDate}`;
        let response = await fetch(apiString);
        let data = await response.json();
        return data.events.map(standardizeEventsCalendarCoEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeEventsCalendarCoEvent(event: any): Event {
    const { title, start_time, end_time, location, event_link } = event;

    return {
        name: title,
        startDate: start_time,
        endDate: end_time,
        organizer: {
            name: location,
        },
        url: event_link || undefined,
    };
}
