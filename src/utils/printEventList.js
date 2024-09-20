import { formatTimeRange, formatDay, eventSort } from './time.js';

export function printEventList(events) {
    // Sort events by start date/time
    events.sort(eventSort);

    let currentDay = '';
    events.forEach(event => {
        const eventDay = formatDay(event);

        // Print the day only once per group of events
        if (eventDay !== currentDay) {
            currentDay = eventDay;
            console.log(`\n\n${eventDay}`);
        }

        const organizationName = event.organizer.name || "Unknown";

        // Format the event summary
        const timeRange = formatTimeRange(event);
        console.log(`* ${timeRange} - ${event.name} | ${organizationName}`);
    });
}