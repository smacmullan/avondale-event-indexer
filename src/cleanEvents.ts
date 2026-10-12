import { eventSort } from './utils/time.ts';
import type { Event } from './definitions.ts';

// import list of events to filter out from the list
import filterList from '../config/filterList.json' with { type: 'json' };
const filterSet = new Set(
    filterList.map(f => `${f.name.trim()}||${f.organizer}`)
);

export function cleanEvents(events: Event[]) {
    console.log("Cleaning event data...");

    console.log("Removing events...")
    events = removeEvents(events);
    console.log("Trimming locations from event names...")
    events = events.map(trimLocationFromEventName);
    console.log("Normalizing event durations...")
    events = events.map(normalizeEventDuration);
    
    events.sort(eventSort);

    return events;
}

/** 
* Remove non-events and common duplicates. 
*/
function removeEvents(events: Event[]): Event[] {
    events = events.filter(event => {
        let eventName = event.name as string;

        // Remove events with "closed" in the name
        if (!eventName || eventName.toLowerCase().includes('closed') || eventName.toLowerCase().includes('sold out')) {
            console.log(`\tRemoved "${event.name}" from the event list`);
            return false; // Filter out the event
        }

        // Remove common duplicate events or non-events from the list
        const filterKey = `${event.name.trim()}||${event.organizer?.name}`;
        if (filterSet.has(filterKey)) {
            console.log(`\tRemoved "${event.name} - ${event.organizer?.name}" from the event list`);
            return false; // Filter out the event
        }
        return true; // Keep the event
    });

    return events;
}


function trimLocationFromEventName(event: Event): Event {
    let eventName = event.name as string;
    // Trim ends off of events containing "@", "—", or "at"
    const renamePatterns = ['@', '—', ' at ', ' At '];
    renamePatterns.forEach(pattern => {
        const index = eventName.indexOf(pattern);
        if (index !== -1) {
            const originalName = eventName;
            eventName = originalName.substring(0, index).trim();
            let trimmedText = originalName.substring(index);
            event.name = eventName;
            console.log(`\tTrimmed "${trimmedText}" from "${originalName}"`);
        }
    });

    return event;
}


/**
 * Normalize events that span multiple days by clamping the end date
 * to the same day as the start date.
 */
function normalizeEventDuration(event: Event): Event {
    if (!event.startDate || !event.endDate)
        return event;

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    // If the event is less than 24 hours, no change needed
    const durationMs = end.getTime() - start.getTime();
    if (durationMs < 24 * 60 * 60 * 1000)
        return event;

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