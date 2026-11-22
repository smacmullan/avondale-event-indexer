import fs from 'fs';
import { collectEvents } from "./src/collect/collectEvents.ts";
import { printEventList } from "./src/printEventList.ts";
import { cleanEvents } from './src/cleanEvents.ts';

const sources = JSON.parse(fs.readFileSync('config/sources.json', 'utf-8'));
let events = await collectEvents(sources);
// save raw event data
fs.writeFileSync('output/rawEvents.json', JSON.stringify(events, null, 2));

events = cleanEvents(events);
// save cleaned event data
fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));

printEventList(events);
