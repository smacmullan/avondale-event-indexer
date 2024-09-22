import fs from 'fs';
import { formatTimeRange, formatDay, eventSort } from './time.js';

export function printEventList(events, filePath="output/eventList.txt") {
    // Sort events by start date/time
    events.sort(eventSort);

    let currentDay = '';
    let textOutput = '';
    events.forEach(event => {
        const eventDay = formatDay(event);

        // Print the day only once per group of events
        if (eventDay !== currentDay) {
            currentDay = eventDay;
            textOutput += `\n\n${eventDay}\n`;
        }

        const organizationName = event.organizer.name || "Unknown";

        // Format the event summary
        const timeRange = formatTimeRange(event);
        textOutput += `* ${timeRange} - ${event.name} | ${organizationName}\n`;
    });

    try {
        fs.writeFileSync(filePath, textOutput);
        console.log(`Event list saved to "${filePath}"`);
    } catch (err) {
        console.error('Error writing event list text output to file', err);
    }
}