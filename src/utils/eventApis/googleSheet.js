import { google } from 'googleapis';
import dotenv from 'dotenv';
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

export async function fetchGoogleSheetEvents(org, endSearchDate) {
    try {
        // get event data from spreadsheet
        const sheetId = org.api;
        let rows = await getSheetData(sheetId);
        rows.shift(); // drop header row
        let events = rows.map(rowToEvent);

        // Filter out events outside time range
        let today = new Date();
        events = events.filter(event => event.startDate && new Date(event.startDate) > today && new Date(event.startDate) < endSearchDate);

        return events;
    } catch (error) {
        console.error(`Error fetching Google sheet events.`, error);
        return [];
    }
}

async function getSheetData(sheetId) {
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

function sheetStringtoDate(dateStr, allDay = false) {

    if (!dateStr)
        return null;

    let [datePart, timePart] = dateStr.split(' ');
    let [month, day, year] = datePart.split('/').map(Number);

    if (!timePart || allDay){
        month = month.toString().padStart(2, '0');
        day = day.toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    else {
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
    }
}


function rowToEvent(row) {
    const isAllDay = (row[9] === "Yes");

    return {
        name: row[2],
        startDate: sheetStringtoDate(row[7], isAllDay),
        endDate: sheetStringtoDate(row[8], isAllDay),
        organizer: {
            name: row[3],
        },
    }
}




