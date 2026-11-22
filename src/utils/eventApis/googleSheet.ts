import { google } from 'googleapis';
import { z } from 'zod';
import type { Event, EventIntegration } from '../../definitions.ts';
import { getEventSeriesStartDates } from '../eventSeries.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';
process.loadEnvFile();

const optionsSchema = z.object({
    /** Google Sheet ID (the long string in the sheet's URL). Must be readable with the API key. */
    sheetId: z.string().min(1),
    /** Name of the tab holding the form responses */
    tab: z.string().min(1).default('Event Submissions'),
}).strict();

export type GoogleSheetOptions = z.infer<typeof optionsSchema>;

/*
This integration expects the sheet to have the following columns in this order
(zero-based index in COL below):
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
*/
const COL = {
    name: 2,
    organizer: 3,
    link: 4,
    start: 7,
    end: 8,
    allDay: 9,
    repeating: 10,
    frequency: 11,
    byDay: 12,
    monthlyOccurrence: 13,
    repeatStop: 14,
} as const;

export const googleSheetIntegration = {
    type: 'googleSheet',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ org, options, endSearchDate }) {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey)
            throw new Error('GOOGLE_API_KEY is not set');

        // Errors here (bad sheet ID, no access, bad tab name) propagate to the registry.
        const sheets = google.sheets({ version: 'v4', auth: apiKey });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: options.sheetId,
            range: options.tab,
        });

        const rows: string[][] = response.data.values ?? [];
        const dataRows = rows.slice(1); // drop header row

        // A bad row only skips that row. User-submitted data is the likeliest to have gaps.
        const events: Event[] = [];
        dataRows.forEach((row, i) => {
            if (!row.some(cell => cell?.trim()))
                return; // blank row
            try {
                events.push(...rowToEvents(row, endSearchDate));
            } catch (error) {
                const sheetRowNumber = i + 2; // +1 for header, +1 for 1-based rows
                console.error(`[${org.name}] Skipping sheet row ${sheetRowNumber}:`,
                    error instanceof Error ? error.message : error);
            }
        });

        // The Sheets API can't filter by date, so filter here.
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<GoogleSheetOptions>;

/** Parses "M/D/YYYY" or "M/D/YYYY H:MM:SS". Returns YYYY-MM-DD for all-day/date-only, else an ISO datetime. */
function sheetStringToDate(dateStr: string | undefined, allDay = false): string | undefined {
    if (!dateStr?.trim())
        return undefined;

    const [datePart, timePart] = dateStr.trim().split(' ');
    const [month, day, year] = datePart.split('/').map(Number);
    if (![month, day, year].every(Number.isFinite))
        throw new Error(`Unrecognized date "${dateStr}"`);

    if (!timePart || allDay) {
        const monthString = month.toString().padStart(2, '0');
        const dayString = day.toString().padStart(2, '0');
        return `${year}-${monthString}-${dayString}`;
    }

    const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    if (Number.isNaN(date.getTime()))
        throw new Error(`Unrecognized date/time "${dateStr}"`);
    return date.toISOString();
}

/** Throws on rows that can't produce a valid event; the caller logs and skips them. */
function rowToEvents(row: string[], endSearchDate: Date): Event[] {
    if (!row[COL.name]?.trim())
        throw new Error('missing event name');
    if (!row[COL.start]?.trim())
        throw new Error(`missing start date for "${row[COL.name]}"`);

    const isRepeating = row[COL.repeating]?.trim() === 'Repeating';
    return isRepeating
        ? rowToEventSeries(row, endSearchDate)
        : [rowToSingleEvent(row)];
}

function rowToSingleEvent(row: string[]): Event {
    const isAllDay = row[COL.allDay]?.trim() === 'Yes';
    return {
        name: row[COL.name],
        startDate: sheetStringToDate(row[COL.start], isAllDay)!, // presence checked in rowToEvents
        endDate: sheetStringToDate(row[COL.end], isAllDay),
        organizer: {
            name: row[COL.organizer],
        },
        url: row[COL.link] || undefined,
    };
}

function rowToEventSeries(row: string[], endSearchDate: Date): Event[] {
    const isAllDay = row[COL.allDay]?.trim() === 'Yes';
    const scheduleEndString = row[COL.repeatStop];

    const schedule = {
        startDate: sheetStringToDate(row[COL.start]) as string,
        endDate: scheduleEndString ? sheetStringToDate(scheduleEndString) as string : endSearchDate.toISOString(),
        frequency: row[COL.frequency],
        byDay: row[COL.byDay],
        monthlyOccurence: row[COL.monthlyOccurrence] || undefined,
    };
    const now = new Date();

    const seriesStartDates = getEventSeriesStartDates(schedule, now, endSearchDate);

    return seriesStartDates.map((startDate: Date) => {

        let startDateString = startDate.toISOString();
        if (isAllDay)
            startDateString = startDateString.split('T')[0]; // remove time from end of string

        // logic for figuring out instance end date string
        const firstInstanceEndDateString = sheetStringToDate(row[COL.end], isAllDay);
        let endDateString: string | undefined;
        if (!firstInstanceEndDateString)
            endDateString = undefined;
        else if (isAllDay)
            endDateString = startDateString;
        else {
            // TODO only works when the event starts and ends on the same day
            // get date from instance start date
            const dateString = startDateString.split('T')[0];
            // get time from first instance end time
            const timeString = firstInstanceEndDateString.split('T')[1];
            // combine
            endDateString = `${dateString}T${timeString}`;
        }

        // use instance start and end date to create event
        return {
            name: row[COL.name],
            startDate: startDateString,
            endDate: endDateString,
            organizer: {
                name: row[COL.organizer],
            },
            url: row[COL.link] || undefined,
        };
    });
}