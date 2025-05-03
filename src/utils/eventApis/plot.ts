import { Organization, Event } from '../../definitions.js';

export async function fetchPlotEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // put dates into YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const endDate = endSearchDate.toISOString().split('T')[0];

        let apiString = `https://${org.api}/api/plot/v1/listings?currentpage=1&notLoaded=false&listingsPerPage=48&from=${today}&to=${endDate}&_locale=user`;
        let response = await fetch(apiString);
        let plotEvents = await response.json()
        return plotEvents.map(standardizePlotEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizePlotEvent(event: any): Event {
    const { title, dateTime, venue, permalink } = event;


    return {
        name: title,
        startDate: parseDateFromPlotDateTime(dateTime),
        organizer: {
            name: venue,
        },
        url: permalink,
    };
}

function parseDateFromPlotDateTime(dateTime: string) {
    // Extract the components of the dateTime string using regex
    const match = dateTime.match(/\w{3}, (\w{3}) (\d{1,2}) (\d{1,2}:\d{2}|\d{1,2})(am|pm)/i);
    if(!match) return "";
    const [_, month, day, time, meridian] = match;
    // Map the month abbreviation to the corresponding numeric value
    const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    // Parse the hour and minute from the time string
    let [hours, minutes] = time.split(':').map(Number);
    if (!minutes) minutes = 0; // Default to 0 if minutes are not provided
    // Convert the 12-hour format to 24-hour format based on AM/PM
    if (meridian === 'pm' && hours !== 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;

    // Calculate the year (not provided in parsed information)
    const today = new Date();
    let year;
    if (+month < today.getMonth())
        year = today.getFullYear() + 1; // next year
    else
        year = today.getFullYear(); // this year


    // Create a Date object with the parsed information
    if (month in monthMap) {
        const date = new Date(year, monthMap[month as keyof typeof monthMap], +day, hours, minutes, 0);
        return date.toISOString();
    } else {
        throw new Error(`Invalid month: ${month}`);
    }
}