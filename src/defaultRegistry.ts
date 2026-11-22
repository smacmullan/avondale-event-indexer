import { IntegrationRegistry } from './integrationRegistry.ts';
import type { EventIntegration } from './definitions.ts';
 
import { jsonLdIntegration } from './utils/eventApis/jsonLd.ts';
import { googleCalendarIntegration } from './utils/eventApis/googleCalendar.ts';
import { googleSheetIntegration } from './utils/eventApis/googleSheet.ts';
import { plotIntegration } from './utils/eventApis/plot.ts';
import { do312Integration } from './utils/eventApis/do312.ts';
import { webCalIntegration } from './utils/eventApis/webcal.ts';
import { microdataIntegration } from './utils/eventApis/microdata.ts';
import { bookManagerIntegration } from './utils/eventApis/bookManager.ts';
import { eventsCalendarCoIntegration } from './utils/eventApis/eventsCalendarCo.ts';
import { chicagoPublicSchoolsIntegration } from './utils/eventApis/chicagoPublicSchools.ts';
import { offeringTreeIntegration } from './utils/eventApis/offeringTree.ts';
import { cpdCapsIntegration } from './utils/eventApis/cpdCaps.ts';
import { elfSightIntegration } from './utils/eventApis/elfSight.ts';
import { chicagoBlockPartiesIntegration } from './utils/eventApis/chicagoBlockParties.ts';
import { popMenuIntegration } from './utils/eventApis/popMenu.ts';
import { squareSpaceIntegration } from './utils/eventApis/squareSpace.ts';
import { chicagoDotComIntegration } from './utils/eventApis/chicagoDotCom.ts';
import { chicagoParkDistrictIntegration } from './utils/eventApis/chicagoParkDistrict.ts';
// organization-specific wrappers on existing integrations
import { hairpinIntegration } from './utils/eventApis/custom/hairpin.ts';
import { consignmentLoungeIntegration } from './utils/eventApis/custom/consignmentLounge.ts';
import { avondaleSbaIntegration } from './utils/eventApis/custom/avondaleSba.ts';
 
// `any` is deliberate: each integration has its own options type, and the registry
// erases it at this boundary (register<TOptions> keeps each one checked internally).
const builtIns: EventIntegration<any>[] = [
    jsonLdIntegration,
    googleCalendarIntegration,
    googleSheetIntegration,
    plotIntegration,
    do312Integration,
    webCalIntegration,
    microdataIntegration,
    bookManagerIntegration,
    eventsCalendarCoIntegration,
    chicagoPublicSchoolsIntegration,
    offeringTreeIntegration,
    cpdCapsIntegration,
    elfSightIntegration,
    chicagoBlockPartiesIntegration,
    popMenuIntegration,
    squareSpaceIntegration,
    chicagoDotComIntegration,
    chicagoParkDistrictIntegration,
    hairpinIntegration,
    consignmentLoungeIntegration,
    avondaleSbaIntegration,
];
 
/** Registry with all built-in integrations. Add your own via registerIntegration(). */
export const defaultRegistry = new IntegrationRegistry();
builtIns.forEach(integration => defaultRegistry.register(integration));
 
export const registerIntegration = defaultRegistry.register.bind(defaultRegistry);
 