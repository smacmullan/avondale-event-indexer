import { Organization, Event } from '../../definitions.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';

export async function fetchPopMenuEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {

        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00 

        // fetch event data
        const response = await fetch(`${org.api}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": org.api,
            },
            body: JSON.stringify({
                operationName: "customPageCalendarSection",
                variables: {
                    rangeStartAt: today,
                    rangeEndAt: endSearchDate,
                    sectionId: 3327818
                },
                extensions: {
                    operationId: "PopmenuClient/84a8c72179c517e7d584420f7a69a194",
                },
            }),
        });
        const data = await response.json();
        let eventData = data?.data?.customPageSection?.upcomingCalendarEvents;
        
        // TODO populate recurring events and combine with non-recurring
        let singleInstanceEventData = eventData.filter((event: any) => event?.isRecurring == false);
        
        let events: Event[] = singleInstanceEventData.map((event: any) => standardizePopMenuEvent(event, org));
        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

function standardizePopMenuEvent(event: any, org: Organization): Event {
    return {
        name: event.name,
        startDate: getISODateString(event.startAt, event.startTime),
        endDate: getISODateString(event.endAt || event.startAt, event.endTime),
        organizer: {
            name: org.name,
        },
        url: `${org.api}/events/${event.slug}`,
    };
}

function getISODateString(startAtText: string, startTimeUtcSeconds: number): string {
    let date = new Date(`${startAtText}T00:00:00Z`);
    date.setUTCSeconds(date.getUTCSeconds() + startTimeUtcSeconds);
    return date.toISOString();
}