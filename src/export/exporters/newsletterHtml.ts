import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Exporter } from '../exporter.ts';
import { groupEventsByDay, describeSkipped, type DayGroup } from '../groupEventsByDay.ts';
import { escapeHtml, httpUrlOrUndefined } from '../escapeHtml.ts';

const optionsSchema = z.object({
    /** Output file. Default: <outputDir>/newsletterEvents.html */
    fileName: z.string().min(1).optional(),
    /** Skip in full runs; run only with --export newsletterHtml. */
    onDemand: z.boolean().default(false),
}).strict();

export type NewsletterHtmlOptions = z.input<typeof optionsSchema>;

/**
 * Writes the event list as newsletter-ready HTML (one table per day). It exports every event it
 * is given: to limit it to one week, wrap it with withSteps(newsletterHtml(), [upcomingWeek()]).
 */
export function newsletterHtml(rawOptions: NewsletterHtmlOptions = {}): Exporter {
    const options = optionsSchema.parse(rawOptions);

    return {
        name: 'newsletterHtml',
        onDemand: options.onDemand,
        async export(events, ctx) {
            const fileName = options.fileName ?? path.join(ctx.outputDir, 'newsletterEvents.html');
            const { days, skipped } = groupEventsByDay(events);

            fs.mkdirSync(path.dirname(fileName), { recursive: true });
            fs.writeFileSync(fileName, renderNewsletterHtml(days));

            const warnings = describeSkipped(skipped);
            if (days.length === 0)
                warnings.unshift('No events to export');
            return { fileNames: [fileName], warnings };
        },
    };
}

/** Event names, organizers, and URLs come from third-party sites, so everything is escaped. */
export function renderNewsletterHtml(days: readonly DayGroup[]): string {
    let output = '';

    for (const { day, lines } of days) {
        output += `<p style="padding-bottom: 20px; padding-top: 30px;"><strong><span style="font-size: 20px">${escapeHtml(day)}</span></strong></p><table style="width: 100%; border-collapse: collapse;"><tbody>`;

        for (const { event, timeRange, organizerName } of lines) {
            const url = httpUrlOrUndefined(event.url);
            const nameHtml = url
                ? `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(event.name)}</a>`
                : escapeHtml(event.name);

            output += `<tr><td style="width: 90px; vertical-align: top;  padding-bottom: 10px;"><p style="text-align: right; padding-right: 10px;"><strong>${escapeHtml(timeRange)}</strong></p></td><td style="padding-bottom: 10px;">${nameHtml}${organizerName ? ` - ${escapeHtml(organizerName)}` : ""}</td></tr>`;
        }

        output += `</tbody></table>`;
    }

    return output;
}
