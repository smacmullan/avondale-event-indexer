import fs from 'fs';
import { indexEvents } from "../src/indexEvents.js";
import { Organization } from '../src/definitions.js';

const organizations : Organization[] = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));
let events = await indexEvents(organizations);