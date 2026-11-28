import * as cheerio from 'cheerio';
import { z } from 'zod';
import type { Page } from 'puppeteer';
import { decodeHtmlEntities } from '../../utils/html.ts';
import type { EventSource, EventRecord } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import PuppeteerQueueManager from '../../utils/puppeteerQueueManager.ts';
import { fetchText, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    url: z.url()
        .describe('The event "hub" page that links to individual event pages'),
    linkBlockList: z.array(z.string()).optional()
        .describe('Event links ending with any of these are ignored (useful when the site links to another view of the same events)'),
    eventLinkMustInclude: z.string().optional()
        .describe('If set, only links containing this text count as event links. By default, links under the hub page\'s path or containing "event" count'),
    hubPageRequiresRendering: z.boolean().default(false)
        .describe('The hub page loads its links dynamically and needs a headless browser (slower, more resource intensive)'),
    eventPagesRequireRendering: z.boolean().default(false)
        .describe('The event pages load their JSON-LD dynamically and need a headless browser (slower, more resource intensive)'),
}).strict();

export type JsonLdOptions = z.infer<typeof optionsSchema>;

export const jsonLdIntegration = defineIntegration({
    type: 'jsonLd',

    docs: {
        title: 'JSON-LD',
        summary: 'Reads JSON-LD data embedded in event web pages. The preferred integration.',
        details:
            "JSON-LD is a web standard for embedding structured data in a page's HTML (a script tag of type " +
            '"application/ld+json"). Search engines such as Google index it too, so it is the preferred way for ' +
            'an organization to publish its events. Each event should have its own web page.\n\n' +
            "How it works: the hub page is loaded and its links collected and de-duplicated, then each link is " +
            "fetched and any JSON-LD Event data on it is read.\n\n" +
            'Some sites load their links or JSON-LD dynamically and need a headless browser; see the rendering ' +
            "options. This is much slower and heavier (pages are rendered through a shared queue), so consider " +
            "raising the source's timeoutMs.",
        example: { url: 'https://example.com/events' },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        // Failing to load the hub page throws (whole integration fails).
        const hubLinks = options.hubPageRequiresRendering
            ? await extractEventLinksFromRenderedPage(options, source)
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
                            return await extractJsonLdEventsFromRenderedPage(page, link, source);
                        });
                    } catch (error) {
                        console.error(`[${source.name}] Error processing event page: ${link}`, error instanceof Error ? error.message : error);
                        return null;
                    }
                })
            );
        }
        else {
            // get JSON LD data from static HTML with cheerio
            allEventData = await Promise.all(
                eventLinks.map(link => extractJsonLdEventsFromHtml(link, source))
            );
        }

        // Filter out any null values and flatten sub-arrays into single array
        const rawEvents = allEventData.filter(eventData => eventData !== null).flat();

        // This source can't pre-filter by date, so filter here.
        const events = standardizeAll(rawEvents, (event: any) => standardizeJsonLdEvent(event, source), source.name);
        return deduplicateEvents(
            events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate))
        );
    },
});


/**
 * Returns null (and logs) if the page can't be fetched, so one bad page doesn't sink the rest.
 * `shouldSkipPage` lets wrapper integrations ignore certain pages
 */
export async function extractJsonLdEventsFromHtml(
    url: string,
    source: EventSource,
    shouldSkipPage?: (page: cheerio.CheerioAPI) => boolean,
): Promise<any[] | null> {
    try {
        const $ = cheerio.load(await fetchText(url));
        if (shouldSkipPage?.($))
            return [];

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
                    console.error(`[${source.name}] Error parsing JSON-LD on ${url}:`, error);
                }
            }
        });

        jsonLdData = jsonLdData.flat();
        return jsonLdData.filter(item => item['@type'] && item['@type'].includes("Event"));
    } catch (error) {
        console.error(`[${source.name}] Error fetching a page (${url}):`, error instanceof Error ? error.message : error);
        return null;
    }
}

/** Returns null (and logs) if the page can't be processed. */
async function extractJsonLdEventsFromRenderedPage(page: Page, url: string, source: EventSource): Promise<any[] | null> {
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
        console.error(`[${source.name}] Error processing event page: ${url}`, error instanceof Error ? error.message : error);
        return null;
    }
}

async function extractEventLinksFromHtml(options: JsonLdOptions): Promise<string[]> {
    // Throws on a non-2xx response (whole integration fails)
    const $ = cheerio.load(await fetchText(options.url));

    // Get all event links on the page
    const links: string[] = [];
    $('a').each((i, element) => {
        const link = $(element).attr('href');
        if (link)
            links.push(link);
    });

    return filterLinksforEventLinks(links, options);
}

async function extractEventLinksFromRenderedPage(options: JsonLdOptions, source: EventSource): Promise<string[]> {
    const queueManager = PuppeteerQueueManager.getInstance();
    return await queueManager.queuePageOperation(async (page) => {
        const response = await page.goto(options.url, { waitUntil: 'networkidle0' });
        if (response && !response.ok())
            throw new Error(`[${source.name}] Hub page "${options.url}" returned HTTP ${response.status()}`);

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
export function standardizeJsonLdEvent(event: any, source: EventSource): EventRecord {
    const { name, startDate, endDate, location, url } = event;

    return {
        name: decodeHtmlEntities(name),
        startDate,
        endDate,
        organizer: {
            name: decodeHtmlEntities(location?.name) || source.displayName || source.name,
        },
        url,
    };
}

function deduplicateEvents(events: EventRecord[]) {
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