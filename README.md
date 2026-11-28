# Local Event Indexer
Local Event Indexer is a small application that generates a community event list from local organizations/businesses' public event data.

# Setup
1. Install [Node.js](https://nodejs.org)
2. Install [Git](https://git-scm.com)
3. (Optional) Install a text editor, such as [VS Code](https://code.visualstudio.com)
4. Create a new folder somewhere on your computer.
5. Open a command prompt and navigate to the folder. Run the following command to copy the code to your local machine:
```bash
git clone https://github.com/smacmullan/avondale-event-indexer.git
```
6. Run the following command to download dependencies:
```bash
npm install
```
7. To run the event indexer, run the following command:
```bash
npm run start
```

# Overview
Running the indexer goes through a three-stage data processing pipeline:

1. **collect events** - fetch events from event data sources in `config/sources.json`. Saves `output/rawEvents.json`.
2. **process events** - run the raw events through processing steps (remove duplicates, closed events, filtered events, redundant place names, etc.). Saves `output/processedEvents.json`.
3. **export events** - turn `output/processedEvents.json` into various outputs such as a simplified JSON list, markdown event list, newsletter HTML, and social media post images.

Each stage can be run on its own, reading the previous stage's saved file instead of re-collecting. For example, re-running from `process` is useful for testing changes to the cleanup steps without re-fetching every source. Run `node index.ts --help` for all options, the list of exporters, and examples.


# Configuration
## Environment Setup
If you are using any Google integrations, you will need to set up an API key.
1. Get an API key from Google. Your API key needs the **Google Calendar API** and **Google Sheets API** enabled.
> Refer to [Google's Calendar API Quickstart Guide](https://developers.google.com/calendar/api/quickstart/js). You will need to create a cloud project and enable the APIs. You can skip the OAuth and "create credentials" section. Follow the steps in the "Create an API key" section.
2. Create a file named `.env` in the project root directory.
3. Copy the following into the `.env` file and replace YOUR_API_KEY with your API key.

```.env
GOOGLE_API_KEY=YOUR_API_KEY
```

## Source List
`config/sources.json` contains a list of sources to fetch events from. Each source looks like this:

```json
{
  "name": "Example Venue",
  "integrationType": "jsonLd",
  "options": { "url": "https://example.com/events" }
}
```
Options vary per integration.

## Filter List
`config/filterList.json` contains a list of events to remove from the event list during processing. This can be used to get rid of common duplicates or non-events so you don't have to repeatedly delete them by hand.


# Integrations
An *integration* allows the indexer to fetch events from a specific kind of source (a Google Calendar, an iCal feed, a website with JSON-LD, and so on).

List the available integrations:
```bash
node index.ts --list-integrations
```

Show how to configure one (what it does, its options):
```bash
node index.ts --describe jsonLd
```

# Writing an integration
Integrations live in `src/collect/integrations/`. Define one with `defineIntegration`, which takes a [zod](https://zod.dev) schema for the options. The schema is the single source of truth: it validates the options, types `options` inside `fetchEvents`, and generates the option docs shown by `--describe` from each field's `.describe()` text.

```ts
import { z } from 'zod';
import { defineIntegration } from '../defineIntegration.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';

export const exampleIntegration = defineIntegration({
    type: 'example',

    docs: {
        title: 'Example',
        summary: 'One line shown in --list-integrations.',
        details: 'How it works and how to find the right option values.',   // optional
        requiresEnv: ['EXAMPLE_API_KEY'],                                    // optional
        example: { apiUrl: 'https://example.com/api/events' },               // optional, must pass the schema
    },

    options: z.object({
        apiUrl: z.url().describe('URL of the events API'),
    }).strict(),

    async fetchEvents({ source, options, endSearchDate }) {
        const rows = await fetchJson(options.apiUrl);
        const events = standardizeAll(rows, row => ({ name: row.title, startDate: row.start }), source.name);
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
});
```

Then add it to the `builtIns` list in `src/collect/defaultRegistry.ts`, or call `registerIntegration()` yourself.

For a source that needs a small tweak on top of an existing integration, use `withTransform(base, type, docs, transform)` (see `src/collect/integrations/custom/`). It reuses the base integration's options and is listed under "Source-specific" integrations.