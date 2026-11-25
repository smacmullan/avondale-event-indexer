import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Exporter } from '../exporter.ts';

const optionsSchema = z.object({
    /** Output file. Default: <outputDir>/events.json */
    fileName: z.string().min(1).optional(),
    /** Skip in full runs; run only with --export eventsJson. */
    onDemand: z.boolean().default(false),
}).strict();

export type EventsJsonOptions = z.input<typeof optionsSchema>;

/** Strips unnecessary fields from events and then writes them to a JSON file. */
export function eventsJson(rawOptions: EventsJsonOptions = {}): Exporter {
    const options = optionsSchema.parse(rawOptions);

    return {
        name: 'eventsJson',
        onDemand: options.onDemand,
        async export(events, ctx) {
            const fileName = options.fileName ?? path.join(ctx.outputDir, 'events.json');

            // strip the source fields
            const strippedEvents = events.map(({ source, ...event }) => event);

            fs.mkdirSync(path.dirname(fileName), { recursive: true });
            fs.writeFileSync(fileName, JSON.stringify(strippedEvents));

            return { fileNames: [fileName] };
        },
    };
}
