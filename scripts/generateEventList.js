import fs from 'fs';
import { printEventList } from "../src/printEventList.js";

if (fs.existsSync('output/events.json')) {
    let events = JSON.parse(fs.readFileSync('output/events.json', 'utf-8'));
    printEventList(events);
} else {
    console.log(`"output/events.json" is not present. Index events first.`);
}