import * as cheerio from 'cheerio';
import type { Page } from 'puppeteer';
import { decodeHtmlEntities } from '../../html.ts';
import type { Organization, Event } from '../../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../time.ts';
import PuppeteerQueueManager from '../../puppeteerQueueManager.ts';
import { standardizeJsonLdEvent } from '../jsonLd.ts';

/** 
*  The Avondale Small Business Association (ASBA) website hosts a dynamic siteMap.xml file that lists all the event webpages.
*  Event webpages have JSON LD data embedded in them.
*  ASBA is using Avondale Events as an event source but will show a link for those events, so each page is checked for an Avondale Events link
*  and skipped if found to avoid a recursive event indexing situation.
*/

// Function to scrape JSON-LD data from all event pages
export async function fetchAvondaleSbaEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {

    let eventLinks = await extractEventLinksFromSiteMap(org);

    // Concurrently get event data from individual event pages with queue/rate limiting
    let allEventData = [];
    // get JSON LD data from static HTML with cheerio
    allEventData = await Promise.all(
        eventLinks.map(async (link) => {
            // Create a new URL by appending the subdirectory to the original URL
            const fullUrl = new URL(link, org.api).toString();
            try {
                return await extractAsbaJsonLdEventsFromHtml(fullUrl, org);
            } catch (error) {
                console.error(`[${org.name}] Error processing event page: ${fullUrl}`, error instanceof Error ? error.message : error);
                return null;
            }
        })
    );

    // Filter out any null values and flatten sub-arrays into single array
    allEventData = allEventData.filter((eventData: any) => eventData !== null);
    allEventData = allEventData.flat();


    let events = allEventData.map((event: any) => standardizeJsonLdEvent(event, org));
    events = events.filter((event: Event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    return events;
}


// almost identical to extractJsonLdEventsFromHtml(), except it ignores pages where avondale events site is linked
async function extractAsbaJsonLdEventsFromHtml(url: string, org?: Organization) {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const $ = cheerio.load(data);

        // Skip pages that link to events.avondalechicago.org
        if ($('a[href*="events.avondalechicago.org"]').length > 0) {
            return null;
        }

        let jsonLdData: any[] = [];
        $('script[type="application/ld+json"]').each((i, element) => {
            const jsonLd = $(element).html();
            if (jsonLd) {
                try {
                    let jsonLdJSON = JSON.parse(jsonLd);
                    if (jsonLdJSON && !jsonLdJSON.url)
                        jsonLdJSON.url = url;

                    jsonLdData.push(jsonLdJSON);
                } catch (error) {
                    console.error('Error parsing JSON-LD:', error);
                }
            }
        });

        jsonLdData = jsonLdData.flat();
        const events = jsonLdData.filter(item => item['@type'] && item['@type'].includes("Event"));
        return events;
    } catch (error) {
        const orgName = org?.name || 'Unknown Organization';
        console.error(`Error fetching a page for ${orgName} (${url}):`, error instanceof Error ? error.message : error);
        return null;
    }
}


async function extractEventLinksFromSiteMap(org: Organization): Promise<string[]> {
    let baseUrl = org.api;
    const siteMapUrl = baseUrl + "/sitemap.xml";
    try {
        // Get and load the html
        const response = await fetch(siteMapUrl);
        const xml = await response.text();

        // using regex to parse URLs from XML
        const urls = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gs)].map(m => m[1]);

        // filter out links not under "/events/" subdirectory
        let eventLinks = urls.filter(url => url.startsWith(baseUrl + "/events/"));
        return eventLinks;
    } catch (error) {
        console.error(`Error fetching site map "${siteMapUrl}":`, error);
        return [];
    }
}