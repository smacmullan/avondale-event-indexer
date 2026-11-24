import type { EventSource } from '../definitions.ts';
import { collectEvents, type CollectOptions } from '../collect/collectEvents.ts';
import { defaultProcessSteps } from '../process/defaultSteps.ts';
import { defaultExporters } from '../export/defaultExporters.ts';
import type { IndexerPipeline } from './runIndexerPipeline.ts';

/** The standard pipeline: collect from `sources`, run the default steps, use the default exporters. */
export function createDefaultIndexerPipeline(sources: EventSource[], collectOptions: CollectOptions = {}): IndexerPipeline {
    return {
        collectEvents: () => collectEvents(sources, collectOptions),
        processEvents: defaultProcessSteps,
        exportEvents: defaultExporters,
    };
}
