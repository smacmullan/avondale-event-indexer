import fs from 'fs';
import { formatTimeRange, formatDay, eventSort } from './utils/time.ts';
import type { Event } from './definitions.ts';

// import list of events to filter out from the list
import filterList from '../config/filterList.json' with { type: 'json' };
const filterSet = new Set(
    filterList.map(f => `${f.name.trim()}||${f.organizer}`)
);

export function printEventList(events: Event[], filePath = "output/eventList.md") {
    events = cleanupEvents(events);
    events.sort(eventSort);

    try {
        fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));
    } catch (err) {
        console.error('Error writing event data to file', err);
    }

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

/**
* Remove events and trim names that include locations.
*/
function cleanupEvents(events: Event[]): Event[] {
    events = events.filter(event => {
        let eventName = event.name as string;

        // Remove events with "closed" in the name
        if (!eventName || eventName.toLowerCase().includes('closed') || eventName.toLowerCase().includes('sold out')) {
            console.log(`Removed "${event.name}" from the event list`);
            return false; // Filter out the event
        }

        // Remove common duplicate events or non-events from the list
        const filterKey = `${event.name.trim()}||${event.organizer?.name}`;
        if (filterSet.has(filterKey)) {
            console.log(`Removed "${event.name} - ${event.organizer?.name}" from the event list`);
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

    // Normalize multi-day events
    console.log("\nNormalizing event durations:")
    events = events.map(normalizeEventDuration);

    return events;
}

/**
 * Normalize events that span multiple days by clamping the end date
 * to the same day as the start date.
 */
function normalizeEventDuration(event: Event): Event {
    if (!event.startDate || !event.endDate) return event;

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    // If the event is less than 24 hours, no change needed
    const durationMs = end.getTime() - start.getTime();
    if (durationMs < 24 * 60 * 60 * 1000) return event;

    // Clamp end to the same day as start, preserving the original end time-of-day
    const clampedEnd = new Date(start);
    clampedEnd.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds());

    if (clampedEnd.getTime() === start.getTime()) {
        console.log(`\tRemoved endDate from "${event.name}" (clamped end would equal startDate)`);
        const { endDate: _, ...eventWithoutEnd } = event as any;
        return eventWithoutEnd;
    }

    if (clampedEnd < start) {
        clampedEnd.setDate(clampedEnd.getDate() + 1);
        console.log(`\tAdjusted "${event.name}" end to next day: ${clampedEnd.toISOString()} (clamped end time was before start time on same day)`);
    } else {
        console.log(`\tClamped "${event.name}" end from ${end.toISOString()} to ${clampedEnd.toISOString()}`);
    }

    return { ...event, endDate: clampedEnd.toISOString() };
}