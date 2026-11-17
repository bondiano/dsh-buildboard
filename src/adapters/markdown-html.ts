/**
 * Small markdown ↔ HTML bridge for the TipTap card editor.
 * Covers paragraphs, headings, lists, emphasis, code, links and [[wiki]].
 */

/** Markdown document → HTML TipTap can load. */
export function markdownToHtml(markdown: string): string {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const blocks: string[] = [];
	let listType: "ul" | "ol" | null = null;
	let listItems: string[] = [];

	const flushList = (): void => {
		if (!listType || listItems.length === 0) {
			listType = null;
			listItems = [];
			return;
		}
		blocks.push(
			`<${listType}>${listItems.map((item) => `<li><p>${item}</p></li>`).join("")}</${listType}>`,
		);
		listType = null;
		listItems = [];
	};

	for (const raw of lines) {
		const line = raw.trimEnd();
		const heading = /^(#{1,3})\s+(.*)$/.exec(line);
		const ul = /^[-*]\s+(.*)$/.exec(line);
		const ol = /^\d+\.\s+(.*)$/.exec(line);
		if (heading) {
			flushList();
			const level = heading[1]!.length;
			blocks.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
			continue;
		}
		if (ul) {
			if (listType && listType !== "ul") flushList();
			listType = "ul";
			listItems.push(inline(ul[1]!));
			continue;
		}
		if (ol) {
			if (listType && listType !== "ol") flushList();
			listType = "ol";
			listItems.push(inline(ol[1]!));
			continue;
		}
		flushList();
		if (line.trim() === "") continue;
		blocks.push(`<p>${inline(line)}</p>`);
	}
	flushList();
	return blocks.join("") || "<p></p>";
}

/** TipTap HTML → markdown for on-disk cards. */
export function htmlToMarkdown(html: string): string {
	const normalized = html
		.replace(/\n+/g, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/h1>/gi, "\n\n")
		.replace(/<\/h2>/gi, "\n\n")
		.replace(/<\/h3>/gi, "\n\n")
		.replace(/<\/li>/gi, "\n")
		.replace(/<\/ul>/gi, "\n")
		.replace(/<\/ol>/gi, "\n");
	let text = normalized
		.replace(/<h1[^>]*>/gi, "# ")
		.replace(/<h2[^>]*>/gi, "## ")
		.replace(/<h3[^>]*>/gi, "### ")
		.replace(/<li[^>]*>/gi, "- ")
		.replace(/<(strong|b)[^>]*>/gi, "**")
		.replace(/<\/(strong|b)>/gi, "**")
		.replace(/<(em|i)[^>]*>/gi, "*")
		.replace(/<\/(em|i)>/gi, "*")
		.replace(/<code[^>]*>/gi, "`")
		.replace(/<\/code>/gi, "`")
		.replace(
			/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
			(_m, href: string, label: string) => `[${stripTags(label)}](${href})`,
		)
		.replace(/<[^>]+>/g, "");
	text = decodeEntities(text);
	return text.replace(/\n{3,}/g, "\n\n").trim() + (text.trim() ? "\n" : "");
}

function inline(value: string): string {
	return escapeHtml(value)
		.replace(/\[\[([^\]]+)\]\]/g, '<a href="wiki:$1">[[$1]]</a>')
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>")
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function stripTags(value: string): string {
	return value.replace(/<[^>]+>/g, "");
}

function decodeEntities(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}
