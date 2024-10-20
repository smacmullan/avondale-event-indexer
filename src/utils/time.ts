import { Event } from "../definitions.js";

function formatTime(date: Date, hoursOnly = false) {
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes();
    const period = hoursOnly ? '' : (date.getHours() >= 12 ? 'pm' : 'am');
    return minutes === 0 ? `${hours}${period}` : `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
};

export function formatTimeRange(event: Event) {

    if (!event.startDate || isISODate(event.startDate)) {
        // no start or end time provided
        return "All Day";
    }

    const start = new Date(event.startDate);
    const startHours = start.getHours();
    const startMinutes = start.getMinutes();

    if (event.startDate && !event.endDate) {
        // no end time provided
        return formatTime(start);
    }

    const end = new Date(event.endDate as string);
    const endHours = end.getHours();

    const isSameTime = start.getTime() === end.getTime();
    if (isSameTime) {
        // Same start and end time
        return formatTime(start);
    }

    const isSamePeriod = (startHours < 12 && end.getHours() < 12) || (startHours >= 12 && end.getHours() >= 12);
    if (isSamePeriod) {
        // Same AM/PM, only show the period once
        return `${formatTime(start, true)}-${formatTime(end)}`;
    } else {
        // Different AM/PM, show both periods
        return `${formatTime(start)}-${formatTime(end)}`;
    }
}


export function formatDay(event: Event) {
    let date;
    if (isISODate(event.startDate))
        date = getDateFromISODate(event.startDate);
    else
        date = new Date(event.startDate);

    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' }).format(date);
}

function getDateFromISODate(str: string) {
    // Create a new Date object using the local timezone
    let [year, month, day] = str.split('-');
    return new Date(+year, +month - 1, +day); // Month is 0-indexed
}

export function getEndOfWeek(weeksOut = 0) {
    // return a timestamp for the following Monday at noon

    // Calculate the date n weeks from today
    const today = new Date();
    const futureDate = new Date();
    // Add weeks
    futureDate.setDate(today.getDate() + (weeksOut * 7));

    // Move to the following Monday
    const dayOfWeek = futureDate.getDay(); // Get the day of the week (0 is Sunday)
    const daysUntilNextMonday = (8 - dayOfWeek) % 7; // Days until the next Monday (8 - dayOfWeek % 7)
    const endDate = new Date(futureDate);
    endDate.setDate(futureDate.getDate() + daysUntilNextMonday);

    // Set the time to noon in the local timezone
    endDate.setHours(12, 0, 0, 0); // Noon (12:00 PM)

    return endDate;
}


function isISODate(str: string) {
    // Regular expression for ISO Date format (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return isoDateRegex.test(str);
}


function isISODateTime(str: string) {
    // Regular expression for ISO Datetime format (YYYY-MM-DDTHH:mm:ss±hh:mm or without the timezone)
    const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
    return isoDateTimeRegex.test(str);
}

export function eventSort(a: Event, b: Event) {
    // sort start times in order
    let aDateTime = isISODate(a.startDate) ? getDateFromISODate(a.startDate) : new Date(a.startDate);
    let bDateTime = isISODate(b.startDate) ? getDateFromISODate(b.startDate) : new Date(b.startDate);

    // if all day event, place at the end of the day
    if (isISODate(a.startDate))
        aDateTime.setDate(aDateTime.getDate() + 1);
    if (isISODate(b.startDate))
        bDateTime.setDate(bDateTime.getDate() + 1);

    return aDateTime.getTime() - bDateTime.getTime();
}