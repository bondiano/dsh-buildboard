/**
 * Media Pipeline Execution Engine & Storyboard Shot Segmentation
 *
 * Implements:
 * - Multi-stage production pipeline lifecycle (brief -> bible -> assets -> script -> storyboard -> shots_ready -> generating -> qc -> post -> delivered)
 * - Automated quality gates G1-G6:
 *     G1 Bible gate
 *     G2 Storyboard gate (max 24 shots, shot size keywords, valid seg, extreme close-up, no 3 consecutive identical motions)
 *     G3 One video per storyboard
 *     G4 Prohibit per-shot video nodes
 *     G6 Stage sequencing
 * - Pure shot segmentation adhering to continuity, duration limits, and seam join rules (strict, loose, cut)
 *   with trailing tiny fragment merge (<= 20% maxSeconds)
 * - Biomechanical combat semantics detection, 12 action poses, and contract addendum
 * - Upstream recursive prompt assembly and Series Bible @mention entity expansion (descending length sort + unicode negative lookahead)
 * - Single-node execution lifecycle (idle -> running -> completed / failed) with external GenerationProvider integration
 * - Full DAG workflow runner with cancellation via AbortSignal and topological sequencing
 */

import { MULTI_INPUT_PORTS } from "../domain/ports.js";
import type { CanvasStore } from "./canvas-store.js";
import { GraphEngine } from "./graph-engine.js";
import type { CanvasElement, SeriesBible } from "../domain/types.js";
import type { GenerationProvider } from "../infrastructure/generation-api.js";

// =============================================================================
// Production Lifecycle Stages & Quality Gates
// =============================================================================

export const PRODUCTION_STAGES = [
	"brief",
	"bible",
	"assets",
	"script",
	"storyboard",
	"shots_ready",
	"generating",
	"qc",
	"post",
	"delivered",
] as const;

export type PipelineStage = (typeof PRODUCTION_STAGES)[number];

export const PRODUCTION_STAGE_ZH: Record<PipelineStage, string> = {
	brief: "立项",
	bible: "设定集",
	assets: "参考图",
	script: "剧本",
	storyboard: "分镜",
	shots_ready: "分镜定稿",
	generating: "生成中",
	qc: "质检",
	post: "后期",
	delivered: "已交付",
};

export const STAGE_INDEX: Record<PipelineStage, number> = Object.fromEntries(
	PRODUCTION_STAGES.map((s, i) => [s, i]),
) as Record<PipelineStage, number>;

export const SHOTSIZE_WORDS = [
	"大特写",
	"特写",
	"近景",
	"中近景",
	"中景",
	"中全景",
	"全景",
	"远景",
] as const;

export const SEG_CANON = new Set([
	"opening",
	"continuation",
	"scene_change",
	"new_character",
	"closeup",
	"state_jump",
]);

export interface GateResult {
	ok: boolean;
	code: string;
	error?: string;
	fails?: string[];
	warns?: string[];
	missing?: string[];
}

export function gateBible(
	bible: Partial<SeriesBible> | Record<string, unknown> | null | undefined,
): { ok: boolean; code: "G1"; missing: string[] } {
	const b = (bible || {}) as Partial<SeriesBible>;
	const missing: string[] = [];
	const worldview = typeof b.worldview === "string" ? b.worldview.trim() : "";
	if (!worldview) {
		missing.push("worldview（世界观/核心设定）");
	}
	const style = typeof b.style === "string" ? b.style.trim() : "";
	if (!style) {
		missing.push("style（风格基调）");
	}
	const chars = b.characters;
	if (!Array.isArray(chars) || chars.length === 0) {
		missing.push("characters（至少 1 个角色）");
	}
	return { ok: missing.length === 0, code: "G1", missing };
}

export function gateStoryboard(shots: StoryboardShot[] | null | undefined): {
	ok: boolean;
	code: "G2";
	fails: string[];
	warns: string[];
} {
	const fails: string[] = [];
	const warns: string[] = [];
	const arr = Array.isArray(shots) ? shots : [];
	if (arr.length === 0) {
		fails.push("分镜表还没有任何镜头（shots 为空）");
		return { ok: false, code: "G2", fails, warns };
	}
	if (arr.length > 24) {
		fails.push(
			`镜头 ${arr.length} 个超过单表上限 24——请按场景拆分为多个分镜表`,
		);
	}
	const normMotion = (s: StoryboardShot) =>
		String(s?.motion || "")
			.trim()
			.toLowerCase();
	arr.forEach((s, i) => {
		const no = `镜${i + 1}`;
		const visual = String(s?.visual || "").trim();
		if (!(Number(s?.duration) > 0)) {
			fails.push(`${no} 缺少时长（duration 必须为正数）`);
		}
		if (!visual) {
			fails.push(`${no} 缺少画面描述（visual）`);
		} else if (!SHOTSIZE_WORDS.some((w) => visual.includes(w))) {
			fails.push(
				`${no} 景别不具体（画面需含 大特写/特写/近景/中近景/中景/中全景/全景/远景 之一）`,
			);
		}
		const seg = String(s?.seg || "")
			.trim()
			.toLowerCase();
		if (seg && !SEG_CANON.has(seg)) {
			fails.push(
				`${no} seg 取值非法：${seg}（只能是 opening/continuation/scene_change/new_character/closeup/state_jump）`,
			);
		}
		const hasMissingContinuity =
			!seg ||
			!(typeof s?.tail === "string" && s.tail.trim()) ||
			!(typeof s?.cam === "string" && s.cam.trim());
		if (hasMissingContinuity) {
			const missingKeys: string[] = [];
			if (!seg) missingKeys.push("seg");
			if (!(typeof s?.tail === "string" && s.tail.trim()))
				missingKeys.push("tail");
			if (!(typeof s?.cam === "string" && s.cam.trim()))
				missingKeys.push("cam");
			warns.push(`${no} 缺衔接字段（${missingKeys.join("/")}）`);
		}
		const dlg = s?.dialogue;
		const dlgText =
			typeof dlg === "string"
				? dlg
				: Array.isArray(dlg)
					? dlg
							.map((d) =>
								typeof d === "string" ? d : `${d.speaker}: ${d.text}`,
							)
							.join(" ")
					: "";
		if (dlgText.trim() && !dlgText.includes("：") && !dlgText.includes(":")) {
			warns.push(`${no} 台词建议逐行「角色：台词」格式`);
		}
	});
	if (
		arr.length > 0 &&
		!arr.some((s) => String(s?.visual || "").includes("大特写"))
	) {
		fails.push("全表没有一个「大特写」——每场至少 1 个大特写（分镜自检硬项）");
	}
	for (let i = 0; i + 2 < arr.length; i++) {
		const a = normMotion(arr[i]!);
		if (a && a === normMotion(arr[i + 1]!) && a === normMotion(arr[i + 2]!)) {
			fails.push(
				`镜${i + 1}–${i + 3} 连续三镜运动完全相同（「${String(arr[i]!.motion).trim()}」）——连续三镜必须不同运动`,
			);
			break;
		}
	}
	return { ok: fails.length === 0, code: "G2", fails, warns };
}

