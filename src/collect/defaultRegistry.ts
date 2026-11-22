import { IntegrationRegistry } from './integrationRegistry.ts';
import type { EventIntegration } from '../definitions.ts';
 
import { jsonLdIntegration } from './integrations/jsonLd.ts';
import { googleCalendarIntegration } from './integrations/googleCalendar.ts';
import { googleSheetIntegration } from './integrations/googleSheet.ts';
import { plotIntegration } from './integrations/plot.ts';
import { do312Integration } from './integrations/do312.ts';
import { webCalIntegration } from './integrations/webcal.ts';
import { microdataIntegration } from './integrations/microdata.ts';
import { bookManagerIntegration } from './integrations/bookManager.ts';
import { eventsCalendarCoIntegration } from './integrations/eventsCalendarCo.ts';
import { chicagoPublicSchoolsIntegration } from './integrations/chicagoPublicSchools.ts';
import { offeringTreeIntegration } from './integrations/offeringTree.ts';
import { cpdCapsIntegration } from './integrations/cpdCaps.ts';
import { elfSightIntegration } from './integrations/elfSight.ts';
import { chicagoBlockPartiesIntegration } from './integrations/chicagoBlockParties.ts';
import { popMenuIntegration } from './integrations/popMenu.ts';
import { squareSpaceIntegration } from './integrations/squareSpace.ts';
import { chicagoDotComIntegration } from './integrations/chicagoDotCom.ts';
import { chicagoParkDistrictIntegration } from './integrations/chicagoParkDistrict.ts';
// source-specific wrappers on existing integrations
import { hairpinIntegration } from './integrations/custom/hairpin.ts';
import { consignmentLoungeIntegration } from './integrations/custom/consignmentLounge.ts';
import { avondaleSbaIntegration } from './integrations/custom/avondaleSba.ts';
 
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
 