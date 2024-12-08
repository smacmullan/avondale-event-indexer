import { Organization, Event } from '../../definitions.js';

export async function fetchCpsEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // put dates into YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const endDate = endSearchDate.toISOString().split('T')[0];
        const categories = "1149%2C1151%2C1097%2C1135%2C1150%2C1148%2C1106%2C1165%2C1142%2C1118";

        let apiString = `https://www.cps.edu/api/calendar/getevents?categories=${categories}&tags=&start=${today}&end=${endDate}`;
        let response = await fetch(apiString);
        let cpsEvents = await response.json()
        cpsEvents = cpsEvents.filter((event: any) => event.extendedProps.eventLocationTitle.includes(org.api))
        return cpsEvents.map(standardizeCpsEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeCpsEvent(event: any, org: Organization): Event {
    return {
        name: event.title,
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: event.extendedProps.eventLocationTitle,
        },
        url: "https://www.cps.edu/calendar",
    };
}