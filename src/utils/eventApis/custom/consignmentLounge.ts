import type { Organization, Event } from '../../../definitions.ts';
import { fetchGoogleCalendarEvents } from '../googleCalendar.ts';

/**
 * Wrapper on the Google Calendar integration for Consignment Lounge. Attempts to parse event times from title
 * and update event startDate and endDate values.
 * @param org 
 * @param endSearchDate 
 */
export async function fetchConsignmentLoungeEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    let events = await fetchGoogleCalendarEvents(org, endSearchDate);
    events = events.map(cleanupEventTime);
    return events;
}


type ParsedTimeInfo = {
    startTime?: TimeParts;
    endTime?: TimeParts;
    matchedText: string;
};

type TimeParts = {
    hour: number;
    minute: number;
};

export function cleanupEventTime(event: Event): Event {
    try {
        // Always remove the original endDate first (always next day string)
        const cleanedEvent = {
            ...event,
        };

        delete cleanedEvent.endDate;

        const parsed = parseTimeInfoFromTitle(event.name);

        // If parsing failed, leave title/startDate unchanged
        if (!parsed?.startTime) {
            return cleanedEvent;
        }

        const updatedName = removeParsedTimeFromTitle(
            event.name,
            parsed.matchedText
        );

        const updatedStartDate = applyTimeToDate(
            event.startDate,
            parsed.startTime
        );

        const result = {
            ...cleanedEvent,
            name: updatedName,
            startDate: updatedStartDate,
        };

        if (parsed.endTime) {
            result.endDate = applyTimeToDate(
                event.startDate,
                parsed.endTime
            );
        }

        return result;
    } catch {
        return event;
    }
}

/**
 * Examples handled:
 * - 3pm-8pm
 * - 12pm-5pm
 * - 6pm
 * - 5pm
 * - 6-10
 */
function parseTimeInfoFromTitle(
    title: string
): ParsedTimeInfo | null {
    const normalized = title.trim();

    // 3pm-8pm
    // 12pm-5pm
    const meridiemRangeMatch = normalized.match(
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
    );

    if (meridiemRangeMatch) {
        const [
            matchedText,
            startHour,
            startMinute,
            startMeridiem,
            endHour,
            endMinute,
            endMeridiem,
        ] = meridiemRangeMatch;

        return {
            matchedText,
            startTime: parseTimeParts(
                startHour,
                startMinute,
                startMeridiem
            ),
            endTime: parseTimeParts(
                endHour,
                endMinute,
                endMeridiem
            ),
        };
    }

    // 6-10 (assume evening hours)
    const simpleRangeMatch = normalized.match(
        /\b(\d{1,2})\s*-\s*(\d{1,2})\b/
    );

    if (simpleRangeMatch) {
        const [matchedText, startHour, endHour] = simpleRangeMatch;

        return {
            matchedText,
            startTime: inferEveningTime(Number(startHour)),
            endTime: inferEveningTime(Number(endHour)),
        };
    }

    // 6pm
    // 5pm
    const singleTimeMatch = normalized.match(
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
    );

    if (singleTimeMatch) {
        const [
            matchedText,
            hour,
            minute,
            meridiem,
        ] = singleTimeMatch;

        return {
            matchedText,
            startTime: parseTimeParts(
                hour,
                minute,
                meridiem
            ),
        };
    }

    return null;
}

function parseTimeParts(
    hourText: string,
    minuteText: string | undefined,
    meridiem: string
): TimeParts {
    let hour = Number(hourText);
    const minute = Number(minuteText ?? "0");

    const normalizedMeridiem = meridiem.toLowerCase();

    if (normalizedMeridiem === "pm" && hour !== 12) {
        hour += 12;
    }

    if (normalizedMeridiem === "am" && hour === 12) {
        hour = 0;
    }

    return { hour, minute };
}

/**
 * Used for ambiguous patterns like "6-10".
 * Assumes evening event hours.
 */
function inferEveningTime(hour: number): TimeParts {
    let adjustedHour = hour;

    if (adjustedHour >= 1 && adjustedHour <= 11) {
        adjustedHour += 12;
    }

    return {
        hour: adjustedHour,
        minute: 0,
    };
}

function applyTimeToDate(
    dateString: string,
    time: TimeParts
): string {
    const date = new Date(`${dateString}T00:00:00`);

    date.setHours(time.hour, time.minute, 0, 0);

    return date.toISOString();
}

function removeParsedTimeFromTitle(
    title: string,
    matchedText: string
): string {
    return title
        .replace(matchedText, "")
        .replace(/\(\s*\)/g, "")
        .replace(/\s+-\s+$/g, "")
        .replace(/\(\s*$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}