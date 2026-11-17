/**
 * Production pipeline machine (mirrors
 * extensions/dsh/machines/machines/dsh-cult-canvas.mjs).
 *
 * Monotonic stage sequence; state names align with PRODUCTION_STAGES in
 * src/application/pipeline-engine.ts. Kept dependency-free (xstate only) so
 * the same machine can be serialized or executed anywhere.
 */
import { createMachine, transition } from "xstate";
export const productionPipelineMachine = createMachine({
    id: "productionPipeline",
    initial: "brief",
    description: "Monotonic media-production stage inferred from canvas evidence; quality gate G6 forbids going back.",
    states: {
        brief: { on: { BIBLE_READY: "bible" } },
        bible: { on: { ASSETS_READY: "assets" } },
        assets: { on: { SCRIPT_READY: "script" } },
        script: { on: { STORYBOARD_READY: "storyboard" } },
        storyboard: { on: { SHOTS_READY: "shots_ready" } },
        shots_ready: { on: { GENERATION_STARTED: "generating" } },
        generating: { on: { GENERATION_DONE: "qc" } },
        qc: { on: { POST_STARTED: "post" } },
        post: { on: { DELIVERED: "delivered" } },
        delivered: { type: "final" },
    },
});
/** Event that enters each post-brief stage, in stage order. */
export const STAGE_ENTRY_EVENT = {
    bible: "BIBLE_READY",
    assets: "ASSETS_READY",
    script: "SCRIPT_READY",
    storyboard: "STORYBOARD_READY",
    shots_ready: "SHOTS_READY",
    generating: "GENERATION_STARTED",
    qc: "GENERATION_DONE",
    post: "POST_STARTED",
    delivered: "DELIVERED",
};
/**
 * Pure machine step (no actors); illegal transitions throw so model drift
 * fails in tests instead of silently corrupting stage state.
 */
export function nextPipelineStage(stage, event) {
    const snapshot = productionPipelineMachine.resolveState({ value: stage });
    if (!snapshot.can({ type: event })) {
        throw new Error(`illegal transition: ${stage} --${event}-->`);
    }
    return transition(productionPipelineMachine, snapshot, { type: event })[0]
        .value;
}
