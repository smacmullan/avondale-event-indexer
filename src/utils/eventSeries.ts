import rrule from 'rrule';
import { EventSchedule } from '../definitions.js';
const { RRule, RRuleSet } = rrule;

// Helper function to map day strings to rrule constants
function mapDays(days: string) {
    const dayMap = {
        'Monday': RRule.MO,
        'Tuesday': RRule.TU,
        'Wednesday': RRule.WE,
        'Thursday': RRule.TH,
        'Friday': RRule.FR,
        'Saturday': RRule.SA,
        'Sunday': RRule.SU
    };
    return days.split(',')
        .map(day => day.trim())
        .filter((day): day is keyof typeof dayMap => day in dayMap)  // Filter valid keys
        .map(day => dayMap[day]);
};

// Helper function to map frequency strings to rrule constants
function mapFrequency(frequency: string) {
    const frequencyMap = {
        'Daily': RRule.DAILY,
        'Weekly': RRule.WEEKLY,
        'Monthly': RRule.MONTHLY,
        'Yearly': RRule.YEARLY
    };
    return frequencyMap[frequency as keyof typeof frequencyMap];
};

// Function to create rrule based on event schedule
function createRRule(eventSchedule: EventSchedule) {
    const frequency = mapFrequency(eventSchedule.frequency);
    const byDay = mapDays(eventSchedule.byDay);

    const ruleOptions: any = {
        freq: frequency,
        dtstart: new Date(eventSchedule.startDate),
        until: new Date(eventSchedule.endDate)
    };

    if (eventSchedule.frequency === 'Weekly') {
        ruleOptions.byweekday = byDay;
    }

    let monthlyOccurence = eventSchedule.monthlyOccurence;
    if (eventSchedule.frequency === 'Monthly' && monthlyOccurence) {
        const occurrenceMap = {
            '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, 'last': -1
        };
        ruleOptions.byweekday = byDay.map(day =>
            monthlyOccurence.split(',')
                .map(occ => occ.trim())
                .filter((occ): occ is keyof typeof occurrenceMap => occ in occurrenceMap)  // Filter valid keys
                .map(occ => day.nth(occurrenceMap[occ]))
        ).flat();
    }

    return new RRule(ruleOptions);
};


export function getEventSeriesStartDates(eventSchedule: EventSchedule, startDate: Date, endDate: Date): Date[] {
    const rule = createRRule(eventSchedule);
    return rule.between(startDate, endDate, true);
}