import * as cheerio from 'cheerio';
import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchText } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    url: z.url()
        .describe('Events listing page containing schema.org microdata'),
}).strict();

export type MicrodataOptions = z.infer<typeof optionsSchema>;

export const microdataIntegration = defineIntegration({
    type: 'microdata',

    docs: {
        title: 'Microdata',
        summary: 'Events from a listing page that uses schema.org microdata.',
        details:
            'Reads event entries from a listing page containing schema.org microdata. The page must use the ' +
            'event-list structure supported by this integration; each entry needs a name and start date.',
        example: { url: 'https://example.com/events' },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        const html = await fetchText(options.url);
        const $ = cheerio.load(html);

        // Extract event microdata. Elements missing a name or date are skipped.
        const events: EventRecord[] = [];
        $('article.event-list-object').each((i, element) => {
            const eventName = $(element).find('.event-object-title a[itemprop="name"] span').text().trim();
            const eventDate = $(element).find('meta[itemprop="startDate"]').attr('content');
            if (!eventName || !eventDate)
                return;

            const eventLocation = $(element).find('a[itemprop="name"]').last().text().trim();

            const eventLink = $(element).find('.event-object-title a[itemprop="name"]').attr('href');
            let fullEventLink: string | undefined;
            if (eventLink) {
                try {
                    fullEventLink = new URL(eventLink, options.url).href;
                } catch {
                    fullEventLink = undefined; // malformed link: keep the event without a url
                }
            }

            events.push({
                name: eventName,
                startDate: eventDate + "Z", // "Z" forces dates to be treated as UTC
                organizer: {
                    name: eventLocation || source.displayName || source.name,
                },
                url: fullEventLink,
            });
        });

        // The page can't filter by date, so filter here.
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
});