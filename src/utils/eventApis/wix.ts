import { Organization, Event } from '../../definitions.js';
import puppeteer from 'puppeteer';
import { isUpcomingEventBeforeTime } from '../time.js';

export async function fetchWixEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        let wixEvents = await getWixEventJsonFromApi(org.api);
        let events: Event[] = wixEvents.map((event: any) => standardizeWixEvent(event, org))
        events = events.filter((event) => isUpcomingEventBeforeTime(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching Wix calendar events for ${org.name}.`, error);
        return [];
    }
}

// this approach has only been tested on https://www.centralparkbarchicago.com
async function getWixEventJsonFromApi(site: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // navigate to the homepage to get proper browser cookies
        await page.goto(site);
        // call the API
        const data = await page.evaluate(
            async (site: string): Promise<any> => {
                const res = await fetch(`${site}/_api/wix-one-events-server/html/v2/widget-data?listLayout=5`, {
                    method: 'GET',
                });
                return res.json();
            }, site);
        await browser.close();

        return data.component.events;
    } catch (ex) {
        throw (ex);
    } finally {
        await browser.close();
    }

}


function standardizeWixEvent(event: any, org: Organization): Event {
    return {
        name: event.title,
        startDate: event.scheduling.config.startDate,
        endDate: event.scheduling.config.endDate,
        organizer: {
            name: org.name,
        },
        url: event.slug ? `${org.api}/events/${event.slug}` : undefined,
    };
}