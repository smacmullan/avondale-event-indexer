import fs from 'fs';
import { collectEvents } from "../src/collect/collectEvents.ts";
import type { EventSource } from '../src/definitions.ts';

const sources : EventSource[] = JSON.parse(fs.readFileSync('config/sources.json', 'utf-8'));
let events = await collectEvents(sources);