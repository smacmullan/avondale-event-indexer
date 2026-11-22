import * as cheerio from 'cheerio';
import { z } from 'zod';
import type { Page } from 'puppeteer';
import { decodeHtmlEntities } from '../html.ts';
import type { Organization, Event, EventIntegration } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';
import PuppeteerQueueManager from '../puppeteerQueueManager.ts';

const optionsSchema = z.object({
    /** The event "hub" page that links to individual event pages */
    url: z.url(),
    /** Event links ending with any of these are ignored */
    linkBlockList: z.array(z.string()).optional(),
    /** If set, only links containing this string count as event links */
    eventLinkMustInclude: z.string().optional(),
    /** The hub page needs a headless browser to render its links */
    hubPageRequiresRendering: z.boolean().default(false),
    /** The individual event pages need a headless browser to render their JSON-LD */
    eventPagesRequireRendering: z.boolean().default(false),
}).strict();

export type JsonLdOptions = z.infer<typeof optionsSchema>;

export const jsonLdIntegration = {
    type: 'jsonLd',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ org, options, endSearchDate }) {
        // Failing to load the hub page throws (whole integration fails).
        const hubLinks = options.hubPageRequiresRendering
            ? await extractEventLinksFromRenderedPage(options, org)
            : await extractEventLinksFromHtml(options);

        // Resolve relative links against the hub page so both fetch paths get absolute URLs
        const eventLinks = [...new Set(hubLinks.map(link => new URL(link, options.url).toString()))];

        // From here on, a failure on one event page only skips that page.
        let allEventData: any[];
        if (options.eventPagesRequireRendering) {
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
                eventLinks.map(link => extractJsonLdEventsFromHtml(link, org))
            );
        }

        // Filter out any null values and flatten sub-arrays into single array
        const rawEvents = allEventData.filter(eventData => eventData !== null).flat();

        // This source can't pre-filter by date, so filter here.
        let events = rawEvents.map((event: any) => standardizeJsonLdEvent(event, org));
        events = events.filter((event: Event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return deduplicateEvents(events);
    },
} satisfies EventIntegration<JsonLdOptions>;


/** Returns null (and logs) if the page can't be fetched, so one bad page doesn't sink the rest. */
async function extractJsonLdEventsFromHtml(url: string, org: Organization): Promise<any[] | null> {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const $ = cheerio.load(data);

        let jsonLdData: any[] = [];
        $('script[type="application/ld+json"]').each((i, element) => {
            const jsonLd = $(element).html();
            if (jsonLd) {
                try {
                    const jsonLdJSON = JSON.parse(jsonLd);
                    if (jsonLdJSON && !jsonLdJSON.url)
                        jsonLdJSON.url = url;

                    jsonLdData.push(jsonLdJSON);
                } catch (error) {
                    console.error(`[${org.name}] Error parsing JSON-LD on ${url}:`, error);
                }
            }
        });

        jsonLdData = jsonLdData.flat();
        return jsonLdData.filter(item => item['@type'] && item['@type'].includes("Event"));
    } catch (error) {
        console.error(`[${org.name}] Error fetching a page (${url}):`, error instanceof Error ? error.message : error);
        return null;
    }
}

/** Returns null (and logs) if the page can't be processed. */
async function extractJsonLdEventsFromRenderedPage(page: Page, url: string, org: Organization): Promise<any[] | null> {
    try {
        await page.goto(url, { waitUntil: 'load', timeout: 20000 });

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

        return jsonLdData.filter((item: any) => item['@type'] && item['@type'].includes('Event'));
    } catch (error) {
        console.error(`[${org.name}] Error processing event page: ${url}`, error instanceof Error ? error.message : error);
        return null;
    }
}

async function extractEventLinksFromHtml(options: JsonLdOptions): Promise<string[]> {
    const response = await fetch(options.url);
    if (!response.ok)
        throw new Error(`Hub page "${options.url}" returned HTTP ${response.status}`);

    const $ = cheerio.load(await response.text());

    // Get all event links on the page
    const links: string[] = [];
    $('a').each((i, element) => {
        const link = $(element).attr('href');
        if (link)
            links.push(link);
    });

    return filterLinksforEventLinks(links, options);
}

async function extractEventLinksFromRenderedPage(options: JsonLdOptions, org: Organization): Promise<string[]> {
    const queueManager = PuppeteerQueueManager.getInstance();
    return await queueManager.queuePageOperation(async (page) => {
        const response = await page.goto(options.url, { waitUntil: 'networkidle0' });
        if (response && !response.ok())
            throw new Error(`[${org.name}] Hub page "${options.url}" returned HTTP ${response.status()}`);

        // Extract links dynamically rendered on the page
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(anchor => anchor.href);
        });

        return filterLinksforEventLinks(links, options);
    });
}

function filterLinksforEventLinks(links: string[], options: JsonLdOptions): string[] {
    const eventHubPageUrl = options.url;
    const baseDir = (new URL(eventHubPageUrl)).pathname;

    // filter for event links
    let eventLinks: string[] = [];
    links.forEach((link: string) => {
        if (link) {
            const cleanLink = link.split('?')[0]; // remove query parameters

            if (options.eventLinkMustInclude) {
                if (cleanLink.includes(options.eventLinkMustInclude))
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
    const blockList = options.linkBlockList;
    if (blockList) {
        eventLinks = eventLinks.filter(link =>
            !blockList.some(toRemove => link.endsWith(toRemove))
        );
    }

    return eventLinks;
}


// Exported unchanged: other integrations may reuse it.
export function standardizeJsonLdEvent(event: any, org: Organization): Event {
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