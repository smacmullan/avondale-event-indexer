import fs from 'fs';
import { formatTimeRange, formatDay } from './utils/time.ts';
import type { Event } from './definitions.ts';

export function printEventList(events: Event[], filePath = "output/eventList.md") {
    console.log("Converting event data into event list...");

    let currentDay = '';
    let textOutput = '';
    events.forEach(event => {
        try {
            const eventDay = formatDay(event);

            // Print the day only once per group of events
            if (eventDay !== currentDay) {
                currentDay = eventDay;
                textOutput += `\n\n## ${eventDay}\n`;
            }

            const organizationName = event.organizer?.name || "";

            // Format the event summary
            const timeRange = formatTimeRange(event);
            textOutput += `* **${timeRange}**   ${event.name} ${organizationName ? `| ${organizationName}` : ""}\n`;
        }
        catch (err) {
            console.error('Error formatting event', event);
        }
    });

    try {
        fs.writeFileSync(filePath, textOutput);
        console.log(`Event list saved to "${filePath}"`);
    } catch (err) {
        console.error('Error writing event list text output to file', err);
    }
}