import fs from 'node:fs';
import { createDefaultIndexerPipeline } from './src/pipeline/defaultPipeline.ts';
import { runIndexerPipeline } from './src/pipeline/runIndexerPipeline.ts';
import { parseRunArgs, usageText, UsageError } from './src/pipeline/cliArgs.ts';
import { ProcessStepError } from './src/process/processEvents.ts';
import type { EventSource } from './src/definitions.ts';

try {
    const args = parseRunArgs(process.argv.slice(2));

    // Sources are only needed when collecting
    const sources: EventSource[] = !args.help && args.from === 'collect'
        ? JSON.parse(fs.readFileSync('config/sources.json', 'utf-8'))
        : [];
    const pipeline = createDefaultIndexerPipeline(sources, { weeksOut: args.weeksOut });

    if (args.help) {
        console.log(usageText(pipeline.exportEvents));
    } else {
        const result = await runIndexerPipeline(pipeline, {
            from: args.from,
            to: args.to,
            exporters: args.exporters,
            verbose: args.verbose,
        });
        if (result.exports?.some(exported => exported.status === 'failed'))
            process.exitCode = 1;
    }
} catch (error) {
    if (error instanceof UsageError) {
        console.error(`${error.message}\nRun "node index.ts --help" for usage.`);
    } else if (error instanceof ProcessStepError) {
        // A failed step stops the run: events.json keeps its last good contents and nothing is exported.
        console.error(`${error.message}\noutput/events.json was not updated and nothing was exported.`);
    } else {
        console.error(error instanceof Error ? (error.stack ?? error.message) : error);   // unexpected: keep the stack
    }
    process.exitCode = 1;
}