export function gateOneVideoPerStoryboard(
	store: CanvasStore,
	storyboardId: string,
): { ok: boolean; code: "G3"; error?: string; existingVideoId?: string } {
	if (!storyboardId) return { ok: true, code: "G3" };
	const edges = store.getAllEdges();
	const fromSb = new Set(
		edges.filter((e) => e.fromNode === storyboardId).map((e) => e.toNode),
	);
	const nodes = store.getAllElements();
	const existing = nodes.filter(
		(n) =>
			(n.kind === "video" ||
				(n as unknown as { type?: string }).type === "video") &&
			fromSb.has(n.id),
	);
	if (existing.length > 0) {
		const first = existing[0]!;
		return {
			ok: false,
			code: "G3",
			error: `该分镜表已有视频节点「${first.label || first.id}」（一个分镜表 = 一个完整视频）。改提示词/参数用 canvas_update_node 重生成，不要新建第二个视频节点。`,
			existingVideoId: first.id,
		};
	}
	return { ok: true, code: "G3" };
}

export function gateShotNodeName(
	name: string,
	type?: string,
): { ok: boolean; code: "G4"; error?: string } {
	if (type && type !== "image" && type !== "video") {
		return { ok: true, code: "G4" };
	}
	if (/(?:镜头|镜)\s*\d+/u.test(String(name || ""))) {
		return {
			ok: false,
			code: "G4",
			error: `「${String(name).slice(0, 40)}」是逐镜节点命名——多镜头一致性靠角色/场景参考图资产，视频一次生成全部镜头，不要为单个镜头建节点。`,
		};
	}
	return { ok: true, code: "G4" };
}

export function gateStage(
	currentStage: PipelineStage,
	requiredStage: PipelineStage,
): {
	ok: boolean;
	code: "G6";
	at: PipelineStage;
	atIdx: number;
	need: PipelineStage;
	needIdx: number;
} {
	const curIdx = STAGE_INDEX[currentStage] ?? 0;
	const needIdx = STAGE_INDEX[requiredStage] ?? 0;
	return {
		ok: curIdx >= needIdx,
		code: "G6",
		at: currentStage,
		atIdx: curIdx,
		need: requiredStage,
		needIdx,
	};
}

export function inferPipelineStage(store: CanvasStore): PipelineStage {
	const elements = store.getAllElements();
	const bible = store.getBible();
	let idx = 0; // brief

	const bibleAny = Boolean(
		String(bible?.worldview || "").trim() ||
		String(bible?.style || "").trim() ||
		(bible?.characters || []).length > 0,
	);
	if (bibleAny) idx = Math.max(idx, STAGE_INDEX.bible);

	const isDone = (el: CanvasElement) =>
		el.status === "completed" ||
		(el.data as { status?: string })?.status === "done";

	if (
		elements.some(
			(el) =>
				(el.kind === "image" ||
					(el as unknown as { type?: string }).type === "image") &&
				((el.data as { assetId?: string })?.assetId || isDone(el)),
		)
	) {
		idx = Math.max(idx, STAGE_INDEX.assets);
	}

	if (
		elements.some(
			(el) =>
				el.kind === "script" ||
				(el as unknown as { type?: string }).type === "script",
		)
	) {
		idx = Math.max(idx, STAGE_INDEX.script);
	}

	const sbWithShots = elements.filter((el) => {
		if (
			el.kind !== "storyboard" &&
			(el as unknown as { type?: string }).type !== "storyboard"
		) {
			return false;
		}
		const shots =
			(el.data as { shots?: StoryboardShot[] })?.shots ||
			(el as unknown as { shots?: StoryboardShot[] }).shots;
		return Array.isArray(shots) && shots.length > 0;
	});

	if (sbWithShots.length > 0) {
		idx = Math.max(idx, STAGE_INDEX.storyboard);
		const allReady = sbWithShots.every((el) => {
			const shots =
				(el.data as { shots?: StoryboardShot[] })?.shots ||
				(el as unknown as { shots?: StoryboardShot[] }).shots;
			return gateStoryboard(shots).ok;
		});
		if (allReady) {
			idx = Math.max(idx, STAGE_INDEX.shots_ready);
		}
	}

	if (
		elements.some(
			(el) =>
				(el.kind === "video" ||
					(el as unknown as { type?: string }).type === "video") &&
				(el.status === "running" ||
					(el.data as { status?: string })?.status === "generating"),
		)
	) {
		idx = Math.max(idx, STAGE_INDEX.generating);
	}

	if (
		elements.some(
			(el) =>
				(el.kind === "video" ||
					(el as unknown as { type?: string }).type === "video") &&
				isDone(el),
		)
	) {
		idx = Math.max(idx, STAGE_INDEX.qc);
	}

	if (
		elements.some(
			(el) =>
				(el.kind === "finalcut" ||
					(el as unknown as { type?: string }).type === "finalcut") &&
				isDone(el),
		)
	) {
		idx = Math.max(idx, STAGE_INDEX.post);
	}

	const bibleFull = Boolean(
		String(bible?.worldview || "").trim() &&
		String(bible?.style || "").trim() &&
		(bible?.characters || []).length > 0,
	);
	if (bibleFull && idx < STAGE_INDEX.bible) {
		idx = STAGE_INDEX.bible;
	}

	return PRODUCTION_STAGES[idx] ?? "brief";
}

// =============================================================================
// Combat Semantics & Lexicon
// =============================================================================

export const COMBAT_ACTION_LEXICON = [
	{
		id: "spear_ready",
		zh: "侧身沉肩、重心压到后腿、双手前后持械",
		en: "side-on stance, shoulders sunk, weight on the back leg, weapon held fore-aft",
	},
	{
		id: "spear_thrust",
		zh: "腰胯先拧、后腿蹬地发力把双手推出、前腿落成弓步",
		en: "hips twist first, back leg drives the arms forward, front leg lands in a bow stance",
	},
	{
		id: "palm_block",
		zh: "单臂斜上架、掌面外翻、上身侧倾把力卸向体侧",
		en: "one arm angles up, palm turned out, torso tilts to shed the force sideways",
	},
	{
		id: "dodge_lean",
		zh: "髋部后坐、上身后仰避开来势、双手收回护身",
		en: "hips sit back, upper body leans away from the strike, hands pull in to guard",
	},
	{
		id: "dash_forward",
		zh: "前腿蹬直、上身前压、双臂前后摆开冲刺",
		en: "front leg extends, torso presses forward, arms swing in opposition while dashing",
	},
	{
		id: "grit_advance",
		zh: "上身前探、双臂收紧、下颌压低逼近",
		en: "torso leans in, arms tighten, jaw drops while closing in",
	},
	{
		id: "low_sweep",
		zh: "深蹲转体、持械手贴地横扫、另一手撑地",
		en: "deep-squat pivot, weapon hand sweeps low along the ground, other hand plants on the floor",
	},
	{
		id: "spear_ground",
		zh: "单膝下沉、持械手直下压、上身俯冲",
		en: "one knee sinks, weapon hand drives straight down, torso dives",
	},
	{
		id: "crouch_low",
		zh: "单膝跪地、上身压到近地、持械手垂落收势",
		en: "kneeling, torso pressed near the ground, weapon hand settling low",
	},
	{
		id: "ult_charge",
		zh: "抬头挺胸、双臂外展上举、重心拔起蓄力",
		en: "chest open, both arms spread and raised, weight rising as power gathers",
	},
	{
		id: "hit_recoil",
		zh: "上身后折、双臂散开、后脚撤半步卸力",
		en: "upper body folds back, arms fly open, rear foot steps back to absorb the hit",
	},
	{
		id: "knockdown",
		zh: "全身放倒、四肢摊开、重心彻底失守",
		en: "body laid flat, limbs sprawled, balance fully broken",
	},
] as const;

