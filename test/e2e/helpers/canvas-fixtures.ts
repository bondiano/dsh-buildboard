/**
 * Canvas Fixtures for dsh-cult-canvas E2E Test Suite
 * Contains authoritative sample documents, stroke points, storyboard shots,
 * scripts, media parameters, and project bible configurations.
 */

export interface TestPoint {
	x: number;
	y: number;
	pressure?: number;
}

export interface TestShot {
	index: number;
	title: string;
	duration: number;
	visual: string;
	motion: string;
	tail?: string;
	start?: string;
	cam?: string;
	seg:
		| "opening"
		| "continuation"
		| "scene_change"
		| "new_character"
		| "closeup"
		| "state_jump";
	join: "strict" | "loose" | "cut";
	characters: string[];
	scene: string;
	props: string[];
	dialogue?: Array<{ speaker: string; text: string }>;
	sfx?: string;
	timeBeats?: string[];
	vfx?: string;
	negative?: string;
}

export interface TestProjectBible {
	worldview: string;
	style: string;
	styleAnchor: string;
	characters: Array<{
		id: string;
		name: string;
		description: string;
		turnaroundAssetId?: string;
		turnaroundUrl?: string;
		tags: string[];
	}>;
	scenes: Array<{
		id: string;
		name: string;
		description: string;
		referenceAssetId?: string;
		lighting: string;
	}>;
	props: Array<{
		id: string;
		name: string;
		description: string;
		referenceAssetId?: string;
	}>;
}

/**
 * 1. Sample JSON Canvas 1.0 Documents
 */
export const VALID_JSON_CANVAS_1_0 = {
	nodes: [
		{
			id: "node_text_1",
			type: "text",
			text: "# Project Concept\nInteractive AI canvas combining whiteboard with media pipeline.",
			x: 100,
			y: 100,
			width: 300,
			height: 200,
			color: "1",
		},
		{
			id: "node_file_1",
			type: "file",
			file: "assets/character_turnaround.png",
			x: 450,
			y: 100,
			width: 250,
			height: 250,
			color: "4",
		},
		{
			id: "node_link_1",
			type: "link",
			url: "https://jsoncanvas.org/spec/1.0/",
			x: 100,
			y: 350,
			width: 300,
			height: 100,
		},
		{
			id: "node_group_1",
			type: "group",
			label: "Visual Concept Group",
			background: "#1E2024",
			backgroundStyle: "cover",
			x: 80,
			y: 80,
			width: 650,
			height: 400,
		},
	],
	edges: [
		{
			id: "edge_1_2",
			fromNode: "node_text_1",
			fromSide: "right",
			fromEnd: "none",
			toNode: "node_file_1",
			toSide: "left",
			toEnd: "arrow",
			label: "references visual style",
			color: "3",
		},
	],
};

export const MINIMAL_VALID_JSON_CANVAS = {
	nodes: [],
	edges: [],
};

export const MALFORMED_JSON_CANVAS_MISSING_TYPE = {
	nodes: [
		{
			id: "invalid_node",
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			// missing type
		},
	],
	edges: [],
};

export const MALFORMED_JSON_CANVAS_DANGLING_EDGE = {
	nodes: [
		{
			id: "node_a",
			type: "text",
			text: "Alone",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		},
	],
	edges: [
		{
			id: "edge_broken",
			fromNode: "node_a",
			toNode: "non_existent_node_b",
		},
	],
};

/**
 * 2. Sample Freehand Stroke Coordinates
 */
export const STROKE_SINGLE_POINT: TestPoint[] = [
	{ x: 100, y: 150, pressure: 0.5 },
];

export const STROKE_TWO_POINTS: TestPoint[] = [
	{ x: 100, y: 150, pressure: 0.5 },
	{ x: 100.5, y: 150.5, pressure: 0.5 },
];

export const STROKE_CURVED_LINE: TestPoint[] = [
	{ x: 50, y: 50, pressure: 0.3 },
	{ x: 75, y: 70, pressure: 0.5 },
	{ x: 110, y: 95, pressure: 0.7 },
	{ x: 150, y: 110, pressure: 0.8 },
	{ x: 200, y: 115, pressure: 0.6 },
	{ x: 250, y: 110, pressure: 0.4 },
];

export const STROKE_CLOSED_LOOP: TestPoint[] = [
	{ x: 100, y: 100, pressure: 0.5 },
	{ x: 200, y: 100, pressure: 0.5 },
	{ x: 200, y: 200, pressure: 0.5 },
	{ x: 100, y: 200, pressure: 0.5 },
	{ x: 100, y: 100, pressure: 0.5 },
];

