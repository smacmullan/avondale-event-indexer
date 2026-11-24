import type { EventRecord } from '../definitions.ts';
import type { ProcessStep } from '../process/processStep.ts';
import { processEvents, formatProcessSummary, type ProcessResult } from '../process/processEvents.ts';
import type { Exporter } from '../export/exporter.ts';
import { exportEvents, formatExportSummary, type ExportResult } from '../export/exportEvents.ts';
import { checkpointPaths, readCheckpoint, normalizeForCheckpoint, writeCheckpoint } from './checkpoints.ts';

export type Stage = 'collect' | 'process' | 'export';
export const STAGES: readonly Stage[] = ['collect', 'process', 'export'];

export type Pipeline = {
    /** Returns the raw events. Usually `() => collectEvents(sources)`. */
    collect: () => Promise<EventRecord[]>;
    process: readonly ProcessStep[];
    export: readonly Exporter[];
};

export type RunOptions = {
    /** First stage to run. Earlier stages are skipped and their checkpoint file is read instead. Default: collect. */
    from?: Stage;
    /** Last stage to run. Default: export. */
    to?: Stage;
    /** Run only these exporters (by name), including on-demand ones. Default: every exporter that isn't on demand. */
    exporters?: string[];
    /** Where checkpoints and exports go. Default: "output". */
    outputDir?: string;
    /** List every removed and changed event in the processing summary. */
    verbose?: boolean;
    /** Where progress and summaries are printed. Default: console.log. */
    log?: (message: string) => void;
};

export type RunResult = {
    processed?: ProcessResult;
    exports?: ExportResult[];
    /** On-demand exporters that were not run. */
    skippedOnDemand: string[];
};

/**
 * Runs the pipeline's stages: collect -> (rawEvents.json) -> process -> (events.json) -> export.
 *
 * A processing step that throws stops the run with a ProcessStepError: events.json is left as it
 * was and nothing is exported. Exporters are independent; a failing one is reported in the result.
 */
export async function runPipeline(pipeline: Pipeline, options: RunOptions = {}): Promise<RunResult> {
    const {
        from = 'collect',
        to = 'export',
        exporters: requestedExporters,
        outputDir = 'output',
        verbose = false,
        log = console.log,
    } = options;

    const startIndex = STAGES.indexOf(from);
    const endIndex = STAGES.indexOf(to);

    // Validate stage selection
    if (startIndex < 0 || endIndex < 0)
        throw new Error(`Unknown stage "${startIndex < 0 ? from : to}". Stages: ${STAGES.join(', ')}`);

    if (startIndex > endIndex)
        throw new Error(`Cannot run from "${from}" to "${to}": "${from}" comes after "${to}".`);

    if (requestedExporters && to !== 'export')
        throw new Error(`Exporters were selected, but the run stops after the "${to}" stage.`);

    // Validate exporters before starting any work
    assertUniqueNames(pipeline.export);

    const { selected: selectedExporters, skippedOnDemand } = to === 'export'
        ? selectExporters(pipeline.export, requestedExporters)
        : { selected: [] as Exporter[], skippedOnDemand: [] as string[] };

    const shouldCollect = from === 'collect';
    const shouldProcess = from !== 'export' && to !== 'collect';
    const shouldExport = to === 'export';

    const paths = checkpointPaths(outputDir);
    const result: RunResult = { skippedOnDemand };

    let events: EventRecord[] = [];

    // Collect
    if (shouldCollect) {
        events = normalizeForCheckpoint(await pipeline.collect());
        writeCheckpoint(paths.raw, events);
        log(`Saved ${events.length} raw events to ${paths.raw}`);
    }

    // Process
    if (shouldProcess) {
        if (from === 'process')
            events = readCheckpoint(paths.raw, 'collect');

        log('Processing event data...');

        result.processed = await processEvents(events, pipeline.process);

        const summary = formatProcessSummary(result.processed.steps, verbose);
        if (summary)
            log(summary);

        events = normalizeForCheckpoint(result.processed.events);
        writeCheckpoint(paths.processed, events);
        log(`Saved ${events.length} processed events to ${paths.processed}`);
    }

    // Export
    if (shouldExport) {
        // Only load the processed checkpoint when starting directly at the export stage
        // and at least one selected exporter needs events.
        if (from === 'export' && selectedExporters.some(exporter => exporter.needsEvents !== false))
            events = readCheckpoint(paths.processed, 'process');

        log('Exporting events...');

        result.exports = await exportEvents(events, selectedExporters, { outputDir });

        const summary = formatExportSummary(result.exports, skippedOnDemand);
        if (summary)
            log(summary);
    }

    return result;
}

function assertUniqueNames(exporters: readonly Exporter[]): void {
    const seen = new Set<string>();
    for (const { name } of exporters) {
        if (seen.has(name))
            throw new Error(`Two exporters are named "${name}". Exporter names must be unique.`);
        seen.add(name);
    }
}

function selectExporters(all: readonly Exporter[], wanted?: string[]) {
    if (wanted) {
        const unknown = wanted.filter(name => !all.some(exporter => exporter.name === name));
        if (unknown.length > 0)
            throw new Error(`Unknown exporter${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Available: ${all.map(e => e.name).join(', ')}`);
        return { selected: all.filter(exporter => wanted.includes(exporter.name)), skippedOnDemand: [] as string[] };
    }
    return {
        selected: all.filter(exporter => !exporter.onDemand),
        skippedOnDemand: all.filter(exporter => exporter.onDemand).map(exporter => exporter.name),
    };
}
