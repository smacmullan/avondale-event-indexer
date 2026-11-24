import { eventStep, type ProcessStep } from '../processStep.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize events that span multiple days by clamping the end date
 * to the same day as the start date.
 */
export function normalizeDurations(): ProcessStep {
    return eventStep('normalizeDurations', (event, ctx) => {
        if (!event.startDate || !event.endDate)
            return event;

        const start = new Date(event.startDate);
        const end = new Date(event.endDate);

        // If the event is less than 24 hours, no change needed
        if (end.getTime() - start.getTime() < DAY_MS)
            return event;

        // Clamp end to the same day as start, preserving the original end time-of-day
        const clampedEnd = new Date(start);
        clampedEnd.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds());

        if (clampedEnd.getTime() === start.getTime()) {
            const { endDate: _removed, ...withoutEnd } = event;
            return ctx.change(event, withoutEnd, 'removed endDate (clamped end would equal startDate)');
        }

        if (clampedEnd < start) {
            clampedEnd.setDate(clampedEnd.getDate() + 1);
            return ctx.change(
                event,
                { ...event, endDate: clampedEnd.toISOString() },
                `moved end to next day: ${clampedEnd.toISOString()} (clamped end time was before start time on same day)`,
            );
        }

        return ctx.change(
            event,
            { ...event, endDate: clampedEnd.toISOString() },
            `clamped end from ${end.toISOString()} to ${clampedEnd.toISOString()}`,
        );
    });
}
