import type { EventRecord } from '../definitions.ts';
import type { ProcessStep, StepContext } from './processStep.ts';

export type StepResult = {
    step: string;
    inputCount: number;
    outputCount: number;
    removed: { name: string; reason: string }[];
    changed: { name: string; detail: string }[];
    durationMs: number;
};

export type ProcessResult = {
    events: EventRecord[];
    steps: StepResult[];
};

export type ProcessOptions = {
    /** Give each step a deep-frozen copy of its input so any mutation throws. For tests and development. */
    freezeInputs?: boolean;
};

export class ProcessStepError extends Error {
    readonly step: string;
    readonly stepNumber: number;
    readonly stepCount: number;
    /** Results of the steps that finished before this one failed. */
    readonly completed: StepResult[];

    constructor(step: string, stepNumber: number, stepCount: number, completed: StepResult[], cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);
        super(`Step ${stepNumber} of ${stepCount} "${step}" failed: ${message}`, { cause });
        this.name = 'ProcessStepError';
        this.step = step;
        this.stepNumber = stepNumber;
        this.stepCount = stepCount;
        this.completed = completed;
    }
}

/**
 * Runs the steps in order, feeding each step the previous step's output. The first step that
 * throws (or returns something that isn't an array) stops the run with a ProcessStepError.
 */
export async function processEvents(
    events: EventRecord[],
    steps: readonly ProcessStep[],
    { freezeInputs = false }: ProcessOptions = {},
): Promise<ProcessResult> {
    const results: StepResult[] = [];

    for (const [index, step] of steps.entries()) {
        const removed: StepResult['removed'] = [];
        const changed: StepResult['changed'] = [];
        const ctx: StepContext = {
            remove(event, reason) {
                removed.push({ name: event.name, reason });
                return null;
            },
            change(before, after, detail = '') {
                changed.push({ name: before.name, detail });
                return after;
            },
        };

        const startedAt = performance.now();
        let output: EventRecord[];
        try {
            output = await step.run(freezeInputs ? deepFreeze(structuredClone(events)) : events, ctx);
            if (!Array.isArray(output))
                throw new Error(`returned ${typeof output} instead of an array of events`);
        } catch (error) {
            throw new ProcessStepError(step.name, index + 1, steps.length, results, error);
        }

        results.push({
            step: step.name,
            inputCount: events.length,
            outputCount: output.length,
            removed,
            changed,
            durationMs: Math.round(performance.now() - startedAt),
        });
        events = output;
    }

    return { events, steps: results };
}

/** One line per step. With `verbose`, also lists every removed and changed event. */
export function formatProcessSummary(steps: readonly StepResult[], verbose = false): string {
    if (steps.length === 0)
        return '';

    const width = Math.max(...steps.map(s => s.step.length));
    return steps.map(s => {
        const what = [
            s.removed.length && `removed ${s.removed.length}`,
            s.changed.length && `changed ${s.changed.length}`,
        ].filter(Boolean).join(', ');
        const line = `  ${s.step.padEnd(width)}  ${s.inputCount} → ${s.outputCount}${what ? '   ' + what : ''}`;

        if (!verbose)
            return line;
        return [
            line,
            ...s.removed.map(r => `      - removed "${r.name}": ${r.reason}`),
            ...s.changed.map(c => `      ~ "${c.name}": ${c.detail}`),
        ].join('\n');
    }).join('\n');
}

export function printProcessSummary(steps: readonly StepResult[], { verbose = false } = {}): void {
    const text = formatProcessSummary(steps, verbose);
    if (text)
        console.log(text);
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value))
            deepFreeze(child);
    }
    return value;
}
