
import ical from 'ical';
import { decodeHtmlEntities } from '../html.js';

export async function fetchWebCalEvents(org, endSearchDate) {
    try {
        const response = await fetch(org.api);
        const data = await response.text();
        let calendarData = ical.parseICS(data);

        let events = filterEvents(calendarData, endSearchDate);
        return events.map(event => standardizeWebCalEvent(event, org));
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function filterEvents(data, endDate) {
    const today = new Date();
    const events = Object.values(data).filter(event => {
        if (event.type === 'VEVENT') {
            const eventStart = new Date(event.start);
            // const eventEnd = new Date(event.end);
            return eventStart >= today && (!endDate || eventStart <= endDate);
        }
        return false;
    });

    return events;
}


function standardizeWebCalEvent(event, org) {
    return {
        name: decodeHtmlEntities(event.summary),
        startDate: new Date(event.start),
        endDate: new Date(event.end),
        organizer: {
            name: event.organizer ? decodeHtmlEntities(event.organizer.val) : org.name,
        },
    };
}