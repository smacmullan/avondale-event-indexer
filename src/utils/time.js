
function formatTime(date, hoursOnly=false) {
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes();
    const period = hoursOnly? '' : (date.getHours() >= 12 ? 'pm' : 'am');
    return minutes === 0 ? `${hours}${period}` : `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
};

export function formatTimeRange(event) {

    if (!event.start.dateTime) {
        // no start or end time provided
        return "All Day";
    }

    const start = new Date(event.start.dateTime);
    const startHours = start.getHours();
    const startMinutes = start.getMinutes();

    if (event.start.dateTime && !event.end.dateTime) {
        // no end time provided
        return formatTime(start);
    }

    const end = new Date(event.end.dateTime);
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


export function formatDay(event) {
    let date;
    if (event.start.date) {
        // Create a new Date object using the local timezone
        let [year, month, day] = event.start.date.split('-');
        let date = new Date(year, month - 1, day); // Month is 0-indexed
    }
    else
        date = new Date(event.start.dateTime);

    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' }).format(date);
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
