import fs from 'node:fs';
import path from 'node:path';
import type { EventRecord } from '../definitions.ts';

/** The stage boundaries on disk: raw = after collecting, processed = after processing. */
export function checkpointPaths(outputDir: string) {
    return {
        raw: path.join(outputDir, 'rawEvents.json'),
        processed: path.join(outputDir, 'events.json'),
    };
}

/**
 * What a later run would read back from disk. Passing events through this at each checkpoint
 * means a run that continues in memory sees exactly the same data as one that starts from the file
 * (for example, Date objects become ISO strings).
 */
export function normalizeForCheckpoint(events: EventRecord[]): EventRecord[] {
    return JSON.parse(JSON.stringify(events));
}

/** `producedBy` names the stage that writes this file, for the error message. */
export function readCheckpoint(file: string, producedBy: 'collect' | 'process'): EventRecord[] {
    if (!fs.existsSync(file))
        throw new Error(`"${file}" is not present. Run the ${producedBy} stage first (--from ${producedBy}).`);
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function writeCheckpoint(file: string, events: EventRecord[]): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(events, null, 2));
}
