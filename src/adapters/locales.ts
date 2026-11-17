import en from "../../locale/en.json" with { type: "json" };
import ru from "../../locale/ru.json" with { type: "json" };
import zh from "../../locale/zh.json" with { type: "json" };

export const BUILDBOARD_LOCALES = {
	en,
	ru,
	zh,
} as const;
