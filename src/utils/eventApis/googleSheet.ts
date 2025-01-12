import { google } from 'googleapis';
import dotenv from 'dotenv';
import { Organization, Event } from '../../definitions.js';
import { getEventSeriesStartDates } from '../eventSeries.js';
import { isEventUpcomingAndBeforeDate } from '../time.js';
dotenv.config();

/*
This API expects sheet data to have the following columns in the following order:
  [
    'Timestamp',
    'Contact Information',
    'Event Name',
    'Organizer',
    'Event Link',
    'Location',
    'Event Type',
    'Date & Start Time',
    'End Time',
    'All Day?',
    'Is Repeating?',
    'Frequency',
    'Days of the Week',
    'Monthly Occurrence',
    'Repeat Stop Date'
  ]
*/

export async function fetchGoogleSheetEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // get event data from spreadsheet
        const sheetId = org.api;
        let rows = await getSheetData(sheetId);
        if (!rows || rows.length < 2)
            return [];

        rows.shift(); // drop header row
        let events = getEventsFromRows(rows, endSearchDate);
        events = events.filter((event) => isEventUpcomingAndBeforeDate(event, endSearchDate));
        return events;
    } catch (error) {
        console.error(`Error fetching Google sheet events.`, error);
        return [];
    }
}

async function getSheetData(sheetId: string) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Event Submissions', // Name of the sheet
        });

        const rows = response.data.values;
        return rows;
    } catch (err) {
        console.error('Error fetching data:', err);
        return [];
    }
}

function sheetStringtoDate(dateStr: string, allDay = false) {

    if (!dateStr)
        return undefined;

    let [datePart, timePart] = dateStr.split(' ');
    let [month, day, year] = datePart.split('/').map(Number);

    if (!timePart || allDay) {
        let monthString = month.toString().padStart(2, '0');
        let dayString = day.toString().padStart(2, '0');
        return `${year}-${monthString}-${dayString}`;
    }
    else {
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
    }
}

function getEventsFromRows(rows: string[][], endSearchDate: Date): Event[] {
    let eventData = rows.map((row: any) => rowToEvent(row, endSearchDate));
    return eventData.flat();
}

function rowToEvent(row: string[], endSearchDate: Date): (Event | Event[]) {
    const isRepeating = (row[10]?.trim() === "Repeating");

    if (isRepeating)
        return rowToEventSeries(row, endSearchDate);
    else
        return rowToSingleEvent(row);
}

function rowToSingleEvent(row: string[]): Event {
    const isAllDay = (row[9]?.trim() === "Yes");
    return {
        name: row[2],
        startDate: sheetStringtoDate(row[7], isAllDay) || '',
        endDate: sheetStringtoDate(row[8], isAllDay),
        organizer: {
            name: row[3],
        },
        url: row[4] || undefined,
    }
};

function rowToEventSeries(row: string[], endSearchDate: Date): Event[] {

    const scheduleStartString = row[7];
    const isAllDay = (row[9] === "Yes");
    const monthlyOccurenceString = row[13];
    const scheduleEndString = row[14];

    let schedule = {
        startDate: sheetStringtoDate(scheduleStartString) as string,
        endDate: scheduleEndString ? sheetStringtoDate(scheduleEndString) as string : endSearchDate.toISOString(),
        frequency: row[11],
        byDay: row[12],
        monthlyOccurence: monthlyOccurenceString || undefined,
    };
    let now = new Date();

    let seriesStartDates = getEventSeriesStartDates(schedule, now, endSearchDate);

    return seriesStartDates.map((startDate: Date) => {

        let startDateString = startDate.toISOString();
        if(isAllDay)
            startDateString = startDateString.split('T')[0]; // remove time from end of string

        // logic for figuring out instance end date string
        const firstInstanceEndDateString = sheetStringtoDate(row[8], isAllDay);
        let endDateString = undefined;
        if (!firstInstanceEndDateString)
            endDateString = undefined;
        else if (isAllDay)
            endDateString = startDateString
        else{
            // TODO only works when the event starts and ends on the same day
            // get date from instance start date
            let dateString = startDateString.split('T')[0];
            // get time from first instance end time
            let timeString = firstInstanceEndDateString.split('T')[1];
            // combine
            endDateString = `${dateString}T${timeString}`
        }

        // use instance start and end date to create event
        return {
            name: row[2],
            startDate: startDateString,
            endDate: endDateString,
            organizer: {
                name: row[3],
            },
            url: row[4] || undefined,
        }
    })
};

