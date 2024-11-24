import fs from 'fs';
import { formatTimeRange, formatDay, eventSort } from './utils/time.js';
import { Event } from './definitions.js';

export function printEventList(events: Event[], filePath = "output/eventList.md") {

    events.sort(eventSort);
    events = cleanupEvents(events);

    try {
        fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));
    } catch (err) {
        console.error('Error writing event data to file', err);
    }

    let currentDay = '';
    let textOutput = '';
    events.forEach(event => {
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
    });

    try {
        fs.writeFileSync(filePath, textOutput);
        console.log(`Event list saved to "${filePath}"`);
    } catch (err) {
        console.error('Error writing event list text output to file', err);
    }
}

/**
* Remove closed events and trim names that include locations.
*/
function cleanupEvents(events: Event[]) {
    events = events.filter(event => {
        let eventName = event.name as string;

        // Remove events with "closed" in the name
        if (!eventName || eventName.toLowerCase().includes('closed')) {
            console.log(`Removed "${event.name}" from the event list`);
            return false; // Filter out the event
        }

        // Rename events with "@", "—", or "at"
        const renamePatterns = ['@', '—', ' at '];
        renamePatterns.forEach(pattern => {
            const index = eventName.indexOf(pattern);
            if (index !== -1) {
                const originalName = eventName;
                eventName = originalName.substring(0, index).trim();
                let trimmedText = originalName.substring(index);
                event.name = eventName;
                console.log(`Trimmed "${trimmedText}" from "${originalName}"`);
            }
        });

        return true; // Keep the event
    });

    return events;
}