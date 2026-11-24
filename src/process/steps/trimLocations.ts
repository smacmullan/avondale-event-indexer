import { eventStep, type ProcessStep } from '../processStep.ts';

// Trim the end off names containing these, e.g. "Open Mic @ The Bar" -> "Open Mic"
const PATTERNS = ['@', '—', ' at ', ' At '];

/** Trims locations off the ends of event names. */
export function trimLocations(): ProcessStep {
    return eventStep('trimLocations', (event, ctx) => {
        let name = event.name;
        const trimmedParts: string[] = [];

        for (const pattern of PATTERNS) {
            const index = name.indexOf(pattern);
            if (index !== -1) {
                trimmedParts.push(name.substring(index));
                name = name.substring(0, index).trim();
            }
        }

        return trimmedParts.length === 0
            ? event
            : ctx.change(event, { ...event, name }, `trimmed ${trimmedParts.map(part => `"${part}"`).join(', ')}`);
    });
}
