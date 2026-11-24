import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Exporter } from '../exporter.ts';
import { groupEventsByDay, describeSkipped, type DayGroup } from '../groupEventsByDay.ts';

const optionsSchema = z.object({
    /** Output file. Default: <outputDir>/eventList.md */
    fileName: z.string().min(1).optional(),
    /** Skip in full runs; run only with --export eventListMarkdown. */
    onDemand: z.boolean().default(false),
}).strict();

export type EventListMarkdownOptions = z.input<typeof optionsSchema>;

/** Writes the event list as markdown: a "## Day" heading per day with one bullet per event. */
export function eventListMarkdown(rawOptions: EventListMarkdownOptions = {}): Exporter {
    const options = optionsSchema.parse(rawOptions);

    return {
        name: 'eventListMarkdown',
        onDemand: options.onDemand,
        async export(events, ctx) {
            const fileName = options.fileName ?? path.join(ctx.outputDir, 'eventList.md');
            const { days, skipped } = groupEventsByDay(events);

            fs.mkdirSync(path.dirname(fileName), { recursive: true });
            fs.writeFileSync(fileName, renderEventListMarkdown(days));
            return { fileNames: [fileName], warnings: describeSkipped(skipped) };
        },
    };
}

export function renderEventListMarkdown(days: readonly DayGroup[]): string {
    let output = '';
    for (const { day, lines } of days) {
        output += `\n\n## ${day}\n`;
        for (const { event, timeRange, organizerName } of lines)
            output += `* **${timeRange}**   ${event.name} ${organizerName ? `| ${organizerName}` : ""}\n`;
    }
    return output;
}
