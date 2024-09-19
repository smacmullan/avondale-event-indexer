import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

export async function fetchGoogleCalendarEvents(org, endSearchDate) {
    try {
        const calendar = google.calendar({ version: 'v3', auth: process.env.GOOGLE_API_KEY });
        const calendarId = org.api;

        // Fetch events from the calendar
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: (new Date()).toISOString(), // Start time (current date/time)
            timeMax: endSearchDate.toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = response.data.items;
        return events.map(event => standardizeGoogleEvent(event, org));

    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeGoogleEvent(event, org) {
    return {
        name: event.summary,
        startDate: event.start.dateTime || event.start.date || undefined,
        endDate: event.end.dateTime || event.end.date || undefined,
        organizer: {
            name: org.name,
        },
    };
}

export async function fetchPlotEvents(org, endSearchDate) {
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

function standardizePlotEvent(event) {
    const { title, dateTime, venue } = event;

 
    return {
        name: title,
        startDate: parseDateFromPlotDateTime(dateTime).toISOString(),
        organizer: {
            name: venue,
        },
    };
}

function parseDateFromPlotDateTime(dateTime){
    // Extract the components of the dateTime string using regex
    const [_, month, day, time, meridian] = dateTime.match(/\w{3}, (\w{3}) (\d{1,2}) (\d{1,2}:\d{2})(AM|PM)/);
    // Map the month abbreviation to the corresponding numeric value
    const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    // Parse the hour and minute from the time string
    let [hours, minutes] = time.split(':').map(Number);
    // Convert the 12-hour format to 24-hour format based on AM/PM
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    // Calculate the year (not provided in parsed information)
    const today = new Date();
    let year;
    if (month < today.getMonth())
        year = today.getFullYear() + 1; // next year
    else
        year = today.getFullYear(); // this year


    // Create a Date object with the parsed information
    const date = new Date(year, monthMap[month], day, hours, minutes, 0)
    return date;
}

export async function fetchEventsCalendarCoEvents(org, endSearchDate) {
    try {
        // put dates into Unix timestamp format
        const today = new Date().getTime();
        const endDate = endSearchDate.getTime();

        let apiString = `https://${org.api}&from=${today}&to=${endDate}`;
        let response = await fetch(apiString);
        let data = await response.json();
        return data.events.map(standardizeEventsCalendarCoEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeEventsCalendarCoEvent(event) {
    const { title, start_time, end_time, location } = event;

    return {
        name: title,
        startDate: start_time,
        endDate: end_time,
        organizer: {
            name: location,
        },
    };
}
