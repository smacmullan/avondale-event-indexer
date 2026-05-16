import type { Organization, Event } from '../../definitions.ts';
import PuppeteerQueueManager from '../puppeteerQueueManager.ts';

export async function fetchCpdCapsEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // put dates into Unix timestamp format in seconds
        const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000); // today at 00:00 
        const endDate = Math.floor(endSearchDate.getTime() / 1000);

        let apiString = `https://www.chicagopolice.org/api/calendarEvents?start=${today}&end=${endDate}&view=day`;
        let events = await getEventsFromApi(apiString, org);

        // filter the data
        const policeBeats = org.api.split(',');
        events = events.filter((event: any) => isEventInBeats(event, policeBeats));
        events = events.filter(isCapsEvent);

        return events.map(standardizeCpdCapsEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}:`, error);
        return [];
    }
}

async function getEventsFromApi(site: string, org: Organization) {
    const queueManager = PuppeteerQueueManager.getInstance();

    try {
        return await queueManager.queuePageOperation(async (page) => {
            try {
                // navigate to the homepage to get proper browser cookies
                await page.goto("https://www.chicagopolice.org/community-engagement-calendar/", { waitUntil: 'networkidle2' });

                // fetch the data from API
                const data = await page.evaluate(
                    async (site: string): Promise<any> => {
                        const res = await fetch(site, {
                            method: 'GET',
                        });
                        return res.json();
                    }, site);

                return data;
            } catch (error) {
                console.error(`Error fetching CPD CAPS events for ${org.name}:`, error);
                throw error;
            }
        });
    } catch (error) {
        console.error(`Failed to retrieve CPD CAPS data for ${org.name} (${site}):`, error);
        throw error;
    }
}

function isEventInBeats(event: any, beats: string[]): boolean {
    return event.attendees.some((attendee: string) => beats.includes(attendee));
}

function isCapsEvent(event: any): boolean {
    return event.title.toUpperCase().includes("BEAT")
        || event.attendees.some((attendee: string) => attendee.toUpperCase().includes("CAPS"))
        || event.body.toUpperCase().includes("CAPS");
}

function standardizeCpdCapsEvent(event: any): Event {
    return {
        name: event.title,
        startDate: event.start,
        endDate: event.end,
        organizer: {
            name: event.location,
        },
        url: "https://www.chicagopolice.org/community-engagement-calendar/",
    };
}
