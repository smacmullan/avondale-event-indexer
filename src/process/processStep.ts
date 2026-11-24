import type { EventRecord } from '../definitions.ts';

/** What a step can tell the runner about the events it touches. Both calls are recorded in the step's report. */
export interface StepContext {
    /** Record that the step removed an event. Returns null, so per-event steps can `return ctx.remove(event, reason)`. */
    remove(event: EventRecord, reason: string): null;
    /** Record that the step changed an event. Returns the new event. */
    change(before: EventRecord, after: EventRecord, detail?: string): EventRecord;
}

export interface ProcessStep {
    /** Shown in summaries and error messages. */
    readonly name: string;
    /**
     * Receives the whole event list and returns the list for the next step. Don't mutate the input:
     * return new arrays and new event objects (spread events so fields like `source` are kept).
     * Throwing stops the pipeline.
     */
    run(events: EventRecord[], ctx: StepContext): EventRecord[] | Promise<EventRecord[]>;
}

/**
 * Builds a step that handles one event at a time. Return the event to keep it (a new object if
 * you changed it, via ctx.change) or null to remove it (via ctx.remove). Steps that need to see
 * several events at once, like dedupe, implement ProcessStep directly.
 */
export function eventStep(
    name: string,
    fn: (event: EventRecord, ctx: StepContext) => EventRecord | null,
): ProcessStep {
    return {
        name,
        run: (events, ctx) => events.flatMap(event => {
            const result = fn(event, ctx);
            return result ? [result] : [];
        }),
    };
}