export const STROKE_DENSE_POINTS: TestPoint[] = [
	{ x: 10.0, y: 10.0 },
	{ x: 10.2, y: 10.1 }, // sub-pixel distance < 0.75px (should be deduplicated)
	{ x: 10.4, y: 10.3 },
	{ x: 25.0, y: 20.0 },
	{ x: 50.0, y: 35.0 },
];

export const STROKE_RAPID_LARGE_DELTA: TestPoint[] = [
	{ x: 0, y: 0, pressure: 0.5 },
	{ x: 100, y: 80, pressure: 0.5 },
	{ x: 300, y: 250, pressure: 0.5 },
	{ x: 600, y: 500, pressure: 0.5 },
];

/**
 * 3. Sample Storyboard Shot Breakdowns
 */
export const SAMPLE_STORYBOARD_SHOTS: TestShot[] = [
	{
		index: 1,
		title: "Shot 1: Neon Tavern Exterior",
		duration: 3.5,
		visual:
			"Wide cinematic establishing shot of Chang'an cyberpunk alley in rain. Neon signage flickering in Tang dynasty calligraphy.",
		motion:
			"Slow dolly forward through rain droplets toward glowing tavern wooden door.",
		tail: "Camera pauses before the carved door handle as a cloaked figure approaches.",
		start: "High angle skyline descending into rain alley.",
		cam: "35mm anamorphic wide, eye-level tracking",
		seg: "opening",
		join: "cut",
		characters: ["Chen Shi"],
		scene: "Chang'an Alley",
		props: ["Cyber Lantern", "Carved Wooden Door"],
		timeBeats: [
			"0.0s: Rain pouring on neon signs",
			"1.8s: Dolly past dripping lantern",
			"3.5s: Cloaked figure steps into frame",
		],
		vfx: "Volumetric fog, reflective puddles, neon glow blur",
		negative: "blurry, low quality, modern cars, daytime",
	},
	{
		index: 2,
		title: "Shot 2: Tavern Interior & Encounter",
		duration: 4.0,
		visual:
			"Medium shot inside Chang'an tavern. Chen Shi pushes open door, water dripping from woven straw cape. Li Bai sits at corner table drinking jade wine.",
		motion:
			"Pan right following Chen Shi's movement across tavern floor to reveal Li Bai.",
		tail: "Li Bai raises glowing wine gourd, looking directly into camera with sharp grin.",
		start: "Door opening silhouette backlight.",
		cam: "50mm prime, shallow depth of field",
		seg: "continuation",
		join: "strict",
		characters: ["Chen Shi", "Li Bai"],
		scene: "Chang'an Tavern",
		props: ["Wine Gourd", "Straw Cape"],
		dialogue: [
			{ speaker: "Chen Shi", text: "You're late, poet." },
			{ speaker: "Li Bai", text: "The moon moves at its own pace, detective." },
		],
		sfx: "Door creak, rain outside fading, guzheng music hum",
		timeBeats: [
			"0.0s: Door swings open",
			"2.0s: Chen Shi strides forward",
			"4.0s: Li Bai raises cup",
		],
		vfx: "Steam rising from tea bowls, warm lantern flicker",
		negative: "modern attire, sunglasses, distortion",
	},
	{
		index: 3,
		title: "Shot 3: Close-up Secret Handshake & Map",
		duration: 3.0,
		visual:
			"Extreme close-up top-down on wooden table. Li Bai unrolls holographic silk scroll revealing Chang'an imperial data conduit.",
		motion: "Smooth tilt up from holographic map to Chen Shi's focused eyes.",
		tail: "Scroll glows bright amber, illuminating both faces in dramatic rim light.",
		start: "Hands unrolling silk scroll on weathered wood.",
		cam: "85mm macro, high angle to low angle tilt",
		seg: "closeup",
		join: "strict",
		characters: ["Chen Shi", "Li Bai"],
		scene: "Chang'an Tavern",
		props: ["Holographic Silk Map", "Jade Wine Cup"],
		dialogue: [
			{ speaker: "Li Bai", text: "The imperial archive breaches tonight." },
		],
		timeBeats: [
			"0.0s: Silk unrolls",
			"1.5s: Hologram ignites",
			"3.0s: Rim light peaks",
		],
		vfx: "Particle hologram sparks, caustic light on wood",
		negative: "flat lighting, text distortion, plastic",
	},
];

/**
 * 4. Sample Screenplay Script
 */
