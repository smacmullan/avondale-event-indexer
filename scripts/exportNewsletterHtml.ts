import fs from 'fs';
import { formatTimeRange, formatDay, isISODate, getDateFromISODate } from '../src/utils/time.ts';
import type { Event } from '../src/definitions.ts';

export function generateNewsletterHtml(filePath = "output/newsletterEvents.html") {

    let events = JSON.parse(fs.readFileSync('./output/events.json', 'utf-8')) as Event[];
    events = filterEventsForUpcomingWeek(events);
    
    let currentDay = '';
    let textOutput = '';
    events.forEach(event => {
        const eventDay = formatDay(event);

        // Print the day only once per group of events
        if (eventDay != currentDay) {
            if (currentDay) {
                //add closing tags for the previous day (except first day)
                textOutput += `</tbody></table>`;
            }

            currentDay = eventDay;
            textOutput += `<p style="padding-bottom: 20px; padding-top: 30px;"><strong><span style="font-size: 20px">${eventDay}</span></strong></p><table style="width: 100%; border-collapse: collapse;"><tbody>`;
        }

        const organizationName = event.organizer?.name || "";
        const timeRange = formatTimeRange(event);

        let nameHtml = event.url? `<a href="${event.url}" target="_blank">${event.name}</a>` : event.name;
        textOutput += `<tr><td style="width: 90px; vertical-align: top;  padding-bottom: 10px;"><p style="text-align: right; padding-right: 10px;"><strong>${timeRange}</strong></p></td><td style="padding-bottom: 10px;">${nameHtml}${organizationName ? ` - ${organizationName}`: ""}</p></td></tr>`;
    });

    //add closing tags for the last day
    textOutput += `</tbody></table>`;

    try {
        fs.writeFileSync(filePath, textOutput);
        console.log(`Newsletter event list saved to "${filePath}"`);
    } catch (err) {
        console.error('Error writing newsletter event list HTML output to file', err);
    }
}

function filterEventsForUpcomingWeek(events: Event[]): Event[] {
    const now = new Date();
    // Calculate upcoming Monday: if today is Monday, diff will be 0.
    const diffToMonday = (1 - now.getDay() + 7) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // Next Monday marks the end of the week (exclusive)
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    return events.filter(event => {
        const eventDate = isISODate(event.startDate) ? getDateFromISODate(event.startDate) : new Date(event.startDate);
        return eventDate >= monday && eventDate < nextMonday;
    });
}


generateNewsletterHtml();