import fs from 'fs';
import { cleanEvents } from "../src/cleanEvents.ts";
import type { Event } from '../src/definitions.ts';

if (fs.existsSync('output/rawEvents.json')) {
    let events: Event[] = JSON.parse(fs.readFileSync('output/rawEvents.json', 'utf-8'));
    cleanEvents(events);
    fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));
} else {
    console.log(`"output/rawEvents.json" is not present. Index events first.`);
}