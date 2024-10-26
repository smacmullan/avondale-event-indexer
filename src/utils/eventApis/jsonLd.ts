import * as cheerio from 'cheerio';
import { decodeHtmlEntities } from '../html.js';
import { Organization, Event } from '../../definitions.js';

// Function to scrape JSON-LD data from all event pages
export async function fetchJsonLdEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {

    const eventLinks = await extractEventLinks(org);

    // Concurrently get event data from individual event pages
    let allEventData = [];
    const eventExtractPromises = eventLinks.map(async (link) => {
        // Create a new URL by appending the subdirectory to the original URL
        const fullUrl = new URL(link, org.api).toString();
        try {
            const eventData = await extractJsonLdEvents(fullUrl);
            return eventData;  // Return the extracted data
        } catch (error) {
            console.log(`Error processing ${fullUrl}:`, error);
            return null;
        }
    });
    allEventData = await Promise.all(eventExtractPromises);

    // Filter out any null values and flatten sub-arrays into single array
    allEventData = allEventData.filter(eventData => eventData !== null);
    allEventData = allEventData.flat();

    // Filter out events outside time range
    let today = new Date();
    const filteredEventData = allEventData.filter(event => event.startDate && new Date(event.startDate) > today && new Date(event.startDate) < endSearchDate);

    return filteredEventData.map(event => standardizeJsonLdEvent(event, org));
}


async function extractJsonLdEvents(url: string) {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const $ = cheerio.load(data);

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
        console.error('Error fetching the page:', error);
        return null;
    }
}


async function extractEventLinks(org: Organization): Promise<string[]> {
    const eventHubPageUrl = org.api;
    try {
        // Get and load the html
        const response = await fetch(eventHubPageUrl);
        const data = await response.text();
        const $ = cheerio.load(data);

        // Get all event links on the page
        let baseDir = (new URL(eventHubPageUrl)).pathname;
        let eventLinks: string[] = [];
        $('a').each((i, element) => {
            const link = $(element).attr('href');
            if (link) {
                const cleanLink = link.split('?')[0]; //remove query parameters
                if (cleanLink.startsWith(baseDir)
                    || cleanLink.startsWith(eventHubPageUrl)
                    || cleanLink.includes(org.jsonLdEventLinkMustInclude || "event"))
                    eventLinks.push(cleanLink);
            }
        });

        // deduplicate event links
        eventLinks = Array.from(new Set(eventLinks));

        // Remove the hub link if it shows up on the page
        eventLinks = eventLinks.filter(link => link !== eventHubPageUrl);

        // Filter out links on block list
        let blockList = org.jsonLdLinkBlockList;
        if (blockList) {
            eventLinks = eventLinks.filter(link =>
                !blockList.some(toRemove => link.endsWith(toRemove))
            );
        }

        return eventLinks;

    } catch (error) {
        console.error(`Error fetching the main event page "${eventHubPageUrl}":`, error);
        return [];
    }
}


function standardizeJsonLdEvent(event: any, org: Organization): Event {
    const { name, startDate, endDate, location, url } = event;

    return {
        name: decodeHtmlEntities(name),
        startDate,
        endDate,
        organizer: {
            name: decodeHtmlEntities(location?.name) || org.name,
        },
        url,
    };
}