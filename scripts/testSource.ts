import { collectEventsFromSource } from '../src/collect/collectEvents.ts';
import sources from '../config/sources.json' with { type: 'json' };

const args = process.argv.slice(2);

function printUsage() {
    console.log(`
Usage:
  # Look up a source by name from sources.json
  node scripts/testSource.ts --source "Reed's Local"

  # Pass a standalone source JSON
  node scripts/testSource.ts --source '{"name": "Sleeping Village", "eventApiType": "plot", "options": {"host": "sleeping-village.com"}}'

  # Optionally override weeks out (default: 8)
  node scripts/testSource.ts --source "Reed's Local" --weeks 4
`);
}

function getArg(flag: string): string | undefined {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
}

const sourceArg = getArg('--source');
const weeksArg = getArg('--weeks');

if (!sourceArg) {
    printUsage();
    process.exit(1);
}

const weeksOut = weeksArg ? parseInt(weeksArg, 10) : 8;

let source: any;
if (sourceArg.trim().startsWith('{')) {
    source = JSON.parse(sourceArg);
} else {
    source = (sources as any[]).find(o => o.name === sourceArg);
    if (!source) {
        console.error(`Source "${sourceArg}" not found in sources.json`);
        process.exit(1);
    }
}

async function main() {
    const events = await collectEventsFromSource(source, { weeksOut });
    console.log(JSON.stringify(events, null, 2));
}

main();