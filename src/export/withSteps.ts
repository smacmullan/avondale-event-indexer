import type { Exporter } from './exporter.ts';
import type { ProcessStep } from '../process/processStep.ts';
import { processEvents } from '../process/processEvents.ts';

/**
 * Gives an exporter its own processing steps: they run on the events first, and the exporter
 * receives the result. For example, withSteps(newsletterHtml(), [upcomingWeek()]).
 * A failing step fails this exporter only.
 */
export function withSteps(exporter: Exporter, steps: readonly ProcessStep[]): Exporter {
    return {
        ...exporter,
        async export(events, ctx) {
            const processed = await processEvents(events, steps);
            return exporter.export(processed.events, ctx);
        },
    };
}
