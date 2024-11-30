import * as cheerio from 'cheerio';
import { Organization, Event } from '../../definitions.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';

export async function fetchMicrodataEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        const response = await fetch(org.api);
        const data = await response.text();
        const $ = cheerio.load(data);

        // Extract event microdata
        const events: Event[] = [];
        $('article.event-list-object').each((i, element) => {
            const eventName = $(element).find('.event-object-title a[itemprop="name"] span').text().trim();
            const eventDate = $(element).find('meta[itemprop="startDate"]').attr('content');
            const eventLocation = $(element).find('a[itemprop="name"]').last().text().trim();
            
            const eventLink = $(element).find('.event-object-title a[itemprop="name"]').attr('href');
            let fullEventLink;
            if(eventLink)
                fullEventLink = new URL(eventLink, new URL(org.api)).href;

            events.push({
                name: eventName,
                startDate: eventDate + "Z", // "Z" forces dates to be treated as UTC
                organizer: {
                    name: eventLocation || org.name,
                },
                url: fullEventLink,
            });
        }); 

        let filteredEvents = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return filteredEvents;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}