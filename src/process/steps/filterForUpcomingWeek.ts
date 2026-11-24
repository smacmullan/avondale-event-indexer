import type { ProcessStep } from '../processStep.ts';
import { isISODate, getDateFromISODate } from '../../utils/time.ts';

export type UpcomingWeekOptions = {
    /** Treat this as the current time. Defaults to the actual time when the step runs. */
    now?: Date;
};

/**
 * Keeps only events starting in the upcoming Monday-to-Sunday week. If today is Monday, the
 * week starts today. Not in the default steps: attach it to an exporter with withSteps().
 */
export function filterForUpcomingWeek({ now }: UpcomingWeekOptions = {}): ProcessStep {
    return {
        name: 'filterForUpcomingWeek',
        run(events, ctx) {
            const { monday, nextMonday } = getUpcomingWeek(now ?? new Date());

            return events.filter(event => {
                const eventDate = isISODate(event.startDate) ? getDateFromISODate(event.startDate) : new Date(event.startDate);
                if (eventDate >= monday && eventDate < nextMonday)
                    return true;
                ctx.remove(event, 'outside the upcoming week');
                return false;
            });
        },
    };
}

function getUpcomingWeek(now: Date): { monday: Date; nextMonday: Date } {
    // Calculate upcoming Monday: if today is Monday, diff will be 0.
    const diffToMonday = (1 - now.getDay() + 7) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // Next Monday marks the end of the week (exclusive)
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    return { monday, nextMonday };
}
