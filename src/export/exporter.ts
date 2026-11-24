import type { EventRecord } from '../definitions.ts';

export interface ExportContext {
    /** Directory for output files (and the stage checkpoints). Default: "output". */
    outputDir: string;
}

export type ExportOutput = {
    /** Files the exporter wrote. */
    fileNames: string[];
    /** Non-fatal problems, shown in the run summary. */
    warnings?: string[];
};

export interface Exporter {
    /** Used in summaries and to select exporters with --export. Must be unique within a pipeline. */
    readonly name: string;
    /** Skipped in a full run; runs only when named explicitly (--export <name>). */
    readonly onDemand?: boolean;
    /** Set to false if the exporter doesn't use `events` (e.g. it renders a file another exporter wrote). */
    readonly needsEvents?: boolean;
    /** Throwing fails this exporter only; the others still run. */
    export(events: EventRecord[], ctx: ExportContext): Promise<ExportOutput>;
}
