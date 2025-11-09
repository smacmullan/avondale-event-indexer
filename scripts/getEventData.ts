import fs from 'fs';
import { indexEvents } from "../src/indexEvents.ts";
import type { Organization } from '../src/definitions.ts';

const organizations : Organization[] = JSON.parse(fs.readFileSync('organizations.json', 'utf-8'));
let events = await indexEvents(organizations);