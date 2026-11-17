import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	productionPipelineMachine,
	nextPipelineStage,
	STAGE_ENTRY_EVENT,
	type ProductionPipelineValue,
} from "../src/domain/machines/pipeline.machine.js";
import {
	canvasElementMachine,
	nextElementStatus,
} from "../src/domain/machines/element.machine.js";
import { PRODUCTION_STAGES } from "../pipeline-engine.js";

describe("productionPipeline machine", () => {
	it("lifecycle brief -> delivered follows PRODUCTION_STAGES order", () => {
		const walked: ProductionPipelineValue[] = ["brief"];
		let stage: ProductionPipelineValue = "brief";
		for (const s of PRODUCTION_STAGES) {
			if (s === "brief") continue;
			stage = nextPipelineStage(stage, STAGE_ENTRY_EVENT[s]);
			walked.push(stage);
		}
		assert.deepEqual(walked, [...PRODUCTION_STAGES]);
		const final = productionPipelineMachine.resolveState({ value: stage });
		assert.equal(final.status, "done");
		assert.equal(final.can({ type: "DELIVERED" }), false);
	});

	it("rejects illegal transitions (G6 monotonicity)", () => {
		assert.throws(
			() => nextPipelineStage("brief", "SCRIPT_READY"),
			/illegal transition: brief --SCRIPT_READY-->/,
		);
		assert.throws(
			() => nextPipelineStage("bible", "BIBLE_READY"),
			/illegal transition: bible --BIBLE_READY-->/,
		);
		assert.throws(
			() => nextPipelineStage("qc", "GENERATION_STARTED"),
			/illegal transition: qc --GENERATION_STARTED-->/,
		);
	});
});

describe("canvasElement machine", () => {
	it("lifecycle idle -> running -> completed", () => {
		const running = nextElementStatus("idle", "EXECUTE");
		assert.equal(running, "running");
		assert.equal(nextElementStatus(running, "COMPLETE"), "completed");
	});

	it("lifecycle idle -> running -> failed", () => {
		const running = nextElementStatus("idle", "EXECUTE");
		assert.equal(nextElementStatus(running, "FAIL"), "failed");
	});

	it("terminal states are final", () => {
		assert.equal(
			canvasElementMachine.resolveState({ value: "completed" }).status,
			"done",
		);
		assert.equal(
			canvasElementMachine.resolveState({ value: "failed" }).status,
			"done",
		);
	});

	it("rejects illegal transitions", () => {
		assert.throws(
			() => nextElementStatus("idle", "COMPLETE"),
			/illegal transition: idle --COMPLETE-->/,
		);
		assert.throws(
			() => nextElementStatus("completed", "EXECUTE"),
			/illegal transition: completed --EXECUTE-->/,
		);
	});
});
