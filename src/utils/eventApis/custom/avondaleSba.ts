import { z } from 'zod';
import type * as cheerio from 'cheerio';
import type { Event, EventIntegration } from '../../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../time.ts';
import { fetchText, standardizeAll } from '../../integrationHelpers.ts';
import { extractJsonLdEventsFromHtml, standardizeJsonLdEvent } from '../jsonLd.ts';
 
/**
 *  The Avondale Small Business Association (ASBA) website hosts a dynamic sitemap.xml file that lists all the event webpages.
 *  Event webpages have JSON LD data embedded in them.
 *  ASBA is using Avondale Events as an event source but will show a link for those events, so each page is checked for an Avondale Events link
 *  and skipped if found to avoid a recursive event indexing situation.
 */
 
const optionsSchema = z.object({
    /** Site base URL, e.g. https://avondalesba.org (trailing slash is removed). Its sitemap.xml lists the event pages. */
    url: z.url().transform(value => value.replace(/\/+$/, '')),
}).strict();
 
export type AvondaleSbaOptions = z.infer<typeof optionsSchema>;
 
const AVONDALE_EVENTS_LINK_SELECTOR = 'a[href*="events.avondalechicago.org"]';
 
export const avondaleSbaIntegration = {
    type: 'avondaleSba',
 
    parseOptions: raw => optionsSchema.parse(raw),
 
    async fetchEvents({ org, options, endSearchDate }) {
        // Failing to load the sitemap throws (whole integration fails).
        const eventLinks = await extractEventLinksFromSiteMap(options.url);
 
        // From here on, a failure on one event page only skips that page.
        const pages = await Promise.all(
            eventLinks.map(link =>
                extractJsonLdEventsFromHtml(new URL(link, options.url).toString(), org, linksToAvondaleEvents)
            )
        );
        const rawEvents = pages.filter((page): page is any[] => page !== null).flat();
 
        const events = standardizeAll(rawEvents, (event: any) => standardizeJsonLdEvent(event, org), org.name);
 
        // Pages can't be filtered by date up front, so filter here.
        return events.filter((event: Event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<AvondaleSbaOptions>;
 
/** Pages that link to the Avondale Events site are skipped to avoid indexing events twice. */
function linksToAvondaleEvents(page: cheerio.CheerioAPI): boolean {
    return page(AVONDALE_EVENTS_LINK_SELECTOR).length > 0;
}
 
async function extractEventLinksFromSiteMap(baseUrl: string): Promise<string[]> {
    const xml = await fetchText(`${baseUrl}/sitemap.xml`);
 
    // using regex to parse URLs from XML
    const urls = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gs)].map(m => m[1]);
 
    // filter out links not under "/events/" subdirectory
    return urls.filter(url => url.startsWith(baseUrl + "/events/"));
}
 