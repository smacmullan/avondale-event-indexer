import fs from 'node:fs';
import { createDefaultIndexerPipeline } from './src/pipeline/defaultPipeline.ts';
import { runIndexerPipeline } from './src/pipeline/runIndexerPipeline.ts';
import { parseCliArgs, usageText, UsageError } from './src/pipeline/cliArgs.ts';
import { formatIntegrationList, formatIntegrationDescription } from './src/pipeline/describeIntegrations.ts';
import { defaultRegistry } from './src/collect/defaultRegistry.ts';
import { ProcessStepError } from './src/process/processEvents.ts';
import type { EventSource } from './src/definitions.ts';

try {
    const args = parseCliArgs(process.argv.slice(2));

    switch (args.mode) {
        case 'help':
            // The exporter list doesn't depend on sources
            console.log(usageText(createDefaultIndexerPipeline([]).exportEvents));
            break;

        case 'list':
            console.log(formatIntegrationList(defaultRegistry.list()));
            break;

        case 'describe': {
            const integration = defaultRegistry.get(args.type);
            if (!integration)
                throw new UsageError(`Unknown integration "${args.type}". Available: ${defaultRegistry.types().join(', ')}`);
            console.log(formatIntegrationDescription(integration));
            break;
        }

        case 'run': {
            // Sources are only needed when collecting
            const sources: EventSource[] = args.from === 'collect'
                ? JSON.parse(fs.readFileSync('config/sources.json', 'utf-8'))
                : [];
            const pipeline = createDefaultIndexerPipeline(sources, { weeksOut: args.weeksOut });

            const result = await runIndexerPipeline(pipeline, {
                from: args.from,
                to: args.to,
                exporters: args.exporters,
                verbose: args.verbose,
            });
            if (result.exports?.some(exported => exported.status === 'failed'))
                process.exitCode = 1;
            break;
        }
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
