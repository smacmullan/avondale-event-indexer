
function formatTime(date) {
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes();
    const period = date.getHours() >= 12 ? 'pm' : 'am';
    return minutes === 0 ? `${hours}${period}` : `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
};

function formatHourOnly(hours, minutes) {
    return minutes === 0 ? hours : `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export function formatTimeRange(event) {

    if (!event.start.dateTime)
        return "All Day";

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);

    const startHours = start.getHours();
    const startMinutes = start.getMinutes();
    const endHours = end.getHours();
    const endMinutes = end.getMinutes();

    const isSamePeriod = (startHours < 12 && endHours < 12) || (startHours >= 12 && endHours >= 12);
    const isSameTime = start.getTime() === end.getTime();

    if (isSameTime) {
        // Same start and end time
        return formatTime(start);
    }

    const startPeriod = startHours >= 12 ? 'pm' : 'am';
    const endPeriod = endHours >= 12 ? 'pm' : 'am';

    if (isSamePeriod) {
        // Same AM/PM, only show the period once
        return `${formatHourOnly(startHours % 12 || 12, startMinutes)}-${formatHourOnly(endHours % 12 || 12, endMinutes)}${startPeriod}`;
    } else {
        // Different AM/PM, show both periods
        return `${formatTime(start)}-${formatTime(end)}`;
    }
}


export function formatDay(event) {
    let date;
    if (event.start.date)
        date = new Date(event.start.date);
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