export function detectCombatScene(
	text: string,
	opts?: { mode?: string; combatMode?: string },
): { hit: boolean; matched: string[]; mode: string } {
	const o = opts || {};
	const mode = String(o.mode || o.combatMode || "auto").toLowerCase();
	if (mode === "on") return { hit: true, matched: [], mode: "on" };
	if (mode === "off") return { hit: false, matched: [], mode: "off" };
	const t = String(text || "");
	if (!t.trim()) return { hit: false, matched: [], mode: "auto" };
	const HIT = new RegExp(
		[
			"出招",
			"过招",
			"交手",
			"开打",
			"对打",
			"搏杀",
			"厮杀",
			"互殴",
			"挥拳",
			"出拳",
			"出腿",
			"肘击",
			"膝撞",
			"挥刀",
			"拔刀",
			"挥剑",
			"出剑",
			"劈",
			"砍",
			"斩",
			"刺出",
			"突刺",
			"横扫",
			"扫堂腿",
			"鞭腿",
			"摆拳",
			"勾拳",
			"直拳",
			"抡",
			"格挡",
			"招架",
			"挡开",
			"架开",
			"闪避",
			"躲开",
			"闪身",
			"翻滚",
			"侧身避开",
			"击中",
			"命中",
			"打中",
			"一拳",
			"一掌",
			"一剑",
			"一刀",
			"一枪",
			"受击",
			"挨打",
			"被打",
			"击退",
			"击飞",
			"打飞",
			"撂倒",
			"打倒",
			"击倒",
			"摔倒",
			"摔出",
			"撞飞",
			"撞碎",
			"掀翻",
			"锁喉",
			"擒拿",
			"反关节",
			"压制",
			"按倒",
			"反击",
			"还击",
			"回击",
			"追击",
			"对轰",
			"火并",
			"枪战",
			"交火",
			"开枪",
			"射击",
			"扫射",
			"暗器",
			"箭矢",
			"刀光",
			"剑气",
			"掌风",
			"拳风",
			"破甲",
			"贯穿",
			"震飞",
			"踹",
			"砸向",
		].join("|"),
		"g",
	);
	const DIALOGUE = /说道|说：|说道：|喊道|念道|心里想|暗想|旁白|字幕|歌词/;
	const PAST =
		/(曾|当年|想起|回忆|听说|讲述|史料|新闻|棋局|牌局|谈判|演习|训练|梦里|梦中|传说|故事里|电影里)/;
	// Strip direct dialogue quotations before sentence splitting so that:
	// 1. Dialogue containing exclamation/question marks (! or ?) does not fragment across speaker tags
	// 2. Standalone dialogue in quotes without speaker tags is cleanly excluded from combat matching
	const withoutDialogue = t
		.replace(/“[^”]*([”"」』]|$)/gu, "")
		.replace(/「[^」]*([」”"』]|$)/gu, "")
		.replace(/『[^』]*([』」”"]|$)/gu, "")
		.replace(/‘[^’]*([’]|$)/gu, "")
		.replace(/"[^"]*("|$)/gu, "");

	const lines = withoutDialogue.split(/\n|。|；|;|！|？|!|\?/);
	const matched: string[] = [];
	for (const ln of lines) {
		if (!ln || DIALOGUE.test(ln)) continue;
		const ms = ln.match(HIT) || [];
		for (const w of ms) {
			const i = ln.indexOf(w);
			if (PAST.test(ln.slice(Math.max(0, i - 6), i))) continue;
			matched.push(w);
			break;
		}
		if (matched.length >= 6) break;
	}
	return { hit: matched.length > 0, matched, mode: "auto" };
}

export const COMBAT_FIELDS = [
	"attack",
	"reaction",
	"impact",
	"initiative",
	"nextCombat",
] as const;

export type CombatFieldKey = (typeof COMBAT_FIELDS)[number];

export function shotIsCombat(s: StoryboardShot | null | undefined): boolean {
	if (!s) return false;
	return COMBAT_FIELDS.some((k) => {
		const val = s[k];
		return typeof val === "string" && val.trim().length > 0;
	});
}

export function combatContractAddendum(zh = true): string[] {
	if (!zh) {
		return [
			"",
			"**[COMBAT STORYBOARD - HARD] this script contains real combat. Shots may carry combat fields (all optional; leave them empty on non-combat shots, never invent):**",
			'- **attack**: "attacker -> target, locked body part, trajectory", e.g. "@Li@->@Shen@, locked on chest/shoulder, spear thrust from lower-left to upper-right" - an attack MUST point at a concrete opponent on screen;',
			'- **reaction (required when attack exists)**: the opponent\'s visible block/dodge/hit action - never a statue receiving a blow, never just "blocked it";',
			"- **impact**: contact part, force direction, knockback/imbalance and environmental damage;",
			"- **initiative**: who holds the attack and who turns to counter at the end of this shot;",
			"- **nextCombat**: the next shot's combat intent, echoing the tail's combat state;",
			'- **tail gains a combat state**: write "picture tail state | combat state: who holds the attack, where the weapon/effect is, the hit party\'s state, damage residue" - cross-shot momentum rides entirely on this;',
			"- **timeBeats on combat shots use attack-defense beats**: strike -> opponent receives/counters -> counter or displacement (each beat a visible body state);",
			"- **action lexicon (visible body force, take directly):** " +
				COMBAT_ACTION_LEXICON.map((x) => x.en).join("; ") +
				";",
			'- **never**: move names ("Crouching Tiger style"), summary verbs ("releases a skill / launches an attack / energy explodes"), unexplained teleports, glide drifting, statue trading; write visible body-force chains + opponent response + physical results;',
			"- for materialized-technique shots write vfx as a picture that could be a keyframe still; when expanding prefer keyframe-then-video (hard first frame).",
		];
	}
	return [
		"",
		"**【打斗分镜·战斗因果（本剧本命中打斗，以下为硬规则）】分镜镜头可携带战斗字段（全部可选；非打斗镜一律留空，绝不臆造）：**",
		"- **attack（攻击）**：「攻击者→目标，锁定部位，轨迹方向」，如「@李寒@→@沈铁@，锁定胸肩，自左下向右上横枪突刺」——**攻击必须指向画面里的具体对手**，写明轨迹与锁定部位；",
		"- **reaction（对手回应；有 attack 必写）**：对手的可见防御/闪避/受击动作（如「@沈铁@ 单臂斜上架、掌面外翻、上身侧倾卸力」）——**禁止站桩接招、禁止只写「挡下了」**；",
		"- **impact（接触与受力）**：接触部位、受力方向、击退/失衡与环境破坏（如「枪尖擦肩、沈铁后撤半步、身后木栏断裂」）；",
		"- **initiative（攻守归属）**：本镜结束时谁持攻、谁转入反击；",
		"- **nextCombat（下一镜战斗意图）**：如「@沈铁@ 借卸力之势低身横扫」——与 tail 的战斗态呼应；",
		"- **tail 追加战斗态**：接点尾态写成「画面尾态｜战斗态：攻势在谁、武器/技能位于何处、受击者状态、破坏残留」——**跨镜攻势全靠它传递**；",
		"- **timeBeats 打斗镜用攻防三拍**：出招 → 对手接招/受击 → 反击或位移（每拍写可见身体状态）；",
		"- **动作词表（可见身体发力，直接取用）**：" +
			COMBAT_ACTION_LEXICON.map((x) => x.zh).join("；") +
			"；",
		"- **禁止**：招式名（「回风落雁式」）、概括词（「释放技能/发动攻击/能量爆炸/华丽连招」）、无因瞬移、滑步漂移、站桩对轰；写**可见的身体发力链 + 对手回应 + 物理结果**；",
		"- 具象化招式镜（能量成形/武器光效）的 vfx 写成可直接出设定图的画面，铺开时优先「先出关键帧设定图 → 图生视频（hard 首帧）」。",
	];
}

export function combatCausalityText(
	s: StoryboardShot | null | undefined,
	zh = true,
): string {
	if (!s || !shotIsCombat(s)) return "";
	const g = (k: CombatFieldKey) => {
		const val = s[k];
		return typeof val === "string" ? val.trim() : "";
	};
	const bits: string[] = [];
	if (zh) {
		if (g("attack")) bits.push("攻击（必须朝向该对手）：" + g("attack"));
		if (g("reaction")) bits.push("对手回应（必须演出）：" + g("reaction"));
		if (g("impact")) bits.push("接触与受力：" + g("impact"));
		if (g("initiative")) bits.push("攻守归属：" + g("initiative"));
		if (g("nextCombat")) bits.push("下一镜从该攻势继续：" + g("nextCombat"));
		return bits.length ? "【打斗因果】" + bits.join("；") : "";
	}
	if (g("attack")) {
		bits.push("attack (must point at that opponent): " + g("attack"));
	}
	if (g("reaction")) {
		bits.push("opponent response (must be performed): " + g("reaction"));
	}
	if (g("impact")) bits.push("contact & force: " + g("impact"));
	if (g("initiative")) bits.push("initiative: " + g("initiative"));
	if (g("nextCombat")) {
		bits.push("next shot continues from this momentum: " + g("nextCombat"));
	}
	return bits.length ? "[COMBAT CAUSALITY] " + bits.join("; ") : "";
}

export function validateCombatGeometry(
	s: StoryboardShot | null | undefined,
	zh = true,
): string[] {
	if (!s || !shotIsCombat(s)) return [];
	const out: string[] = [];
	const g = (k: CombatFieldKey) => {
		const val = s[k];
		return typeof val === "string" ? val.trim() : "";
	};
	const pre =
		typeof s.title === "string" && s.title.trim() ? s.title.trim() + " · " : "";
	if (g("attack") && !g("reaction")) {
		out.push(
			zh
				? pre +
						"有攻击但无对手回应：每次攻击必须写对手的可见防御/闪避/受击（禁站桩）"
				: pre +
						"attack without reaction: every attack needs a visible response (no statues)",
		);
	}
	if (g("attack") && !/→|@/.test(g("attack"))) {
		out.push(
			zh
				? pre + "攻击未指向具体对手（缺少 @对手名@ 或 →）"
				: pre + "attack lacks an explicit target (@name@ or ->)",
		);
	}
	const vis = typeof s.visual === "string" ? s.visual : "";
	if (
		/背对|背面|背影/.test(vis) &&
		/表情|眼神|眼眸|面容|脸上的|嘴角/.test(vis)
	) {
		out.push(
			zh
				? pre + "可见性矛盾：背对镜头却写了表情/眼神"
				: pre +
						"visibility conflict: back to camera yet describing facial expression",
		);
	}
	if (
		g("attack") &&
		typeof s.tail === "string" &&
		s.tail.trim() &&
		!/战斗态|combat state/i.test(s.tail)
	) {
		out.push(
			zh
				? pre + "tail 建议补「｜战斗态：…」（跨镜攻势靠它传递）"
				: pre +
						'tail should append "| combat state: ..." (cross-shot momentum rides on it)',
		);
	}
	return out;
}

// =============================================================================
// Storyboard Shot Data Models
// =============================================================================

export interface ShotDialogue {
	speaker: string;
	text: string;
}

export interface StoryboardShot {
	index: number;
	title?: string;
	duration: number;
	visual?: string;
	motion?: string;
	tail?: string;
	start?: string;
	cam?: string;
	seg?: string;
	join?: string;
	dialogue?: ShotDialogue[];
	characters?: string[];
	scene?: string;
	props?: string[];
	negative?: string;
	note?: string;
	vfx?: string;
	sfx?: string;
	timeBeats?: string[];
	// Combat semantics fields
	attack?: string;
	reaction?: string;
	impact?: string;
	initiative?: string;
	nextCombat?: string;
}

export interface ContinuityPlan {
	idx: number;
	seg: string;
	join: "strict" | "loose" | "cut";
	fromTail: boolean;
	fromShot: boolean;
	chain: boolean;
	name: string;
	tail: string;
	cam: string;
	start: string;
	prevTail: string;
	prevTailSource: string;
	note: string;
}

export interface PlanShotSegment {
	index: number;
	shotIds: number[];
	shots: StoryboardShot[];
	startIndex: number;
	endIndex: number;
	startShotIndex: number;
	endShotIndex: number;
	duration: number;
	firstSeg: string;
	lastSeg: string;
	opensOnCut: boolean;
	closesOnCut: boolean;
	seamRisk: "none" | "chain" | "forced";
	needsTailChain: boolean;
	reason: string;
	isJoinStrict: boolean;
	videoSegment: number;
	warnMark?: number;
}

export interface PlanShotSegmentsOptions {
	maxSeconds?: number;
	minSeconds?: number;
	hardMax?: number;
}

export type PlanShotSegmentList = PlanShotSegment[] & {
	segments: PlanShotSegment[];
	total: number;
	max: number;
	cutMode: "clean" | "forced" | "empty";
	warnings: string[];
};

export interface ExecuteNodeOptions {
	signal?: AbortSignal;
	provider?: GenerationProvider;
	mockGenerator?: (
		node: CanvasElement,
		inputs?: Record<string, unknown>,
	) => Promise<unknown>;
}

export interface ExecuteNodeResult {
	ok: boolean;
	nodeId: string;
	status: string;
	assetId?: string;
	error?: string;
}

export interface RunWorkflowOptions {
	rootNodeIds?: string[];
	signal?: AbortSignal;
	stopOnError?: boolean;
	provider?: GenerationProvider;
	mockGenerator?: (
		node: CanvasElement,
		inputs?: Record<string, unknown>,
	) => Promise<unknown>;
}

export interface RunWorkflowResult {
	ok: boolean;
	executedNodes: string[];
	failedNodes: string[];
}

/**
 * Extracts combined visual and motion text from a storyboard shot.
 */
export function shotVisualText(sh: StoryboardShot | null | undefined): string {
	if (!sh) return "";
	return [String(sh.visual || "").trim(), String(sh.motion || "").trim()]
		.filter(Boolean)
		.join("；");
}

/**
 * Analyzes shot continuity, segment role, and seam join tightness between shots.
 */
export function shotContinuityPlan(
	sh: StoryboardShot | null | undefined,
	prev: StoryboardShot | null | undefined,
	idx: number,
): ContinuityPlan {
	const s = sh || ({} as StoryboardShot);
	const i = Number.isFinite(Number(idx)) ? Number(idx) : 0;
	const prevShot = i > 0 ? prev || null : null;
	const segRaw = String(s.seg || "")
		.trim()
		.toLowerCase();

	const SEG_ALIAS: Record<string, string> = {
		opening: "opening",
		open: "opening",
		首段: "opening",
		开场: "opening",
		continuation: "continuation",
		cont: "continuation",
		续: "continuation",
		续帧: "continuation",
		承接: "continuation",
		new_character: "new_character",
		newchar: "new_character",
		新角色: "new_character",
		入场: "new_character",
		scene_change: "scene_change",
		scene: "scene_change",
		换场: "scene_change",
		转场: "scene_change",
		closeup: "closeup",
		insert: "closeup",
		特写: "closeup",
		插入: "closeup",
		state_jump: "state_jump",
		jump: "state_jump",
		跳变: "state_jump",
		状态跳变: "state_jump",
	};

	let seg = SEG_ALIAS[segRaw] || "";
	const boxed = (k: "tail" | "cam" | "start" | "note") => {
		const val = s[k];
		return typeof val === "string" ? val.trim() : "";
	};

	if (!seg) {
		if (!prevShot) {
			seg = "opening";
		} else if (
			/换场|场景切换|转场|另一处|另一场景|切至|切到|次日|翌日|与此同时|数日后|[Cc]ut to/.test(
				shotVisualText(s),
			)
		) {
			seg = "scene_change";
		} else if (
			/新角色|首次出场|走进来|入镜|入场|冒出|推门进|[Ee]nters?/.test(
				shotVisualText(s),
			)
		) {
			seg = "new_character";
		} else if (
			Number(s.duration) > 0 &&
			Number(s.duration) < 1.5 &&
			!(s.dialogue || []).length
		) {
			seg = "closeup";
		} else {
			seg = "continuation";
		}
	}

	if (seg === "opening" && prevShot) {
		seg = "continuation";
	}

	const join: "strict" | "loose" | "cut" =
		seg === "scene_change" || seg === "new_character"
			? "loose"
			: seg === "closeup" || seg === "state_jump"
				? "cut"
				: "strict";

	const chain = seg === "continuation" && !!prevShot;
	const tail = boxed("tail");
	const cam = boxed("cam");

	let prevTail = "";
	let prevTailSource = "";
	if (prevShot) {
		const pt = String(prevShot.tail || "").trim();
		const pm = String(prevShot.motion || "").trim();
		if (pt) {
			prevTail = pt;
			prevTailSource = "tail";
		} else if (pm) {
			prevTail = pm;
			prevTailSource = "motion";
		}
	}
	const start = boxed("start");

	return {
		idx: i,
		seg,
		join,
		fromTail: i > 0,
		fromShot: i > 0,
		chain,
		name: String(s.title || "").trim(),
		tail,
		cam,
		start,
		prevTail,
		prevTailSource,
		note: boxed("note"),
	};
}

/**
 * Checks whether a shot segment type constitutes a natural cut point to start a new segment.
 */
export function isCutPoint(seg: string): boolean {
	return (
		seg === "scene_change" ||
		seg === "closeup" ||
		seg === "new_character" ||
		seg === "opening" ||
		seg === "state_jump"
	);
}

/**
 * Plans storyboard shot segmentation adhering to duration limits, continuity roles, and seam joins.
 * Merges trailing tiny fragments (<= 20% maxSeconds) cleanly into the previous segment.
 */
export function planShotSegments(
	shots: StoryboardShot[],
	opts: PlanShotSegmentsOptions = {},
): PlanShotSegmentList {
	const rawList = Array.isArray(shots) ? shots : [];
	const segments: PlanShotSegment[] = [];

	if (rawList.length === 0) {
		const emptyResult = [] as unknown as PlanShotSegmentList;
		Object.defineProperties(emptyResult, {
			segments: { value: emptyResult, writable: true, configurable: true },
			total: { value: 0, writable: true, configurable: true },
			max: {
				value: opts.maxSeconds ?? 6.0,
				writable: true,
				configurable: true,
			},
			cutMode: { value: "empty", writable: true, configurable: true },
			warnings: { value: [], writable: true, configurable: true },
		});
		return emptyResult;
	}

	const maxSeconds = Math.max(0.5, Number(opts.maxSeconds) || 6.0);
	const warnings: string[] = [];
	const durOf = (s: StoryboardShot) =>
		Math.max(0, Math.round((Number(s?.duration) || 0) * 10) / 10);

	const plans = rawList.map((s, i) =>
		shotContinuityPlan(s, rawList[i - 1] || null, i),
	);
	const total =
		Math.round(rawList.reduce((acc, s) => acc + durOf(s), 0) * 10) / 10;

	let currentStart = 0;
	let currentDuration = 0;
	let segIdx = 1;
	let prevBreakWasDurationOverflow = false;

	for (let i = 0; i < rawList.length; i++) {
		const shot = rawList[i]!;
		const d = durOf(shot);
		currentDuration = Math.round((currentDuration + d) * 10) / 10;
		const isLast = i === rawList.length - 1;

		const nextShot = !isLast ? rawList[i + 1] : undefined;
		const nextPlan = !isLast ? plans[i + 1] : undefined;
		const nextIsCut = nextPlan ? isCutPoint(nextPlan.seg) : true;
		const nextJoin = nextShot?.join;

		// Break condition:
		// 1. Last shot in list
		// 2. Next shot explicitly starts with a cut (via seg or nextJoin === 'cut')
		// 3. Accumulated duration reaches or exceeds generation segment ceiling
		const isDurationOverflow = currentDuration >= maxSeconds;
		const shouldBreak =
			isLast || nextJoin === "cut" || nextIsCut || isDurationOverflow;

		if (shouldBreak) {
			const segShots = rawList.slice(currentStart, i + 1);
			const firstSeg = plans[currentStart]?.seg || "continuation";
			const lastSeg = plans[i]?.seg || "continuation";
			const opensOnCut = segments.length === 0 || isCutPoint(firstSeg);
			const closesOnCut = isCutPoint(lastSeg) || isLast;

			const startShotIndex =
				rawList[currentStart]?.index !== undefined
					? Number(rawList[currentStart]!.index)
					: currentStart + 1;
			const endShotIndex =
				shot.index !== undefined ? Number(shot.index) : i + 1;

			const lastShotInSeg = segShots[segShots.length - 1]!;
			const isJoinStrict = lastShotInSeg.join === "strict";

			let seamRisk: "none" | "chain" | "forced" = "none";
			let reason = "";
			const needsTailChain = segments.length > 0 && !isCutPoint(firstSeg);

			if (needsTailChain) {
				if (prevBreakWasDurationOverflow) {
					seamRisk = "forced";
					reason = "Previous segment exceeded duration limit; forced cut point";
					warnings.push(
						`Segment starting at shot ${startShotIndex} is a forced cut`,
					);
				} else {
					seamRisk = "chain";
					reason =
						"Continuation shot requires tail frame from previous segment";
				}
			} else {
				seamRisk = "none";
				reason = closesOnCut
					? "Segment closes on natural cut point"
					: "Segment starts at shot transition boundary";
			}

			segments.push({
				index: segments.length,
				shotIds: segShots.map((s, idx) =>
					s.index !== undefined ? Number(s.index) : currentStart + idx + 1,
				),
				shots: segShots,
				startIndex: currentStart,
				endIndex: i,
				startShotIndex,
				endShotIndex,
				duration: currentDuration,
				firstSeg,
				lastSeg,
				opensOnCut,
				closesOnCut,
				seamRisk,
				needsTailChain,
				reason,
				isJoinStrict,
				videoSegment: segIdx++,
			});

			prevBreakWasDurationOverflow = !isLast && isDurationOverflow;

			if (!isLast) {
				currentStart = i + 1;
				currentDuration = 0;
			}
		}
	}

	// Trailing tiny fragments (<= 20% maxSeconds) cleanly merged into previous segment
	if (segments.length > 1) {
		const last = segments[segments.length - 1]!;
		const prev = segments[segments.length - 2]!;
		const tol = Math.max(0.6, maxSeconds * 0.1);
		const tinyTail = last.duration <= Math.max(1.0, maxSeconds * 0.2);
		const fits = prev.duration + last.duration <= maxSeconds + tol;
		if (tinyTail && fits) {
			prev.shots = prev.shots.concat(last.shots);
			prev.endIndex = last.endIndex;
			prev.endShotIndex = last.endShotIndex;
			prev.shotIds = prev.shotIds.concat(last.shotIds);
			prev.duration = Math.round((prev.duration + last.duration) * 10) / 10;
			prev.lastSeg = last.lastSeg;
			prev.closesOnCut = last.closesOnCut;
			segments.pop();
			warnings.push(
				`Trailing fragment of ${last.duration}s merged into previous segment (total ${prev.duration}s)`,
			);
		}
	}

	const cleanCuts = segments.every((s) => s.opensOnCut);
	const cutMode: "clean" | "forced" = cleanCuts ? "clean" : "forced";

	const result = segments as unknown as PlanShotSegmentList;
	Object.defineProperties(result, {
		segments: { value: segments, writable: true, configurable: true },
		total: { value: total, writable: true, configurable: true },
		max: { value: maxSeconds, writable: true, configurable: true },
		cutMode: { value: cutMode, writable: true, configurable: true },
		warnings: { value: warnings, writable: true, configurable: true },
	});

	return result;
}

/**
 * Production-grade Media Pipeline Engine.
 */
export class PipelineEngine {
	/**
	 * Splits storyboard shots into coherent video generation segments.
	 */
	planShotSegments(
		shots: StoryboardShot[],
		options?: PlanShotSegmentsOptions,
	): PlanShotSegmentList {
		return planShotSegments(shots, options);
	}

	/**
	 * Automated G1 Bible gate.
	 */
	gateBible(
		bible: Partial<SeriesBible> | Record<string, unknown> | null | undefined,
	): { ok: boolean; code: "G1"; missing: string[] } {
		return gateBible(bible);
	}

	/**
	 * Automated G2 Storyboard gate.
	 */
	gateStoryboard(shots: StoryboardShot[] | null | undefined): {
		ok: boolean;
		code: "G2";
		fails: string[];
		warns: string[];
	} {
		return gateStoryboard(shots);
	}

	/**
	 * Automated G3 One video per storyboard gate.
	 */
	gateOneVideoPerStoryboard(
		store: CanvasStore,
		storyboardId: string,
	): { ok: boolean; code: "G3"; error?: string; existingVideoId?: string } {
		return gateOneVideoPerStoryboard(store, storyboardId);
	}

	/**
	 * Automated G4 Prohibit per-shot video nodes gate.
	 */
	gateShotNodeName(
		name: string,
		type?: string,
	): { ok: boolean; code: "G4"; error?: string } {
		return gateShotNodeName(name, type);
	}

	/**
	 * Automated G6 Stage sequencing gate.
	 */
	gateStage(
		currentStage: PipelineStage,
		requiredStage: PipelineStage,
	): {
		ok: boolean;
		code: "G6";
		at: PipelineStage;
		atIdx: number;
		need: PipelineStage;
		needIdx: number;
	} {
		return gateStage(currentStage, requiredStage);
	}

	/**
	 * Unified gate checker.
	 */
	checkGate(
		gateOrStage: string,
		data: unknown,
		extra?: unknown,
	): {
		pass: boolean;
		ok: boolean;
		code?: string;
		error?: string;
		fails?: string[];
		missing?: string[];
	} {
		const g = gateOrStage.toUpperCase();
		if (g === "G1" || g === "BIBLE") {
			const res = gateBible(
				data as Partial<SeriesBible> | Record<string, unknown>,
			);
			return {
				pass: res.ok,
				ok: res.ok,
				code: "G1",
				missing: res.missing,
				error: res.missing.length
					? `G1 Bible gate missing: ${res.missing.join(", ")}`
					: undefined,
			};
		}
		if (g === "G2" || g === "STORYBOARD") {
			const res = gateStoryboard(data as StoryboardShot[]);
			return {
				pass: res.ok,
				ok: res.ok,
				code: "G2",
				fails: res.fails,
				error: res.fails.length ? res.fails.join("; ") : undefined,
			};
		}
		if (g === "G3" || g === "ONE_VIDEO_PER_STORYBOARD") {
			const res = gateOneVideoPerStoryboard(
				data as CanvasStore,
				extra as string,
			);
			return { pass: res.ok, ok: res.ok, code: "G3", error: res.error };
		}
		if (g === "G4" || g === "PROHIBIT_PER_SHOT_VIDEO") {
			const res = gateShotNodeName(data as string, extra as string);
			return { pass: res.ok, ok: res.ok, code: "G4", error: res.error };
		}
		if (
			g === "G6" ||
			g === "STAGE_SEQUENCING" ||
			PRODUCTION_STAGES.includes(gateOrStage as PipelineStage)
		) {
			const current = (data as PipelineStage) || "brief";
			const required =
				(extra as PipelineStage) || (gateOrStage as PipelineStage);
			const res = gateStage(current, required);
			return {
				pass: res.ok,
				ok: res.ok,
				code: "G6",
				error: res.ok
					? undefined
					: `Current stage ${res.at} has not reached required stage ${res.need}`,
			};
		}
		return { pass: true, ok: true };
	}

	/**
	 * Infers active pipeline stage from canvas state.
	 */
	inferStage(store: CanvasStore): PipelineStage {
		return inferPipelineStage(store);
	}

	/**
	 * Detects combat scenes from text.
	 */
	detectCombatScene(
		text: string,
		opts?: { mode?: string; combatMode?: string },
	): { hit: boolean; matched: string[]; mode: string } {
		return detectCombatScene(text, opts);
	}

	/**
	 * Checks if a shot contains combat fields.
	 */
	shotIsCombat(shot: StoryboardShot | null | undefined): boolean {
		return shotIsCombat(shot);
	}

	/**
	 * Returns combat contract rules addendum.
	 */
	combatContractAddendum(zh = true): string[] {
		return combatContractAddendum(zh);
	}

	/**
	 * Compiles per-shot combat causality string.
	 */
	combatCausalityText(
		shot: StoryboardShot | null | undefined,
		zh = true,
	): string {
		return combatCausalityText(shot, zh);
	}

	/**
	 * Validates geometric rules for combat shots.
	 */
	validateCombatGeometry(
		shot: StoryboardShot | null | undefined,
		zh = true,
	): string[] {
		return validateCombatGeometry(shot, zh);
	}

	/**
	 * Recursively resolves prompt text for a canvas element:
	 * - Traverses upstream prompt edges recursively
	 * - Collects and concatenates upstream script text, storyboard shots, and outputs
	 * - Dynamically replaces @mention entities from the Series Bible using length-descending sorting
	 *   and negative lookahead to prevent substring prefix collision
	 */
	resolvePrompt(
		node: CanvasElement,
		store: CanvasStore,
		visited: Set<string> = new Set(),
	): string {
		if (visited.has(node.id)) return "";
		visited.add(node.id);

		let rawPrompt =
			(node as { prompt?: string }).prompt ||
			(node.mediaParams?.prompt as string) ||
			(node.data?.prompt as string) ||
			(node.data as { output?: string })?.output ||
			node.text ||
			"";

		const nodeShots =
			(node as { shots?: StoryboardShot[] }).shots ||
			(node.data as { shots?: StoryboardShot[] })?.shots;
		if (!rawPrompt && Array.isArray(nodeShots) && nodeShots.length > 0) {
			const lines: string[] = [];
			for (const sh of nodeShots) {
				const parts = [
					sh.title,
					sh.visual,
					sh.motion,
					...(Array.isArray(sh.dialogue)
						? sh.dialogue.map((d) => `${d.speaker}: ${d.text}`)
						: []),
				].filter(Boolean);
				if (parts.length > 0) {
					lines.push(parts.join(" - "));
				}
			}
			rawPrompt =
				lines.join("\n") || (node.data as { output?: string })?.output || "";
		}

		// Upstream edge resolution: recursively pull text from connected upstream nodes
		const edges = store
			.getAllEdges()
			.filter(
				(e) =>
					e.toNode === node.id &&
					(e.toPort === "prompt" ||
						e.toPort === "in" ||
						e.toPort === "script" ||
						e.toPort === "prev" ||
						!e.toPort),
			);

		for (const edge of edges) {
			const source = store.getElementById(edge.fromNode);
			if (source) {
				const srcUpstream = this.resolvePrompt(source, store, visited);
				const srcText = srcUpstream;

				if (srcText) {
					rawPrompt = rawPrompt ? `${srcText}\n${rawPrompt}` : srcText;
				}
			}
		}

		// @mention Series Bible entity resolution:
		// Extract characters, scenes, and props from Series Bible.
		// Sort entities descending by name length to ensure multi-word names (e.g. "@Chen Shi")
		// are not corrupted by prefix matches (e.g. "@Chen").
		// Use negative lookahead (?![\\p{L}\\p{N}_]) with unicode flag gu.
		const bible = store.getBible() as Record<string, unknown> | undefined;
		if (bible) {
			const entities: Array<{ name: string; description: string }> = [];
			for (const category of [
				"characters",
				"scenes",
				"props",
				"entities",
			] as const) {
				const list = bible[category];
				if (Array.isArray(list)) {
					for (const item of list) {
						if (item && typeof item.name === "string" && item.name.trim()) {
							const rawDesc =
								(
									item as {
										desc?: string;
										description?: string;
										prompt?: string;
									}
								).desc ||
								item.description ||
								item.prompt ||
								"";
							const desc = rawDesc.trim();
							entities.push({ name: item.name.trim(), description: desc });
						}
					}
				}
			}

			entities.sort((a, b) => b.name.length - a.name.length);

			for (const entity of entities) {
				const escaped = entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const regex = new RegExp(`@${escaped}(?![\\p{L}\\p{N}_])`, "gu");
				rawPrompt = rawPrompt.replace(
					regex,
					() => `[${entity.name}: ${entity.description}]`,
				);
			}
		}

		return rawPrompt.trim();
	}

	/**
	 * Gathers resolved inputs for a node from incoming edges.
	 */
	getResolvedInputs(
		node: CanvasElement,
		store: CanvasStore,
	): Record<string, unknown> {
		const inputs: Record<string, unknown> = {};
		const edges = store.getAllEdges().filter((e) => e.toNode === node.id);

		for (const edge of edges) {
			const source = store.getElementById(edge.fromNode);
			if (!source) continue;
			const port = edge.toPort || "in";

			let val: unknown;
			if (edge.fromPort === "tailpick") {
				val =
					(source.data as { tailPickAssetId?: string })?.tailPickAssetId ||
					(source.data as { assetId?: string })?.assetId;
			} else if (edge.fromPort === "out" || !edge.fromPort) {
				val =
					(source.data as { assetId?: string })?.assetId ||
					(source.data as { output?: string })?.output ||
					source.text;
			} else {
				val =
					(source.data as Record<string, unknown>)?.[edge.fromPort] ||
					(source.data as { assetId?: string })?.assetId;
			}

			if (MULTI_INPUT_PORTS.has(port)) {
				if (!Array.isArray(inputs[port])) {
					inputs[port] = inputs[port] !== undefined ? [inputs[port]] : [];
				}
				(inputs[port] as unknown[]).push(val);
			} else {
				inputs[port] = val;
			}
		}

		return inputs;
	}

	/**
	 * Executes a single canvas element with reactive status transitions:
	 * idle -> running -> completed / failed.
	 * Integrates with GenerationProvider (image, video, audio) or fallback mockGenerator.
	 * Respects AbortSignal cooperatively before, during, and after execution.
	 */
	async executeNode(
		nodeId: string,
		store: CanvasStore,
		options: ExecuteNodeOptions = {},
	): Promise<ExecuteNodeResult> {
		if (options.signal?.aborted) {
			throw new Error("Execution aborted by signal");
		}

		const node = store.getElementById(nodeId);
		if (!node) {
			throw new Error(`Node not found: ${nodeId}`);
		}

		store.updateElement(nodeId, { status: "running" });

		try {
			if (options.signal?.aborted) {
				throw new Error("Execution aborted by signal");
			}

			const inputs = this.getResolvedInputs(node, store);
			const kindOrType =
				node.kind || (node as unknown as { type?: string }).type || "node";

			let genResult: unknown;
			let assetId: string | undefined;

			if (options.mockGenerator) {
				genResult = await options.mockGenerator(node, inputs);
				assetId = (genResult as { assetId?: string })?.assetId;
			} else if (options.provider) {
				const resolvedPrompt = this.resolvePrompt(node, store);
				if (kindOrType === "image") {
					genResult = await options.provider.generateImage(
						{
							prompt: resolvedPrompt,
							ratio: (node.mediaParams?.ratio as string) || "16:9",
							size: (node.mediaParams?.size as string) || "1024x1024",
							references: Array.isArray(inputs.ref)
								? (inputs.ref as string[])
								: [],
						},
						options.signal,
					);
				} else if (kindOrType === "video") {
					genResult = await options.provider.generateVideo(
						{
							prompt: resolvedPrompt,
							duration: Number(node.mediaParams?.duration) || 5,
							resolution: (node.mediaParams?.resolution as string) || "720P",
							keyframe: (inputs.frame as string) || undefined,
						},
						options.signal,
					);
				} else if (kindOrType === "audio") {
					genResult = await options.provider.generateAudio(
						{
							prompt: resolvedPrompt,
							kind:
								(node.mediaParams?.kind as "speech" | "sfx" | "music") ||
								"speech",
							duration: Number(node.mediaParams?.duration) || 5,
						},
						options.signal,
					);
				}
				if (genResult) {
					assetId = (genResult as { assetId?: string })?.assetId;
				}
			} else {
				assetId =
					(node.data as { assetId?: string })?.assetId ||
					`asset_${kindOrType}_${nodeId}_${Date.now()}`;
			}

			if (options.signal?.aborted) {
				throw new Error("Execution aborted by signal");
			}

			const customData =
				typeof genResult === "object" && genResult !== null
					? (genResult as Record<string, unknown>)
					: {};

			const finalAssetId =
				(customData.assetId as string) ||
				(node.data as { assetId?: string })?.assetId ||
				assetId;

			const finalOutput =
				(customData.output as string) ||
				(node.data as { output?: string })?.output ||
				node.text ||
				`Generated content for ${node.id}`;

			store.updateElement(nodeId, {
				status: "completed",
				data: {
					...node.data,
					...customData,
					assetId: finalAssetId,
					output: finalOutput,
				},
			});

			return {
				ok: true,
				nodeId,
				status: "completed",
				assetId: finalAssetId,
			};
		} catch (err: unknown) {
			if (
				options.signal?.aborted ||
				(err instanceof Error && err.message.toLowerCase().includes("aborted"))
			) {
				throw err;
			}

			const errorMsg = (err as Error).message || "Execution failed";
			store.updateElement(nodeId, {
				status: "failed",
				data: { ...node.data, error: errorMsg },
			});

			return { ok: false, nodeId, status: "failed", error: errorMsg };
		}
	}

	/**
	 * Runs full canvas DAG workflow:
	 * - Validates acyclicity using GraphEngine
	 * - Filters out non-generative elements (strokes, stickies, shapes, links, text, files)
	 *   and authored scripts without upstream generation
	 * - Executes nodes in topological sequence
	 * - Supports cooperative AbortSignal cancellation and stopOnError control
	 */
	async runWorkflow(
		store: CanvasStore,
		options: RunWorkflowOptions = {},
	): Promise<RunWorkflowResult> {
		if (options.signal?.aborted) {
			throw new Error("Workflow aborted by signal");
		}

		const elements = store.getAllElements();
		const edges = store.getAllEdges();

		const graph = new GraphEngine();
		graph.buildGraph(
			elements.map((e) => e.id),
			edges,
		);

		const topoOrder = graph.getTopologicalOrder();
		if (!topoOrder) {
			throw new Error("Cannot run workflow: DAG contains cycles");
		}

		const NON_GENERATIVE_KINDS = new Set([
			"stroke",
			"sticky",
			"shape",
			"group",
			"link",
			"text",
			"file",
		]);

		const isGenerativeTarget = (id: string): boolean => {
			const el = store.getElementById(id);
			if (!el) return false;
			const kind = el.kind || (el as unknown as { type?: string }).type || "";
			if (NON_GENERATIVE_KINDS.has(kind)) return false;
			if (
				(el as unknown as { type?: string }).type === "file" ||
				el.kind === "file"
			) {
				return false;
			}

			// Authored screenplay: script node with pre-existing authored output or primary text, and no upstream generator input
			if (
				kind === "script" &&
				Boolean((el.data as { output?: string })?.output || el.text)
			) {
				const incomingGen = edges.some((ed) => {
					if (ed.toNode !== id) return false;
					const src = store.getElementById(ed.fromNode);
					const srcKind =
						src?.kind || (src as unknown as { type?: string })?.type || "";
					return !NON_GENERATIVE_KINDS.has(srcKind);
				});
				if (!incomingGen) return false;
			}

			return true;
		};

		const candidateOrder =
			options.rootNodeIds && options.rootNodeIds.length > 0
				? topoOrder.filter(
						(id) =>
							options.rootNodeIds!.includes(id) ||
							options.rootNodeIds!.some((root) =>
								graph.getDownstreamNodes(root).includes(id),
							),
					)
				: topoOrder;

		const targets = candidateOrder.filter(isGenerativeTarget);

		const executedNodes: string[] = [];
		const failedNodes: string[] = [];

		for (const nodeId of targets) {
			if (options.signal?.aborted) {
				throw new Error("Workflow aborted by signal");
			}

			const res = await this.executeNode(nodeId, store, {
				signal: options.signal,
				provider: options.provider,
				mockGenerator: options.mockGenerator,
			});

			if (res.ok) {
				executedNodes.push(nodeId);
			} else {
				failedNodes.push(nodeId);
				if (options.stopOnError !== false) {
					return { ok: false, executedNodes, failedNodes };
				}
			}
		}

		return { ok: failedNodes.length === 0, executedNodes, failedNodes };
	}
}
