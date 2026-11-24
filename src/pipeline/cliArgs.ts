import { parseArgs } from 'node:util';
import type { Exporter } from '../export/exporter.ts';
import { STAGES, type Stage } from './runIndexerPipeline.ts';

export class UsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsageError';
    }
}

export type RunArgs = {
    help: boolean;
    from: Stage;
    to: Stage;
    /** Set when --export is used. */
    exporters?: string[];
    verbose: boolean;
    /** Set when --weeks is used. */
    weeksOut?: number;
};

/** Parses the command line. Throws UsageError for anything invalid. */
export function parseRunArgs(argv: string[]): RunArgs {
    let values;
    try {
        ({ values } = parseArgs({
            args: argv,
            allowPositionals: false,
            strict: true,
            options: {
                from: { type: 'string' },
                to: { type: 'string' },
                export: { type: 'string', multiple: true },
                weeks: { type: 'string' },
                verbose: { type: 'boolean', default: false },
                help: { type: 'boolean', short: 'h', default: false },
            },
        }));
    } catch (error) {
        throw new UsageError(error instanceof Error ? error.message : String(error));
    }

    const exporters = values.export?.flatMap(value => value.split(',')).map(name => name.trim()).filter(Boolean);
    if (values.export && exporters!.length === 0)
        throw new UsageError('--export needs at least one exporter name');

    // Naming exporters means you want the export stage, so --export alone reads events.json instead of re-collecting
    const from = parseStage('--from', values.from) ?? (exporters ? 'export' : 'collect');
    const to = parseStage('--to', values.to) ?? 'export';

    if (exporters && to !== 'export')
        throw new UsageError(`--export needs the export stage, but --to ${to} stops before it`);
    if (STAGES.indexOf(from) > STAGES.indexOf(to))
        throw new UsageError(`--from ${from} comes after --to ${to}`);

    let weeksOut: number | undefined;
    if (values.weeks !== undefined) {
        weeksOut = Number(values.weeks);
        if (!Number.isInteger(weeksOut) || weeksOut < 1)
            throw new UsageError(`--weeks must be a positive whole number, got "${values.weeks}"`);
        if (from !== 'collect')
            throw new UsageError('--weeks only applies when the collect stage runs');
    }

    return { help: values.help, from, to, exporters, verbose: values.verbose, weeksOut };
}

function parseStage(flag: string, value: string | undefined): Stage | undefined {
    if (value === undefined)
        return undefined;
    if (!(STAGES as readonly string[]).includes(value))
        throw new UsageError(`${flag} must be one of: ${STAGES.join(', ')} (got "${value}")`);
    return value as Stage;
}

export function usageText(exporters: readonly Exporter[]): string {
    const exporterList = exporters
        .map(exporter => `    ${exporter.name}${exporter.onDemand ? '  (on demand)' : ''}`)
        .join('\n');

    return `
Usage: node index.ts [options]

Runs the pipeline: collect -> process -> export. Collecting writes output/rawEvents.json,
processing writes output/events.json, and each later stage can be re-run from those files.

Options:
  --from <stage>     First stage to run: collect (default), process, export.
                     Earlier stages are skipped and their output file is read instead.
  --to <stage>       Last stage to run (default: export)
  --export <names>   Run only these exporters (comma-separated or repeated), including
                     on-demand ones. Implies --from export unless --from is given.
  --weeks <n>        How many weeks out to collect (default: 2). Collect stage only.
  --verbose          List every removed and changed event in the processing summary
  -h, --help         Show this help

Exporters:
${exporterList}

Examples:
  node index.ts                          Everything (on-demand exporters skipped)
  node index.ts --from process           Re-process rawEvents.json, then export
  node index.ts --from export            Re-export events.json
  node index.ts --export postImages      Render images from your edited eventList.md
  node index.ts --to collect             Just collect and save rawEvents.json
`;
}
