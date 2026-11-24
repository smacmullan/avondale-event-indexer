import fs from 'fs';
import { collectEvents } from "./src/collect/collectEvents.ts";
import { processEvents, printProcessSummary, ProcessStepError } from './src/process/processEvents.ts';
import { defaultProcessSteps } from './src/process/defaultSteps.ts';
import { printEventList } from "./src/printEventList.ts";

const sources = JSON.parse(fs.readFileSync('config/sources.json', 'utf-8'));
let events = await collectEvents(sources);
// save raw event data
fs.writeFileSync('output/rawEvents.json', JSON.stringify(events, null, 2));

console.log("Processing event data...");
try {
    const processed = await processEvents(events, defaultProcessSteps);
    printProcessSummary(processed.steps, { verbose: true });
    events = processed.events;
} catch (error) {
    if (!(error instanceof ProcessStepError))
        throw error;
    console.error(error.message);
    console.error('output/events.json was not updated and nothing was exported.');
    process.exit(1);
}
// save processed event data
fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));

printEventList(events);