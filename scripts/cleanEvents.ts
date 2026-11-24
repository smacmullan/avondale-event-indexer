import fs from 'fs';
import { processEvents, printProcessSummary, ProcessStepError } from "../src/process/processEvents.ts";
import { defaultProcessSteps } from '../src/process/defaultSteps.ts';
import type { EventRecord } from '../src/definitions.ts';

if (fs.existsSync('output/rawEvents.json')) {
    const rawEvents: EventRecord[] = JSON.parse(fs.readFileSync('output/rawEvents.json', 'utf-8'));
    try {
        const { events, steps } = await processEvents(rawEvents, defaultProcessSteps);
        printProcessSummary(steps, { verbose: true });
        fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));
    } catch (error) {
        if (!(error instanceof ProcessStepError))
            throw error;
        console.error(error.message);
        console.error('output/events.json was not updated.');
        process.exitCode = 1;
    }
} else {
    console.log(`"output/rawEvents.json" is not present. Index events first.`);
}