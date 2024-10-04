import fs from 'fs';
import { indexEvents } from "./src/indexEvents.js";
import { printEventList } from "./src/printEventList.js";

const organizations = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));
let events = await indexEvents(organizations);

console.log("Converting event data into event list...");
printEventList(events);
