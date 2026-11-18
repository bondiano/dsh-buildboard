import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
async function startHarness() {
    const child = spawn(process.execPath, [join(here, "harness/server.ts")], {
        cwd: join(here, "../.."),
        stdio: ["ignore", "pipe", "pipe"],
    });
    const line = await new Promise((resolve, reject) => {
        let buf = "";
        let err = "";
        child.stdout?.on("data", (chunk) => {
            buf += chunk.toString("utf8");
            const start = buf.indexOf("{");
            if (start >= 0)
                resolve(buf.slice(start).trim());
        });
        child.stderr?.on("data", (chunk) => {
            err += chunk.toString("utf8");
        });
        child.on("exit", (code) => reject(new Error(`harness exited ${code}: ${err || buf}`)));
    });
    const info = JSON.parse(line);
    return {
        port: info.port,
        kill: () => {
            child.kill("SIGINT");
        },
    };
}
test("user diff, card edit, backlinks and research run", async () => {
    const harness = await startHarness();
    try {
        const base = `http://127.0.0.1:${harness.port}`;
        const post = await fetch(`${base}/plugin-api/buildboard/state?board=main`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                actor: "user",
                put: [
                    {
                        id: "shape:user-note",
                        typeName: "shape",
                        type: "note",
                        x: 20,
                        y: 20,
                        props: { text: "mine", w: 160, h: 100 },
                    },
                ],
            }),
        });
        expect(post.status).toBe(200);
        const rev = (await post.json());
        expect(rev.revision).toBeGreaterThan(0);
        const current = await (await fetch(`${base}/plugin-api/buildboard/state?board=main&since=${rev.revision}`)).json();
        expect(current).toEqual({ revision: rev.revision });
        const cards = (await (await fetch(`${base}/plugin-api/buildboard/cards?query=Auth`)).json());
        expect(cards.cards.length).toBeGreaterThan(0);
        const card = cards.cards[0];
        const putCard = await fetch(`${base}/plugin-api/buildboard/cards/${card.scope}:${card.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                title: card.title,
                body: "Updated body with [[session-store]] link.",
            }),
        });
        expect(putCard.status).toBe(200);
        await fetch(`${base}/plugin-api/buildboard/cards`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                scope: "project",
                title: "Session store",
                body: "Referenced from Auth gateway via [[Auth gateway]].",
                tags: ["arch"],
            }),
        });
        const detail = (await (await fetch(`${base}/plugin-api/buildboard/cards/${card.scope}:${card.id}`)).json());
        expect(detail.card.body).toContain("session-store");
        const run = await fetch(`${base}/plugin-api/buildboard/runs`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                kind: "research",
                board: "main",
                cardRefs: [`${card.scope}:${card.id}`],
            }),
        });
        expect(run.status).toBe(200);
        const runBody = (await run.json());
        expect(runBody.run.kind).toBe("research");
        expect(runBody.run.status).toBe("running");
        expect(runBody.brief).toContain("Research");
        const css = await fetch(`${base}/plugin-api/buildboard/assets/tldraw.css`);
        expect(css.status).toBe(200);
        expect(css.headers.get("content-type")).toMatch(/text\/css/);
    }
    finally {
        harness.kill();
    }
});
