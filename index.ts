import fs from 'fs';
import { indexEvents } from "./src/indexEvents.ts";
import { printEventList } from "./src/printEventList.ts";
import { cleanEvents } from './src/cleanEvents.ts';

const organizations = JSON.parse(fs.readFileSync('config/organizations.json', 'utf-8'));
let events = await indexEvents(organizations);
// save raw event data
fs.writeFileSync('output/rawEvents.json', JSON.stringify(events, null, 2));

events = cleanEvents(events);
// save cleaned event data
fs.writeFileSync("output/events.json", JSON.stringify(events, null, 2));

printEventList(events);
