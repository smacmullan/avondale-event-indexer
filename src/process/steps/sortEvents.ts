import { eventSort } from '../../utils/time.ts';
import type { ProcessStep } from '../processStep.ts';

/** Sorts events chronologically. Whole-list step: returns a new array and leaves the input alone. */
export function sortEvents(): ProcessStep {
    return {
        name: 'sortEvents',
        run: events => [...events].sort(eventSort),
    };
}
