import type { Exporter } from './exporter.ts';
import { withSteps } from './withSteps.ts';
import { filterForUpcomingWeek } from '../process/steps/filterForUpcomingWeek.ts';
import { eventListMarkdown } from './exporters/eventListMarkdown.ts';
import { newsletterHtml } from './exporters/newsletterHtml.ts';
import { postImages } from './exporters/postImages.ts';

/**
 * The built-in exporters. Copy and edit this list to add or remove exporters. A full run skips
 * on-demand exporters (postImages); run those with `node index.ts --export postImages`.
 */
export const defaultExporters: Exporter[] = [
    withSteps(eventListMarkdown(), [filterForUpcomingWeek()]),
    withSteps(newsletterHtml(), [filterForUpcomingWeek()]),
    postImages(),   // on demand: renders your hand-edited eventList.md
];
