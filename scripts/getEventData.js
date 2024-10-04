import fs from 'fs';
import { indexEvents } from "../src/indexEvents.js";

const organizations = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));
let events = await indexEvents(organizations);