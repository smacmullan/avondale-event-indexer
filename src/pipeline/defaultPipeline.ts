import type { EventSource } from '../definitions.ts';
import { collectEvents, type CollectOptions } from '../collect/collectEvents.ts';
import { defaultProcessSteps } from '../process/defaultSteps.ts';
import { defaultExporters } from '../export/defaultExporters.ts';
import type { Pipeline } from './runPipeline.ts';

/** The standard pipeline: collect from `sources`, run the default steps, use the default exporters. */
export function createDefaultPipeline(sources: EventSource[], collectOptions: CollectOptions = {}): Pipeline {
    return {
        collect: () => collectEvents(sources, collectOptions),
        process: defaultProcessSteps,
        export: defaultExporters,
    };
}
