import { fetchEvents } from '../src/indexEvents.ts';
import organizations from '../config/organizations.json' with { type: 'json' };

const args = process.argv.slice(2);

function printUsage() {
    console.log(`
Usage:
  # Look up an organization by name from organizations.json
  node scripts/testOrg.ts --org "Reed's Local"

  # Pass a standalone organization JSON
  node scripts/testOrg.ts --org '{"name": "Sleeping Village", "eventApiType": "plot", "api": "sleeping-village.com"}'

  # Optionally override weeks out (default: 8)
  node scripts/testOrg.ts --org "Reed's Local" --weeks 4
`);
}

function getArg(flag: string): string | undefined {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
}

const orgArg = getArg('--org');
const weeksArg = getArg('--weeks');

if (!orgArg) {
    printUsage();
    process.exit(1);
}

const weeksOut = weeksArg ? parseInt(weeksArg, 10) : 8;

let org: any;
if (orgArg.trim().startsWith('{')) {
    org = JSON.parse(orgArg);
} else {
    org = (organizations as any[]).find(o => o.name === orgArg);
    if (!org) {
        console.error(`Organization "${orgArg}" not found in organizations.json`);
        process.exit(1);
    }
}

async function main() {
    const events = await fetchEvents(org, weeksOut);
    console.log(JSON.stringify(events, null, 2));
}

main();