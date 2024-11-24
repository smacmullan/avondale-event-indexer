# Avondale Event Indexer
The Avondale Event Indexer is a small application that generates a neighborhood event list from local organizations/businesses' public event data.

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

See below for additional configuration and scripts.

# Configuration

## Environment Setup

If you are using any Google integrations, you will need to setup an API key. 

1. Get an API key from Google. Your API key will need to **Google Calendar API** and **Google Sheets API** enabled.
> Refer to [Google's Calendar API Quickstart Guide](https://developers.google.com/calendar/api/quickstart/js). You will need to create a cloud project and enable the APIs. You can skip the OAuth and "create credentials" section. Follow the steps in the "Create an API key" section.
2. Create a file named `.env` in the project root directory.
3. Copy the following into the `.env` file and replace YOUR_API_KEY with your API key.

```.env
GOOGLE_API_KEY=YOUR_API_KEY
```

## Organization List

The `organizations.json` contains a list of organizations to fetch events from. This file comes pre-loaded with local organizations, but you can add more as you see fit. For each organization, you must specify a name, the type of event API, and the API endpoint (usually a URL but sometimes an ID).

# Scripts

`index.js` in the project root directory is the main script that will fetch event data and compile it into a list. The other scripts are located in the `scripts` directory and allow for finer control of the process or extend the functionality.

This project uses TypeScript. Run all scripts using `npx tsx /path/to/script.tx`.

## index.js

Run this script to fetch event data and produce an event list. This will save two files to `/output`:
* `rawEvents.json` - the raw event data
* `events.json` - cleaned event data. Redundant place names and closed events are removed.
* `eventList.md` - a markdown file that lists the events by day.

> Running index.js is equivalent to running **getEventData.js** followed by **generateEventList.js**.

## getEventData.js

Use this script to re-fetch event data. The event data is saved to `rawEvents.json`.

## generateEventList.js

Use this script to take existing event data in `rawEvents.json` and re-create the `eventList.md` event list and cleaned `events.json` file. This is useful for testing formatting changes without needing to re-fetch the data.

## generatePostPhotos.js

Use this script to convert the event list in `eventList.md` into a series of images that can be used for an Instagram post. These images are saved to `/output/posts/`.

> You can manually make edits to `eventList.md` before running this script.

# Event List/Calendar Integrations
This library supports indexing event data from the following sources: 
* JSON LD
* Google Calendar
* Google Sheet
* Plot
* Do312
* WebCal
* Microdata
* Events Calendar Co

JSON LD is the preferred method for an organization/business to host their event data. JSON LD is a web standard that will be indexed by other event search tools (e.g., Google Search). 

## JSON LD
[JSON LD](https://json-ld.org/) embeds standardized data in a webpage's HTML content so that it can easily be picked up by search engines. A webpage with JSON LD will have an HTML script tag of type "application/ld+json" present. Each event should have its own webpage when using JSON LD.

To use this API, provide a URL for a central event page. The interface works as follows:
1. Load the central event page and grab all the hyperlinked URLs present on the page.
2. De-duplicate the list of URLs to obtain a unique list.
3. Go to each URL and check for JSON LD event data. If present, grab the data.

This interface also has several associated options that you can enable by specifying values in the organization object:
* **jsonLdLinkBlockList** (string array) - use to specify a list of URLs to avoid checking (sometimes sites will link to a different view of the same event list and you end up retrieving duplicate events).
* **jsonLdEventLinkMustInclude** (string) - by default, the interface only grabs links with the same base URL of the homepage or that include "event" in the link text. This overrides the default behavior and only grabs links that include the specified text.
* **jsonLdHubPageRequiresRendering** (boolean) - by default (false), the interface grabs static HTML served at the provided API URL ("hub page"). Some webpages have their event links dynamically loaded, which requires the page to render to grab the links. This is more resource intensive.
* **jsonLdEventPagesRequiresRendering** (boolean) - by default (false), the interface grabs static HTML served at each event link. Some webpages load ther JSON LD data dynamically, which requires the webpage to render. This is more resource intensive.

> **Note:** At the moment, there is no rate limiting for rendering pages. If multiple pages are rendered concurrently it can place significant load on your system.

## Google Calendar
This interface allows you to get event data from any public Google calendar. For the API, provide the email address associated with the calendar.

## Google Sheet
This interface allows you to get event data from public Google sheets following a **very specific** format. See [this form](https://forms.gle/qKwAdmRgGEDykowE8) and [this sheet](https://docs.google.com/spreadsheets/d/16ZGiL23lypQqvbW0YNXXi4ylJq5vzvPvE6a78aPemlI/edit?usp=sharing) as an example. The columns must be in the exact same order.

This interface is meant as a catch-all for organizations that don't have a means to host their event data. Organizations can fill out the Google form to submit events and they'll get picked up via this interface.

## Plot
Plot is a website management platform geared towards event venues. You can find the API by going to a Plot website event page and looking at the API calls in the browser development tools. Plot does implement JSON LD, so you can use that as an alternative (the API is less resource intensive and a little faster).

## Do312
Do312 hosts its event data in JSON files located at "https://do312.com/venues/VENUE-NAME.json". Find the venue page, look at the fetch requests using browser developer tools, and then use the URL for this JSON file for the API field.

## WebCal
WebCal is an iCal file hosted at a URL. Provide the webcal URL (use https://, *not* webcal://) for the API. This interface downloads the iCal and parses the events from it.

## Microdata
Microdata is a less common structured data format. For the API, provide the webpage with the microdata and the interface will grab all the event data present on the page.

## Events Calendar Co
This is a plugin used by some businesses for their calendar display. Use browser developer tools to find the API that the webpage is fetching its data from.