export const SAMPLE_SCREENPLAY_SCRIPT = `
# 【场1：夜·长安雨巷】
[外景 / 夜 / 大雨]
霓虹灯在仿唐木构阁楼间交织闪烁，全息灯笼在雨中轻颤。
陈拾身披黑色防雨斗笠，踏过积水倒影，快步走向隐秘酒肆“太白居”。

# 【场2：夜·太白居酒肆】
[内景 / 夜 / 暖色光]
厚重的雕花木门被推开，风雨声瞬间被屏障隔绝。
角落里，李白独坐案前，手持青瓷酒葫芦，指尖跃动着微弱的蓝色数据流。
陈拾拉低斗笠：“你迟到了，诗仙。”
李白抬头冷笑：“明月不等人，但我等的是盛唐最锋利的刀。”
李白展开全息丝绸卷轴，长安地下禁军脉络浮现眼前。
`.trim();

/**
 * 5. Series Bible Fixture
 */
export const SAMPLE_SERIES_BIBLE: TestProjectBible = {
	worldview:
		"Cyberpunk Chang'an 2088: Tang Dynasty architectural aesthetics merged with bio-cybernetic augmentations and holographic jade computing.",
	style:
		"Anime Cinematic Neo-Noir, Makoto Shinkai meets Blade Runner 2049, 4K crisp line art with atmospheric volumetric lighting.",
	styleAnchor: "cyber-tang-noir-v1",
	characters: [
		{
			id: "char_chen_shi",
			name: "Chen Shi",
			description:
				"Young forensic detective from Luoyang. Wears dark cyber-infused straw cape, mechanical right arm with jade conduit rings, short black messy hair, resolute expression.",
			turnaroundAssetId: "asset_char_chen_shi_turnaround",
			turnaroundUrl: "assets/turnaround/chen_shi.png",
			tags: ["detective", "prosthetic_arm", "straw_cape"],
		},
		{
			id: "char_li_bai",
			name: "Li Bai",
			description:
				"Rogue algorithmic poet and data broker. Loose white silk tunic with fiber-optic embroidery, long flowing hair tied with red ribbon, carrying a jade cyber-gourd.",
			turnaroundAssetId: "asset_char_li_bai_turnaround",
			turnaroundUrl: "assets/turnaround/li_bai.png",
			tags: ["poet", "data_broker", "white_silk", "wine_gourd"],
		},
	],
	scenes: [
		{
			id: "scene_changan_alley",
			name: "Chang'an Alley",
			description:
				"Narrow cobblestone alley flanked by 3-story wooden pagoda towers, draped in neon wires, holographic lanterns, constant drizzle.",
			referenceAssetId: "asset_scene_alley_ref",
			lighting:
				"Cool cyan neon with wet ground reflections and warm amber accent lanterns",
		},
		{
			id: "scene_changan_tavern",
			name: "Chang'an Tavern",
			description:
				"Interior of Tai Bai Tavern, vintage dark cedar tables, antique screen dividers embedded with translucent OLED terminals.",
			referenceAssetId: "asset_scene_tavern_ref",
			lighting:
				"Warm golden tungsten lamps, soft smoke diffusion, rim light from neon street outside",
		},
	],
	props: [
		{
			id: "prop_silk_map",
			name: "Holographic Silk Map",
			description:
				"Ancient-style silk scroll woven with gold nanothreads, radiating amber holographic wireframe of underground canals.",
			referenceAssetId: "asset_prop_map_ref",
		},
		{
			id: "prop_wine_gourd",
			name: "Jade Wine Gourd",
			description:
				"Celadon porcelain container modified with digital frequency dial and blue LED power gauge.",
			referenceAssetId: "asset_prop_gourd_ref",
		},
	],
};

/**
 * 6. Pipeline Node Parameters
 */
export const SAMPLE_MEDIA_PARAMS = {
	script: {
		idea: "In 2088 Chang'an, detective Chen Shi meets rogue poet Li Bai at a rain-soaked tavern to retrieve a stolen imperial data scroll.",
		model: "deepseek-chat",
	},
	image: {
		prompt:
			"Masterpiece anime concept art, @Chen Shi walking through rain-slicked @Chang'an Alley with neon lanterns",
		ratio: "16:9",
		size: "2K",
		imageModel: "seedance-image-pro",
	},
	video: {
		prompt:
			"Cinematic camera dolly into tavern revealing @Li Bai drinking from @Jade Wine Gourd",
		ratio: "16:9",
		duration: 4.0,
		resolution: "1080P",
		videoModel: "seedance-video-v2",
		frameMode: "auto",
	},
	audio: {
		prompt:
			"Melancholic traditional Chinese guzheng melody layered with ambient rain and distant electronic drone",
		duration: 12.0,
		audioModel: "seedance-audio-v1",
	},
	finalcut: {
		transition: "crossfade",
		transitionDuration: 0.5,
		totalDuration: 11.5,
		resolution: "1080P",
	},
};
