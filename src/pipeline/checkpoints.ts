import fs from 'node:fs';
import path from 'node:path';
import type { EventRecord } from '../definitions.ts';

/** The stage boundaries on disk: raw = after collecting, processed = after processing. */
export function checkpointFilePaths(outputDir: string) {
    return {
        raw: path.join(outputDir, 'rawEvents.json'),
        processed: path.join(outputDir, 'processedEvents.json'),
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
export function readCheckpoint(filePath: string, producedBy: 'collect' | 'process'): EventRecord[] {
    if (!fs.existsSync(filePath))
        throw new Error(`"${filePath}" is not present. Run the ${producedBy} stage first (--from ${producedBy}).`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function writeCheckpoint(filePath: string, events: EventRecord[]): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
}
