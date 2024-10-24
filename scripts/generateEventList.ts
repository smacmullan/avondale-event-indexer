import fs from 'fs';
import { printEventList } from "../src/printEventList.js";
import { Event } from '../src/definitions.js';

if (fs.existsSync('output/rawEvents.json')) {
    let events : Event[] = JSON.parse(fs.readFileSync('output/rawEvents.json', 'utf-8'));
    printEventList(events);
} else {
    console.log(`"output/rawEvents.json" is not present. Index events first.`);
}