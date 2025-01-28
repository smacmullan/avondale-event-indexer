import { Organization, Event } from '../../definitions.js';
import puppeteer from 'puppeteer';

export async function fetchCpdCapsEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // put dates into Unix timestamp format in seconds
        const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000); // today at 00:00 
        const endDate = Math.floor(endSearchDate.getTime() / 1000);

        let apiString = `https://www.chicagopolice.org/api/calendarEvents?start=${today}&end=${endDate}&view=day`;
        let events = await getEventsFromApi(apiString);

        // filter the data
        const policeBeats = org.api.split(',');
        events = events.filter((event: any) => isEventInBeats(event, policeBeats));
        events = events.filter(isCapsEvent);

        return events.map(standardizeCpdCapsEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

async function getEventsFromApi(site: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // navigate to the homepage to get proper browser cookies
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
        await page.goto("https://www.chicagopolice.org/community-engagement-calendar/");

        // fetch the data from API
        const data = await page.evaluate(
            async (site: string): Promise<any> => {
                const res = await fetch(site, {
                    method: 'GET',
                });
                return res.json();
            }, site);
        await browser.close();

        return data;
    } catch (ex) {
        throw (ex);
    } finally {
        await browser.close();
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
