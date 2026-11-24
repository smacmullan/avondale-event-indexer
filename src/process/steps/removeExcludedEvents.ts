import fs from 'node:fs';
import { z } from 'zod';
import { eventStep, type ProcessStep } from '../processStep.ts';

const entrySchema = z.object({
    name: z.string(),
    organizer: z.string().nullish(),
});
const filterListSchema = z.array(entrySchema);

const optionsSchema = z.union([
    /** JSON file holding an array of { name, organizer } entries. Read when the step first runs. */
    z.object({ file: z.string().min(1) }).strict(),
    /** The entries themselves. */
    z.object({ entries: filterListSchema }).strict(),
]);

export type RemoveExcludedEventsOptions = z.input<typeof optionsSchema>;

// Same key format as before: an entry without an organizer matches events without one.
const keyOf = (name: string, organizer: unknown) => `${name.trim()}||${organizer}`;

/** Removes events whose name and organizer match an entry in the filter list (common duplicates and non-events). */
export function removeExcludedEvents(rawOptions: RemoveExcludedEventsOptions): ProcessStep {
    // Wrong option shapes fail when the pipeline is built, before anything is collected.
    const options = optionsSchema.parse(rawOptions);

    // The file is read on first use, so building the pipeline does no file IO.
    let listedKeys: Set<string> | undefined;

    function loadKeys(): Set<string> {
        const entries = 'file' in options ? readFilterList(options.file) : options.entries;
        return new Set(entries.map(entry => keyOf(entry.name, entry.organizer)));
    }

    return eventStep('removeExcludedEvents', (event, ctx) => {
        listedKeys ??= loadKeys();
        return listedKeys.has(keyOf(event.name, event.organizer?.name))
            ? ctx.remove(event, `in the filter list (organizer: ${event.organizer?.name ?? 'none'})`)
            : event;
    });
}

function readFilterList(file: string) {
    const parsed = filterListSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf-8')));
    if (!parsed.success) {
        const problems = parsed.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
        throw new Error(`Invalid filter list "${file}": ${problems}`);
    }
    return parsed.data;
}
