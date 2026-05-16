import * as cheerio from 'cheerio';
import type { Page } from 'puppeteer';
import { decodeHtmlEntities } from '../html.ts';
import type { Organization, Event } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';
import PuppeteerQueueManager from '../puppeteerQueueManager.ts';

// Function to scrape JSON-LD data from all event pages
export async function fetchJsonLdEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {

    let eventLinks: string[];
    if (org.jsonLdHubPageRequiresRendering)
        eventLinks = await extractEventLinksFromRenderedPage(org);
    else
        eventLinks = await extractEventLinksFromHtml(org);

    // Concurrently get event data from individual event pages with queue/rate limiting
    let allEventData = [];
    if (org.jsonLdEventPagesRequireRendering) {
        // Use queue manager to control concurrent puppeteer operations
        const queueManager = PuppeteerQueueManager.getInstance();
        allEventData = await Promise.all(
            eventLinks.map(async (link) => {
                try {
                    return await queueManager.queuePageOperation(async (page) => {
                        return await extractJsonLdEventsFromRenderedPage(page, link, org);
                    });
                } catch (error) {
                    console.error(`[${org.name}] Error processing event page: ${link}`, error instanceof Error ? error.message : error);
                    return null;
                }
            })
        );
    }
    else {
        // get JSON LD data from static HTML with cheerio
        allEventData = await Promise.all(
            eventLinks.map(async (link) => {
                // Create a new URL by appending the subdirectory to the original URL
                const fullUrl = new URL(link, org.api).toString();
                try {
                    return await extractJsonLdEventsFromHtml(fullUrl, org);
                } catch (error) {
                    console.error(`[${org.name}] Error processing event page: ${fullUrl}`, error instanceof Error ? error.message : error);
                    return null;
                }
            })
        );
    }

    // Filter out any null values and flatten sub-arrays into single array
    allEventData = allEventData.filter((eventData: any) => eventData !== null);
    allEventData = allEventData.flat();


    let events = allEventData.map((event: any) => standardizeJsonLdEvent(event, org));
    events = events.filter((event: Event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    events = deduplicateEvents(events);
    return events;
}


async function extractJsonLdEventsFromHtml(url: string, org?: Organization) {
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
        const orgName = org?.name || 'Unknown Organization';
        console.error(`Error fetching a page for ${orgName} (${url}):`, error instanceof Error ? error.message : error);
        return null;
    }
}

async function extractJsonLdEventsFromRenderedPage(page: Page, url: string, org?: Organization) {
    const orgName = org?.name || 'Unknown Organization';
    try {
        // Use faster waitUntil strategy to avoid waiting for slow external resources
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Extract JSON-LD data
        const jsonLdData = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(script => {
                try {
                    return JSON.parse(script.textContent || '{}');
                } catch {
                    return null;
                }
            }).filter(item => item !== null);
        });

        // Add `url` to JSON-LD data if missing
        jsonLdData.forEach((item: any) => {
            if (item && !item.url) {
                item.url = url;
            }
        });

        const events = jsonLdData.filter((item: any) => item['@type'] && item['@type'].includes('Event'));
        return events;
    } catch (error) {
        console.error(`[${orgName}] Error processing event page: ${url}`, error instanceof Error ? error.message : error);
        return null;
    }
}

async function extractEventLinksFromHtml(org: Organization): Promise<string[]> {
    const eventHubPageUrl = org.api;
    try {
        // Get and load the html
        const response = await fetch(eventHubPageUrl);
        const data = await response.text();
        const $ = cheerio.load(data);

        // Get all event links on the page
        let links: string[] = [];
        $('a').each((i, element) => {
            const link = $(element).attr('href');
            if (link)
                links.push(link);
        });

        let eventLinks = filterLinksforEventLinks(links, org);
        return eventLinks;
    } catch (error) {
        console.error(`Error fetching the main event page "${eventHubPageUrl}":`, error);
        return [];
    }
}


async function extractEventLinksFromRenderedPage(org: Organization): Promise<string[]> {
    const eventHubPageUrl = org.api;
    try {
        const queueManager = PuppeteerQueueManager.getInstance();
        const eventLinks = await queueManager.queuePageOperation(async (page) => {
            await page.goto(eventHubPageUrl, { waitUntil: 'networkidle0' });

            // Extract links dynamically rendered on the page
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).map(anchor => anchor.href);
            });

            return filterLinksforEventLinks(links, org);
        });

        return eventLinks;
    } catch (error) {
        console.error(`[${org.name}] Error processing hub page: ${eventHubPageUrl}`, error instanceof Error ? error.message : error);
        return [];
    }
}


function filterLinksforEventLinks(links: string[], org: Organization): string[] {
    const eventHubPageUrl = org.api;
    let baseDir = (new URL(eventHubPageUrl)).pathname;

    // filter for event links
    let eventLinks: string[] = [];
    links.forEach((link: string) => {
        if (link) {
            const cleanLink = link.split('?')[0]; //remove query parameters

            if (org.jsonLdEventLinkMustInclude) {
                if (cleanLink.includes(org.jsonLdEventLinkMustInclude))
                    eventLinks.push(cleanLink);
            }
            else {
                if (cleanLink.startsWith(baseDir)
                    || cleanLink.startsWith(eventHubPageUrl)
                    || cleanLink.includes("event"))
                    eventLinks.push(cleanLink);
            }
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

function deduplicateEvents(events: Event[]) {
    const uniqueEvents = [
        ...new Map(
            events.map(event => [
                `${event.name}|${new Date(event.startDate).getTime()}`, // Unique key on name and start time
                event
            ])
        ).values()
    ];
    return uniqueEvents;
}