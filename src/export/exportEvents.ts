import type { EventRecord } from '../definitions.ts';
import type { Exporter, ExportContext } from './exporter.ts';

export type ExportResult = {
    exporter: string;
    status: 'ok' | 'failed';
    fileNames: string[];
    warnings: string[];
    /** Why the exporter failed. Only set when status is 'failed'. */
    error?: string;
    durationMs: number;
};

/** Runs the exporters concurrently. They are independent: one failing doesn't stop the others. */
export async function exportEvents(
    events: EventRecord[],
    exporters: readonly Exporter[],
    ctx: ExportContext,
): Promise<ExportResult[]> {
    return Promise.all(exporters.map(async (exporter): Promise<ExportResult> => {
        const startedAt = performance.now();
        const elapsed = () => Math.round(performance.now() - startedAt);
        try {
            const output = await exporter.export(events, ctx);
            return {
                exporter: exporter.name,
                status: 'ok',
                fileNames: output.fileNames,
                warnings: output.warnings ?? [],
                durationMs: elapsed(),
            };
        } catch (error) {
            return {
                exporter: exporter.name,
                status: 'failed',
                fileNames: [],
                warnings: [],
                error: error instanceof Error ? error.message : String(error),
                durationMs: elapsed(),
            };
        }
    }));
}

export function formatExportSummary(results: readonly ExportResult[], skippedOnDemand: readonly string[] = []): string {
    const width = Math.max(0, ...results.map(result => result.exporter.length));
    const lines: string[] = [];

    for (const result of results) {
        const name = result.exporter.padEnd(width);
        lines.push(result.status === 'ok'
            ? `  ${name}  ok      ${result.fileNames.join(', ') || '(no files)'}`
            : `  ${name}  FAILED  ${result.error}`);
        for (const warning of result.warnings)
            lines.push(`      warning: ${warning}`);
    }
    if (skippedOnDemand.length > 0)
        lines.push(`Not run (on demand): ${skippedOnDemand.join(', ')}. Use --export <name> to run.`);

    return lines.join('\n');
}
