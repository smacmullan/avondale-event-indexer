import { eventStep, type ProcessStep } from '../processStep.ts';

/** Removes events with no name and events whose name says they are closed or sold out. */
export function removeClosed(): ProcessStep {
    return eventStep('removeClosed', (event, ctx) => {
        const name = event.name?.toLowerCase();
        if (!name)
            return ctx.remove(event, 'no name');
        if (name.includes('closed'))
            return ctx.remove(event, 'name contains "closed"');
        if (name.includes('sold out'))
            return ctx.remove(event, 'name contains "sold out"');
        return event;
    });
}
