import * as cheerio from 'cheerio';
import { Organization, Event } from '../../definitions.js';

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

            events.push({
                name: eventName,
                startDate: eventDate + "Z", // "Z" forces dates to be treated as UTC
                organizer: {
                    name: eventLocation || org.name,
                }
            });
        }); 

        // filter events by date
        let today = new Date();
        let filteredEvents = events.filter(event => event.startDate && new Date(event.startDate) > today && new Date(event.startDate) < endSearchDate);

        return filteredEvents;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}