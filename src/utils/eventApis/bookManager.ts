import type { Organization, Event } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';

export async function fetchBookManagerEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        const [storeId, baseUrl] = await getStoreInfo(org.api);
        let bookManagerEvents = await getBookManagerEventsFromApi(storeId);
        let events: Event[] = bookManagerEvents.map((event: any) => standardizeBookManagerEvent(event, org, baseUrl))
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching bookManager calendar events for ${org.name}.`, error);
        return [];
    }
}

async function getStoreInfo(webstoreName: string) {
    const formData = new FormData();
    formData.append("webstore_name", webstoreName);

    const requestOptions: RequestInit = {
        method: "POST",
        body: formData,
        redirect: "follow"
    };

    const response = await fetch("https://api.bookmanager.com/customer/store/getSettings", requestOptions);
    const data = await response.json();
    return [data.store_info.id, data.store_info.base_url];
}

async function getBookManagerEventsFromApi(storeId: string) {
    const sessionId = await getSessionId(storeId);

    const formData = new FormData();
    formData.append("store_id", storeId);
    formData.append("session_id", sessionId);

    const requestOptions: RequestInit = {
        method: "POST",
        body: formData,
        redirect: "follow"
    };

    const response = await fetch("https://api.bookmanager.com/customer/event/v2/list", requestOptions);
    const data = await response.json();
    return data.rows;
}


async function getSessionId(storeId: string): Promise<string> {
    const formData = new FormData();
    formData.append("store_id", storeId);

    const requestOptions: RequestInit = {
        method: "POST",
        body: formData,
        redirect: "follow"
    };

    const response = await fetch("https://api.bookmanager.com/customer/session/get", requestOptions);
    const data = await response.json();
    return data.session_id;
}


function standardizeBookManagerEvent(event: any, org: Organization, baseUrl?: string): Event {
    return {
        name: event.title,
        startDate: convertBookManagerDateTimestampToIsoString(event.date, event.start_time),
        endDate: convertBookManagerDateTimestampToIsoString(event.date, event.end_time),
        organizer: {
            name: org.name,
        },
        url: baseUrl ? `${baseUrl}/events/${event.id}` : undefined,
    };
}

function convertBookManagerDateTimestampToIsoString(date: string, time: string): string {
    // Construct a local Date object
    const localDateTime = new Date(
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time}`
    );

    return localDateTime.toISOString();
}

// Not used as of API V2
function convertUnixTimestampToIsoString(timestamp: number): string {
    // bookManager Unix timestamps are, for unknown reasons, two hours ahead of the actual event time
    const twoHours = 2 * 60 * 60;
    let roundedTimestamp = roundDownToNearestMinute(timestamp);
    return new Date((roundedTimestamp - twoHours) * 1000).toISOString();
}

function roundDownToNearestMinute(timestamp: number): number {
    return Math.floor(timestamp / 60) * 60;
}