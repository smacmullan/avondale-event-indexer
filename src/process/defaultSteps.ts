import type { ProcessStep } from './processStep.ts';
import { removeClosed } from './steps/removeClosed.ts';
import { removeExcludedEvents } from './steps/removeExcludedEvents.ts';
import { trimLocations } from './steps/trimLocations.ts';
import { normalizeDurations } from './steps/normalizeDurations.ts';
import { sortEvents } from './steps/sortEvents.ts';

// default processing pipeline
export const defaultProcessSteps: ProcessStep[] = [
    removeClosed(),
    removeExcludedEvents({ file: 'config/filterList.json' }),   // relative to the working directory
    trimLocations(),
    normalizeDurations(),
    sortEvents(),
];
